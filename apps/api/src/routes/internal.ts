import { Router, type NextFunction, type Request, type Response } from 'express'
import { ObjectId, type Document, type Filter } from 'mongodb'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import {
  LOCALES,
  findPublishedEvent,
  getSettings,
  getVenueName,
  pick,
  type Locale,
} from '../catalog.js'
import { getDb } from '../db.js'
import { esc, sendEmail } from '../email.js'
import { env } from '../env.js'
import { fulfilOrder } from '../fulfil.js'
import { newOrderRef, newToken, orders, publicOrder, tickets, type Order } from '../orders.js'
import { toMinor, vatPart } from '../pricing.js'
import { remaining, reserve, type Hold } from '../stock.js'
import { stripe } from '../stripe.js'
import { cancelOrderTickets, cancelTicket } from '../cancellations.js'

/**
 * Staff endpoints (organizer dashboard, gate scanner, reports). Only the website's
 * server may call them: it checks the staff member's login and role first, then
 * sends the shared INTERNAL_API_KEY. Browsers never see that key.
 */
export const internalRouter = Router()

/** True when the request comes from the website's own server (it carries INTERNAL_API_KEY). */
export function hasInternalKey(req: Request): boolean {
  const given = Buffer.from(String(req.headers['x-internal-key'] ?? ''))
  const expected = Buffer.from(env.INTERNAL_API_KEY ?? '')
  return Boolean(
    env.INTERNAL_API_KEY && given.length === expected.length && timingSafeEqual(given, expected),
  )
}

function requireInternalKey(req: Request, res: Response, next: NextFunction) {
  if (!hasInternalKey(req)) {
    return void res.status(401).json({ error: 'unauthorised' })
  }
  next()
}
internalRouter.use('/internal', requireInternalKey)

const SETTLED = ['paid', 'partially_refunded', 'refunded'] as const
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Sales dashboard numbers for one event (PRD A-03, G-04). */
internalRouter.get('/internal/events/:id/stats', async (req, res) => {
  const event = await findPublishedEvent(req.params.id)
  if (!event) return void res.status(404).json({ error: 'not_found' })
  const eventId = String(event._id)
  const tiers = event.tiers ?? []

  const [ticketCounts, money, holds, left, cancelRequests] = await Promise.all([
    tickets()
      .aggregate<{ _id: { tierId: string; status: string }; n: number }>([
        { $match: { eventId } },
        { $group: { _id: { tierId: '$tierId', status: '$status' }, n: { $sum: 1 } } },
      ])
      .toArray(),
    orders()
      .aggregate<{ _id: string; orders: number; gross: number; refunded: number }>([
        { $match: { eventId, status: { $in: [...SETTLED] } } },
        {
          $group: {
            _id: { $ifNull: ['$source', 'online'] },
            orders: { $sum: 1 },
            gross: { $sum: '$total' },
            refunded: { $sum: { $ifNull: ['$refundedAmount', 0] } },
          },
        },
      ])
      .toArray(),
    getDb()
      .collection<Hold>('booking_holds')
      .aggregate<{ _id: string; n: number }>([
        { $match: { eventId, status: 'active', expiresAt: { $gt: new Date() } } },
        { $group: { _id: '$tierId', n: { $sum: '$quantity' } } },
      ])
      .toArray(),
    remaining(eventId, tiers),
    orders().countDocuments({ eventId, status: 'paid', cancelRequestedAt: { $exists: true } }),
  ])

  const count = (tierId: string, status: string) =>
    ticketCounts.find((c) => c._id.tierId === tierId && c._id.status === status)?.n ?? 0

  res.json({
    event: {
      id: eventId,
      title: pick(event.title, 'en'),
      startsAt: event.startsAt,
      currency: event.currency,
    },
    tiers: tiers.map((t) => ({
      tierId: t.tierId,
      name: pick(t.name, 'en'),
      price: toMinor(t.price),
      capacity: t.quantity,
      sold: count(t.tierId, 'valid') + count(t.tierId, 'checked_in'),
      checkedIn: count(t.tierId, 'checked_in'),
      cancelled: count(t.tierId, 'cancelled'),
      held: holds.find((h) => h._id === t.tierId)?.n ?? 0,
      remaining: left[t.tierId] ?? 0,
    })),
    sources: money,
    gross: money.reduce((a, m) => a + m.gross, 0),
    refunded: money.reduce((a, m) => a + m.refunded, 0),
    orders: money.reduce((a, m) => a + m.orders, 0),
    cancelRequests,
  })
})

/** Orders for one event, newest first, with optional search by name, email or reference. */
internalRouter.get('/internal/events/:id/orders', async (req, res) => {
  const q = String(req.query.q ?? '')
    .trim()
    .slice(0, 80)
  const filter: Filter<Order> = { eventId: req.params.id, status: { $nin: ['pending', 'expired'] } }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ _id: rx }, { name: rx }, { email: rx }]
  }
  const list = await orders().find(filter).sort({ createdAt: -1 }).limit(200).toArray()
  const all = await tickets()
    .find({ orderId: { $in: list.map((o) => o._id) } })
    .toArray()
  res.json({
    orders: list.map((o) => ({
      ...publicOrder(
        o,
        all.filter((t) => t.orderId === o._id),
      ),
      phone: o.phone ?? null,
      refundedAmount: o.refundedAmount ?? 0,
      refundable: Boolean(o.stripePaymentIntentId),
      note: o.note ?? null,
    })),
  })
})

/** One row per admission, for the CSV export and door list (PRD A-04). */
internalRouter.get('/internal/events/:id/attendees', async (req, res) => {
  const list = await tickets().find({ eventId: req.params.id }).sort({ holderName: 1 }).toArray()
  const refs = [...new Set(list.map((t) => t.orderId))]
  const byRef = new Map(
    (
      await orders()
        .find({ _id: { $in: refs } })
        .toArray()
    ).map((o) => [o._id, o]),
  )
  res.json({
    attendees: list.map((t) => {
      const o = byRef.get(t.orderId)
      return {
        name: t.holderName,
        email: o?.email ?? '',
        tier: t.tierName,
        seat: t.seatLabel ?? null,
        status: t.status,
        checkedInAt: t.checkedInAt ?? null,
        order: t.orderId,
        source: o?.source ?? 'online',
        code: t.code,
      }
    }),
  })
})

/** Full or partial refund (PRD A-05). Card/wallet payments are refunded through Stripe. */
internalRouter.post('/internal/orders/:ref/refund', async (req, res) => {
  const parsed = z
    .object({
      amount: z.number().int().positive().optional(),
      cancelTickets: z.boolean().default(false),
    })
    .safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const order = await orders().findOne({ _id: req.params.ref })
  if (!order || !['paid', 'partially_refunded'].includes(order.status)) {
    return void res.status(409).json({ error: 'not_refundable' })
  }
  const already = order.refundedAmount ?? 0
  const amount = Math.min(parsed.data.amount ?? order.total - already, order.total - already)
  if (amount <= 0 && order.total > 0) return void res.status(409).json({ error: 'nothing_left' })

  if (amount > 0 && order.stripePaymentIntentId) {
    const s = stripe()
    if (!s) return void res.status(503).json({ error: 'payments_unavailable' })
    try {
      await s.refunds.create(
        {
          payment_intent: order.stripePaymentIntentId,
          amount,
          metadata: { orderId: order._id },
        },
        // Same order, same starting point, same amount → Stripe performs it only once.
        { idempotencyKey: `refund:${order._id}:${already}:${amount}` },
      )
    } catch (e) {
      console.error('[refund]', e)
      return void res.status(502).json({ error: 'payment_provider_error' })
    }
  }
  const refundedAmount = already + Math.max(0, amount)
  const full = refundedAmount >= order.total
  const updated = await orders().updateOne(
    { _id: order._id, refundedAmount: order.refundedAmount },
    { $set: { status: full ? 'refunded' : 'partially_refunded', refundedAmount } },
  )
  if (updated.modifiedCount === 0) {
    // Someone else (usually Stripe's charge.refunded notice) recorded a refund meanwhile.
    const now = await orders().findOne({ _id: order._id })
    if ((now?.refundedAmount ?? 0) < refundedAmount) {
      // The money did go back at Stripe; tell staff so nobody refunds again by hand.
      return void res.status(409).json({ error: 'refund_sent_but_not_recorded' })
    }
  }
  const cancelled = full || parsed.data.cancelTickets ? await cancelOrderTickets(order._id) : 0
  res.json({
    ok: true,
    refundedAmount,
    status: full ? 'refunded' : 'partially_refunded',
    cancelledTickets: cancelled,
  })
})

internalRouter.post('/internal/tickets/:code/cancel', async (req, res) => {
  res.json({ cancelled: await cancelTicket(req.params.code) })
})

/** Complimentary (guest-list) and box-office bookings (PRD A-06). */
internalRouter.post('/internal/manual-order', async (req, res) => {
  const parsed = z
    .object({
      eventId: z.string().min(12),
      tierId: z.string().min(1),
      quantity: z.number().int().min(1).max(50),
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email(),
      locale: z.enum(LOCALES as [Locale, ...Locale[]]).default('en'),
      kind: z.enum(['comp', 'boxoffice']),
      amountPaid: z.number().min(0).default(0), // normal money, e.g. 500 (SEK)
      note: z.string().trim().max(300).optional(),
      staffEmail: z.string().max(200).optional(),
    })
    .safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const input = parsed.data
  const event = await findPublishedEvent(input.eventId)
  const tier = event?.tiers?.find((t) => t.tierId === input.tierId)
  if (!event || !tier) return void res.status(404).json({ error: 'not_found' })
  const eventId = String(event._id)
  if (!(await reserve(eventId, tier.tierId, input.quantity, tier.quantity))) {
    return void res.status(409).json({ error: 'sold_out' })
  }

  const settings = await getSettings()
  const total = input.kind === 'comp' ? 0 : toMinor(input.amountPaid)
  const items = [
    {
      tierId: tier.tierId,
      name: pick(tier.name, input.locale),
      unitPrice: input.quantity ? Math.round(total / input.quantity) : 0,
      quantity: input.quantity,
    },
  ]
  const vatRate = event.vatRate ?? settings.defaultVatRate
  const now = new Date()
  const order: Order = {
    _id: newOrderRef(),
    accessToken: newToken(),
    eventId,
    eventSlug: event.slug,
    eventTitle: pick(event.title, input.locale),
    eventTitleEn: pick(event.title, 'en'),
    eventStartsAt: new Date(event.startsAt),
    venueName: await getVenueName(event.venue),
    locale: input.locale,
    email: input.email,
    name: input.name,
    currency: event.currency,
    items,
    subtotal: total,
    discount: 0,
    fees: 0,
    total,
    ticketVatRate: vatRate,
    feeVatRate: settings.defaultVatRate,
    vatAmount: vatPart(total, vatRate),
    status: 'pending',
    source: input.kind,
    ...(input.note ? { note: input.note } : {}),
    ...(input.staffEmail ? { createdBy: input.staffEmail } : {}),
    createdAt: now,
  }
  await orders().insertOne(order)
  await getDb()
    .collection<Hold>('booking_holds')
    .insertOne({
      orderId: order._id,
      eventId,
      tierId: tier.tierId,
      quantity: input.quantity,
      status: 'active',
      expiresAt: new Date(now.getTime() + 3600_000),
      createdAt: now,
    })
  const done = await fulfilOrder(order._id)
  res.status(201).json({ ref: order._id, status: done?.status ?? 'paid' })
})

/** Message to everyone holding tickets for an event (PRD A-09). */
internalRouter.post('/internal/events/:id/announce', async (req, res) => {
  const parsed = z
    .object({
      subject: z.string().trim().min(3).max(150),
      message: z.string().trim().min(10).max(5000),
    })
    .safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const emails = (
    await orders().distinct('email', {
      eventId: req.params.id,
      status: { $in: ['paid', 'partially_refunded'] },
    })
  ).filter(Boolean)
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#121414;line-height:1.6"><p style="font-size:11px;letter-spacing:3px;color:#835c20">NORDIC AFFAIRS MEDIA</p>${esc(
    parsed.data.message,
  )
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')}</div>`
  let sent = 0
  for (const to of emails) {
    if (await sendEmail({ to, subject: parsed.data.subject, html, text: parsed.data.message }))
      sent++
  }
  res.json({ recipients: emails.length, sent })
})

const normaliseCode = (raw: string) =>
  raw
    .trim()
    .replace(/^NAM1:/i, '')
    .toUpperCase()

/** Gate check-in (PRD G-01, G-02): green only for a valid, unused ticket for this event. */
internalRouter.post('/internal/checkin', async (req, res) => {
  const parsed = z
    .object({
      code: z.string().min(4).max(80),
      eventId: z.string().min(12),
      staff: z.string().max(200).optional(),
    })
    .safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ result: 'not_found' })
  const code = normaliseCode(parsed.data.code)
  const ticket = await tickets().findOne({ code })
  if (!ticket) return void res.json({ result: 'not_found' })
  const info = { holder: ticket.holderName, tier: ticket.tierName, order: ticket.orderId, seat: ticket.seatLabel ?? null }
  if (ticket.eventId !== parsed.data.eventId) {
    const other = await orders().findOne({ _id: ticket.orderId })
    return void res.json({ result: 'wrong_event', ...info, event: other?.eventTitleEn ?? '' })
  }
  if (ticket.status === 'cancelled') return void res.json({ result: 'cancelled', ...info })
  const updated = await tickets().findOneAndUpdate(
    { code, status: 'valid' },
    {
      $set: {
        status: 'checked_in',
        checkedInAt: new Date(),
        ...(parsed.data.staff ? { checkedInBy: parsed.data.staff } : {}),
      },
    },
  )
  if (!updated)
    return void res.json({ result: 'already', ...info, checkedInAt: ticket.checkedInAt ?? null })
  const order = await orders().findOne({ _id: ticket.orderId })
  res.json({
    result: 'ok',
    ...info,
    code,
    event: order?.eventTitleEn ?? '',
    demo: Boolean(order?.demo),
    checkedInAt: new Date().toISOString(),
  })
})

/** Manual search at the gate by name or order reference (PRD G-03). */
internalRouter.get('/internal/events/:id/search', async (req, res) => {
  const q = String(req.query.q ?? '')
    .trim()
    .slice(0, 60)
  if (q.length < 2) return void res.json({ tickets: [] })
  const rx = new RegExp(escapeRegex(q), 'i')
  const list = await tickets()
    .find({ eventId: req.params.id, $or: [{ holderName: rx }, { orderId: rx }, { code: rx }] })
    .limit(25)
    .toArray()
  res.json({
    tickets: list.map((t) => ({
      code: t.code,
      holder: t.holderName,
      tier: t.tierName,
      order: t.orderId,
      status: t.status,
      seat: t.seatLabel ?? null,
    })),
  })
})

/** "SEK:5,EUR:0.45" → { SEK: 500, EUR: 45 } in minor units. */
function fixedFees(spec: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const part of spec.split(',')) {
    const [cur, amount] = part.split(':').map((x) => x.trim())
    const n = Number(amount)
    if (cur && Number.isFinite(n) && n >= 0) out[cur.toUpperCase()] = Math.round(n * 100)
  }
  return out
}

/**
 * Entraiot's platform fee per month: ENTRAIOT_COMMISSION_PERCENT of net ticket revenue
 * (after discounts and refunds, excluding booking/service fees) plus a fixed amount per paid
 * ticket. Free, complimentary, refunded and cancelled tickets cost nothing.
 */
async function platformFeeReport(match: Document) {
  const percent = env.ENTRAIOT_COMMISSION_PERCENT
  const fixed = fixedFees(env.ENTRAIOT_COMMISSION_FIXED)
  const list = await orders()
    .find(
      { ...match, source: { $ne: 'comp' }, total: { $gt: 0 } } as Filter<Order>,
      { projection: { items: 1, subtotal: 1, discount: 1, refundedAmount: 1, status: 1, currency: 1, paidAt: 1 } },
    )
    .toArray()
  const cancelled = new Map<string, number>()
  if (list.length) {
    const rows = await tickets()
      .aggregate<{ _id: string; n: number }>([
        { $match: { orderId: { $in: list.map((o) => o._id) }, status: 'cancelled' } },
        { $group: { _id: '$orderId', n: { $sum: 1 } } },
      ])
      .toArray()
    for (const r of rows) cancelled.set(r._id, r.n)
  }
  const month = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit' })
  const byMonth = new Map<
    string,
    { month: string; currency: string; orders: number; tickets: number; net: number; commission: number }
  >()
  for (const o of list) {
    if (o.status === 'refunded' || !o.paidAt) continue
    const ticketNet = Math.max(0, (o.subtotal ?? 0) - (o.discount ?? 0))
    const net = Math.max(0, ticketNet - Math.min(o.refundedAmount ?? 0, ticketNet))
    const paidTickets = Math.max(
      0,
      (o.items ?? []).filter((i) => i.unitPrice > 0).reduce((n, i) => n + i.quantity, 0) -
        (cancelled.get(o._id) ?? 0),
    )
    if (net === 0 && paidTickets === 0) continue
    const fee = Math.min(net, Math.round((net * percent) / 100) + (fixed[o.currency] ?? 0) * paidTickets)
    const m = month.format(o.paidAt).slice(0, 7)
    const key = `${m}:${o.currency}`
    const row = byMonth.get(key) ?? { month: m, currency: o.currency, orders: 0, tickets: 0, net: 0, commission: 0 }
    row.orders++
    row.tickets += paidTickets
    row.net += net
    row.commission += fee
    byMonth.set(key, row)
  }
  return {
    percent,
    fixed,
    byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
  }
}

/** Revenue reports (PRD S-08): per event and per month, in each currency. */
internalRouter.get('/internal/reports', async (req, res) => {
  const from = req.query.from
    ? new Date(String(req.query.from))
    : new Date(Date.now() - 365 * 86400_000)
  const to = req.query.to ? new Date(String(req.query.to)) : new Date()
  const match = { status: { $in: [...SETTLED] }, paidAt: { $gte: from, $lte: to } }
  const sum = {
    orders: { $sum: 1 },
    tickets: { $sum: { $sum: '$items.quantity' } },
    gross: { $sum: '$total' },
    refunded: { $sum: { $ifNull: ['$refundedAmount', 0] } },
    vat: { $sum: '$vatAmount' },
  }
  const [byEvent, byMonth, bySource] = await Promise.all([
    orders()
      .aggregate([
        { $match: match },
        { $group: { _id: { event: '$eventTitleEn', currency: '$currency' }, ...sum } },
        { $sort: { gross: -1 } },
      ])
      .toArray(),
    orders()
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              month: {
                $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: 'Europe/Stockholm' },
              },
              currency: '$currency',
            },
            ...sum,
          },
        },
        { $sort: { '_id.month': 1 } },
      ])
      .toArray(),
    orders()
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: { source: { $ifNull: ['$source', 'online'] }, currency: '$currency' },
            ...sum,
          },
        },
      ])
      .toArray(),
  ])
  // Partner organizers (PRD S-07): net ticket revenue per organizer and the agreed commission.
  const byEventId = await orders()
    .aggregate<{
      _id: { eventId: string; currency: string }
      gross: number
      refunded: number
      title: string
    }>([
      { $match: match },
      {
        $group: {
          _id: { eventId: '$eventId', currency: '$currency' },
          gross: { $sum: { $subtract: ['$subtotal', '$discount'] } },
          refunded: { $sum: { $ifNull: ['$refundedAmount', 0] } },
          title: { $first: '$eventTitleEn' },
        },
      },
    ])
    .toArray()
  const eventDocs = await getDb()
    .collection<Document>('events')
    .find({
      _id: {
        $in: byEventId.flatMap((e) =>
          ObjectId.isValid(e._id.eventId) ? [new ObjectId(e._id.eventId)] : [],
        ),
      },
    })
    .project({ organizer: 1 })
    .toArray()
  const organizerOf = new Map(
    eventDocs.map((d) => [String(d._id), d.organizer ? String(d.organizer) : null]),
  )
  const orgIds = [...new Set([...organizerOf.values()].filter((v): v is string => Boolean(v)))]
  const orgDocs = await getDb()
    .collection<Document>('organizers')
    .find({ _id: { $in: orgIds.filter((i) => ObjectId.isValid(i)).map((i) => new ObjectId(i)) } })
    .toArray()
  const orgs = new Map(
    orgDocs.map((o) => [
      String(o._id),
      { name: String(o.name ?? ''), pct: Number(o.commissionPercent ?? 0) },
    ]),
  )
  const partners = new Map<
    string,
    { organizer: string; currency: string; commissionPercent: number; events: number; net: number }
  >()
  for (const e of byEventId) {
    const orgId = organizerOf.get(e._id.eventId)
    const org = orgId ? orgs.get(orgId) : undefined
    if (!org) continue
    const key = `${orgId}:${e._id.currency}`
    const row = partners.get(key) ?? {
      organizer: org.name,
      currency: e._id.currency,
      commissionPercent: org.pct,
      events: 0,
      net: 0,
    }
    row.events++
    row.net += Math.max(0, e.gross - e.refunded)
    partners.set(key, row)
  }
  const byOrganizer = [...partners.values()].map((p) => {
    const commission = Math.round((p.net * p.commissionPercent) / 100)
    return { ...p, commission, payout: p.net - commission }
  })

  const feeOn =
    env.ENTRAIOT_COMMISSION_PERCENT > 0 ||
    Object.values(fixedFees(env.ENTRAIOT_COMMISSION_FIXED)).some((v) => v > 0)
  const platformFee = feeOn ? await platformFeeReport(match) : undefined
  res.json({ from, to, byEvent, byMonth, bySource, byOrganizer, platformFee })
})

/** Everything an assistant may say about our own config (used by the website server). */
internalRouter.get('/internal/settings', async (_req, res) => {
  res.json(await getSettings())
})
