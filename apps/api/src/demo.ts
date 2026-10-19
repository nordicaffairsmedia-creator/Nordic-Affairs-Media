import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { env } from './env.js'
import { fulfilOrder, orderLink } from './fulfil.js'
import { orders, type Order } from './orders.js'
import { releaseOrderHolds } from './stock.js'
import { releasePromoUse } from './catalog.js'
import { stripe } from './stripe.js'

/**
 * Dummy payment gateway. Active only when PAYMENT_MODE=demo AND no Stripe key is set, so it
 * can never replace real payments: the moment STRIPE_SECRET_KEY exists, Stripe is used.
 */
export const demoPaymentsOn = () => env.PAYMENT_MODE === 'demo' && !stripe()

export const demoPayUrl = (order: Order) =>
  `${order.webOrigin ?? env.WEB_URL}/${order.locale}/events/pay/${encodeURIComponent(order._id)}?t=${order.accessToken}`

export const demoRouter = Router()

const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })

const body = z.object({
  ref: z.string().min(4).max(30),
  t: z.string().min(10).max(100),
  method: z.enum(['card', 'wallet', 'bank']).default('card'),
})

async function load(ref: string, t: string): Promise<Order | null> {
  const order = await orders().findOne({ _id: ref })
  return order && order.accessToken === t && order.demo ? order : null
}

/** "Pay" on the dummy page: marks the order paid and issues the tickets, exactly like a real payment would. */
demoRouter.post('/demo/pay', limiter, async (req, res) => {
  if (!demoPaymentsOn()) return void res.status(404).json({ error: 'not_found' })
  const parsed = body.safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const order = await load(parsed.data.ref, parsed.data.t)
  if (!order) return void res.status(404).json({ error: 'not_found' })
  if (order.status === 'cancelled') return void res.status(409).json({ error: 'cancelled' })
  const done = await fulfilOrder(order._id, `demo_${Date.now()}`)
  if (!done || done.status === 'refunded')
    return void res.status(409).json({ error: 'sold_out' })
  res.json({ ok: true, ref: done._id, url: orderLink(done) })
})

/** "Cancel" on the dummy page: gives the held tickets back. */
demoRouter.post('/demo/cancel', limiter, async (req, res) => {
  if (!demoPaymentsOn()) return void res.status(404).json({ error: 'not_found' })
  const parsed = body.safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const order = await load(parsed.data.ref, parsed.data.t)
  if (!order) return void res.status(404).json({ error: 'not_found' })
  const was = await orders().findOneAndUpdate(
    { _id: order._id, status: { $in: ['pending', 'expired'] } },
    { $set: { status: 'cancelled' } },
  )
  if (was) {
    await releaseOrderHolds(order._id)
    if (was.status === 'pending' && was.promoCodeId) await releasePromoUse(was.promoCodeId)
  }
  res.json({ ok: true })
})
