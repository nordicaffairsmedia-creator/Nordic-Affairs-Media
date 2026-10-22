import { Router, type Request } from 'express'
import { rateLimit } from 'express-rate-limit'
import { randomInt, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { LOCALES, type Locale } from '../catalog.js'
import { receiptPdf, ticketsPdf, qrDataUrl, ticketSvg } from '../documents.js'
import { esc, sendEmail } from '../email.js'
import { sendTicketsEmail } from '../fulfil.js'
import { messages } from '../messages.js'
import { newToken, orders, publicOrder, sha256, tickets, type Order } from '../orders.js'
import { getDb } from '../db.js'
import { cancelOrderTickets } from '../cancellations.js'
import { stripe } from '../stripe.js'
import { hasInternalKey } from './internal.js'
import { settleIntent, settleSession } from '../settle.js'

export const ordersRouter = Router()

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** An order can be opened with its own link token (from the email / Stripe redirect)… */
async function orderByToken(ref: string, token: string): Promise<Order | null> {
  if (!ref || !token) return null
  const order = await orders().findOne({ _id: ref })
  return order && safeEqual(order.accessToken, token) ? order : null
}

/** …or by a signed-in "My Bookings" visitor who owns it. */
async function sessionEmail(req: Request): Promise<string | null> {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  const session = await getDb()
    .collection<{ tokenHash: string; email: string; expiresAt: Date }>('booking_sessions')
    .findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } })
  return session?.email ?? null
}

async function authorise(req: Request): Promise<Order | null> {
  const ref = String(req.params.ref ?? '')
  const viaToken = await orderByToken(ref, String(req.query.t ?? ''))
  if (viaToken) return viaToken
  const email = await sessionEmail(req)
  if (!email) return null
  return orders().findOne({ _id: ref, email })
}

async function withTickets(order: Order) {
  const list = await tickets().find({ orderId: order._id }).sort({ createdAt: 1 }).toArray()
  const out = publicOrder(order, list)
  const qr = await Promise.all(out.tickets.map((t) => qrDataUrl(t.code)))
  return { ...out, tickets: out.tickets.map((t, i) => ({ ...t, qr: qr[i] })) }
}

/** Confirmation / ticket page data (PRD B-06). */
ordersRouter.get('/orders/:ref', async (req, res) => {
  const order = await authorise(req)
  if (!order) return void res.status(404).json({ error: 'not_found' })
  res.set('Cache-Control', 'no-store').json(await withTickets(order))
})

/**
 * The buyer's browser came back from Stripe: ask Stripe directly whether the session is paid and
 * issue the tickets now, so the thank-you page never waits for the webhook. Safe to call repeatedly.
 */
const confirmLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, skip: (req) => hasInternalKey(req) })
ordersRouter.post('/orders/:ref/confirm', confirmLimiter, async (req, res) => {
  const order = await orderByToken(String(req.params.ref ?? ''), String(req.query.t ?? ''))
  if (!order) return void res.status(404).json({ error: 'not_found' })
  if (order.status !== 'pending' || (!order.stripeSessionId && !order.stripePaymentIntentId))
    return void res.json({ status: order.status })
  const s = stripe()
  if (!s) return void res.json({ status: order.status })
  try {
    let paid: boolean
    if (order.stripeSessionId) {
      const session = await s.checkout.sessions.retrieve(order.stripeSessionId)
      if (session.metadata?.orderId !== order._id) return void res.status(409).json({ error: 'mismatch' })
      paid = await settleSession(session)
    } else {
      const intent = await s.paymentIntents.retrieve(order.stripePaymentIntentId as string)
      if (intent.metadata?.orderId !== order._id) return void res.status(409).json({ error: 'mismatch' })
      paid = await settleIntent(intent)
    }
    const fresh = await orders().findOne({ _id: order._id })
    res.json({ status: fresh?.status ?? order.status, paid })
  } catch (e) {
    console.error('[confirm]', e)
    res.status(502).json({ error: 'payment_provider_error' })
  }
})

/** The ticket picture (SVG) for one ticket, with its own QR code. */
ordersRouter.get('/orders/:ref/tickets/:code.svg', async (req, res) => {
  const order = await authorise(req)
  if (!order || !['paid', 'partially_refunded', 'refunded'].includes(order.status))
    return void res.status(404).send('Not found')
  const list = await tickets().find({ orderId: order._id }).sort({ createdAt: 1 }).toArray()
  const i = list.findIndex((t) => t.code === req.params.code)
  const ticket = list[i]
  if (!ticket) return void res.status(404).send('Not found')
  res
    .type('image/svg+xml')
    // The website (another origin) shows this picture in an <img>.
    .set('Cross-Origin-Resource-Policy', 'cross-origin')
    .set('Cache-Control', 'private, no-store')
    .set('Content-Disposition', `inline; filename="ticket-${order._id}-${i + 1}.svg"`)
    .send(ticketSvg(order, ticket, i + 1, list.length, { demo: order.demo }))
})

ordersRouter.get('/orders/:ref/tickets.pdf', async (req, res) => {
  const order = await authorise(req)
  if (!order || order.status !== 'paid') return void res.status(404).send('Not found')
  const list = await tickets()
    .find({ orderId: order._id, status: { $ne: 'cancelled' } })
    .toArray()
  res
    .type('application/pdf')
    .set('Content-Disposition', `attachment; filename="tickets-${order._id}.pdf"`)
    .set('Cache-Control', 'private, no-store')
    .send(await ticketsPdf(order, list))
})

/** Receipt with VAT breakdown (PRD B-07). */
ordersRouter.get('/orders/:ref/receipt.pdf', async (req, res) => {
  const order = await authorise(req)
  if (!order || !order.paidAt) return void res.status(404).send('Not found')
  res
    .type('application/pdf')
    .set('Content-Disposition', `attachment; filename="receipt-${order._id}.pdf"`)
    .set('Cache-Control', 'private, no-store')
    .send(await receiptPdf(order))
})

const resendLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

ordersRouter.post('/orders/:ref/resend', resendLimiter, async (req, res) => {
  const order = await authorise(req)
  if (!order || order.status !== 'paid') return void res.status(404).json({ error: 'not_found' })
  res.json({ sent: await sendTicketsEmail(order) })
})

/** Buyer asks to cancel (PRD B-08). The organizer decides and refunds from the admin. */
ordersRouter.post('/orders/:ref/cancel-request', async (req, res) => {
  const order = await authorise(req)
  if (!order || order.status !== 'paid') return void res.status(404).json({ error: 'not_found' })

  // "Money back in case of illness" (a paid extra): before the event starts, the buyer is refunded
  // everything except the extras themselves, automatically, and the tickets are cancelled.
  const refundable = order.total - (order.servicesTotal ?? 0)
  if (order.services?.refundProtection && order.eventStartsAt > new Date() && refundable > 0) {
    const claimed = await orders().findOneAndUpdate(
      { _id: order._id, status: 'paid' },
      {
        $set: {
          status: 'partially_refunded',
          refundedAmount: refundable,
          cancelRequestedAt: new Date(),
        },
      },
    )
    if (!claimed) return void res.status(409).json({ error: 'already_handled' })
    if (order.stripePaymentIntentId) {
      const s = stripe()
      try {
        if (!s) throw new Error('payments_unavailable')
        await s.refunds.create(
          {
            payment_intent: order.stripePaymentIntentId,
            amount: refundable,
            metadata: { orderId: order._id, cause: 'refund_protection' },
          },
          { idempotencyKey: `protect:${order._id}` },
        )
      } catch (e) {
        console.error('[refund-protection]', e)
        await orders().updateOne(
          { _id: order._id },
          { $set: { status: 'paid' }, $unset: { refundedAmount: '', cancelRequestedAt: '' } },
        )
        return void res.status(502).json({ error: 'payment_provider_error' })
      }
    }
    await cancelOrderTickets(order._id)
    return void res.json({ requested: true, refunded: refundable })
  }

  await orders().updateOne(
    { _id: order._id, cancelRequestedAt: { $exists: false } },
    { $set: { cancelRequestedAt: new Date() } },
  )
  res.json({ requested: true })
})

// ---- My Bookings sign-in by one-time email code (PRD B-01) ----

const codeLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})
const verifyLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

type LoginCode = { email: string; codeHash: string; attempts: number; expiresAt: Date }

ordersRouter.post('/auth/code', codeLimiter, async (req, res) => {
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email().max(200),
      locale: z.enum(LOCALES as [Locale, ...Locale[]]).default('en'),
    })
    .safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const { email, locale } = parsed.data

  // Always answer the same way, so nobody can test which emails have bookings.
  const hasOrders = await orders().countDocuments(
    { email, status: { $in: ['paid', 'partially_refunded', 'refunded'] } },
    { limit: 1 },
  )
  if (hasOrders) {
    const code = String(randomInt(100000, 1000000))
    await getDb()
      .collection<LoginCode>('booking_codes')
      .insertOne({
        email,
        codeHash: sha256(`${email}:${code}`),
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      })
    const t = messages(locale)
    await sendEmail({
      to: email,
      subject: `${t.codeSubject}: ${code}`,
      text: `${t.codeIntro}\n\n${code}\n\n${t.codeIgnore}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#121414"><p>${esc(t.codeIntro)}</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p><p style="color:#5c6366;font-size:13px">${esc(t.codeIgnore)}</p></div>`,
    })
  }
  res.json({ sent: true })
})

ordersRouter.post('/auth/verify', verifyLimiter, async (req, res) => {
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email().max(200),
      code: z.string().regex(/^\d{6}$/),
    })
    .safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_code' })
  const { email, code } = parsed.data
  const codes = getDb().collection<LoginCode>('booking_codes')
  const latest = await codes.findOne(
    { email, expiresAt: { $gt: new Date() } },
    { sort: { expiresAt: -1 } },
  )
  if (!latest || latest.attempts >= 5) return void res.status(400).json({ error: 'invalid_code' })
  if (!safeEqual(latest.codeHash, sha256(`${email}:${code}`))) {
    await codes.updateOne({ _id: latest._id }, { $inc: { attempts: 1 } })
    return void res.status(400).json({ error: 'invalid_code' })
  }
  await codes.deleteMany({ email })
  const token = newToken()
  await getDb()
    .collection('booking_sessions')
    .insertOne({
      tokenHash: sha256(token),
      email,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
    })
  res.json({ token, email })
})

ordersRouter.get('/me/orders', async (req, res) => {
  const email = await sessionEmail(req)
  if (!email) return void res.status(401).json({ error: 'signed_out' })
  const list = await orders()
    .find({ email, status: { $in: ['paid', 'partially_refunded', 'refunded'] } })
    .sort({ eventStartsAt: -1 })
    .limit(50)
    .toArray()
  const all = await tickets()
    .find({ orderId: { $in: list.map((o) => o._id) } })
    .toArray()
  res.set('Cache-Control', 'no-store').json({
    email,
    orders: list.map((o) =>
      publicOrder(
        o,
        all.filter((t) => t.orderId === o._id),
      ),
    ),
  })
})

ordersRouter.post('/auth/signout', async (req, res) => {
  const header = req.headers.authorization ?? ''
  if (header.startsWith('Bearer '))
    await getDb()
      .collection('booking_sessions')
      .deleteOne({ tokenHash: sha256(header.slice(7)) })
  res.json({ ok: true })
})
