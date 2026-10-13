import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import type Stripe from 'stripe'
import {
  LOCALES,
  claimPromoUse,
  eventOnSale,
  findPromo,
  findPublishedEvent,
  getSettings,
  getVenueName,
  pick,
  releasePromoUse,
  tierOnSale,
  type Locale,
  type PromoCode,
} from '../catalog.js'
import { getDb } from '../db.js'
import { env } from '../env.js'
import { fulfilOrder, orderLink } from '../fulfil.js'
import { newOrderRef, newToken, orders, type Order, type OrderItem } from '../orders.js'
import { calculate, promoApplies, toMinor } from '../pricing.js'
import { release, remaining, reserve, sweepExpiredHolds, type Hold } from '../stock.js'
import { stripe, stripeLocale } from '../stripe.js'

export const checkoutRouter = Router()

const STRIPE_MIN_SESSION_MINUTES = 30

const body = z.object({
  eventId: z.string().min(12).max(40),
  locale: z.enum(LOCALES as [Locale, ...Locale[]]).default('en'),
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(2).max(80),
  items: z
    .array(
      z.object({ tierId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(50) }),
    )
    .min(1)
    .max(10),
  promoCode: z.string().trim().max(40).optional(),
  acceptTerms: z.literal(true),
})

type Fail = { status: number; error: string }
const fail = (status: number, error: string): Fail => ({ status, error })

/** Availability for the ticket picker. Releases expired holds first so numbers are fresh. */
checkoutRouter.get('/events/:id/availability', async (req, res) => {
  await sweepExpiredHolds()
  const [event, settings] = await Promise.all([findPublishedEvent(req.params.id), getSettings()])
  if (!event) return void res.status(404).json({ error: 'not_found' })
  const tiers = event.tiers ?? []
  const left = await remaining(String(event._id), tiers)
  res.set('Cache-Control', 'no-store').json({
    onSale: settings.features.ticketSales && eventOnSale(event),
    paymentsReady: Boolean(stripe()),
    promoCodes: settings.features.promoCodes,
    maxPerOrder: event.maxPerOrder ?? 10,
    holdMinutes: settings.holdMinutes,
    tiers: tiers.map((t) => ({
      tierId: t.tierId,
      onSale: tierOnSale(t),
      remaining: left[t.tierId] ?? 0,
    })),
  })
})

const checkoutLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

/**
 * Starts a checkout (PRD B-02..B-05):
 * 1. check the event, tiers and order limits;
 * 2. hold the tickets (atomic, all-or-nothing);
 * 3. price the order (promo code, fees, VAT);
 * 4. create the order and a Stripe Checkout page, and send the buyer there.
 * Free orders skip Stripe and are confirmed immediately.
 */
checkoutRouter.post('/checkout', checkoutLimiter, async (req, res) => {
  const parsed = body.safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const input = parsed.data

  const settings = await getSettings()
  if (!settings.features.ticketSales) return void res.status(403).json({ error: 'sales_closed' })

  const event = await findPublishedEvent(input.eventId)
  if (!event || !eventOnSale(event)) return void res.status(409).json({ error: 'not_on_sale' })

  // Merge duplicate tier lines and check limits.
  const wanted = new Map<string, number>()
  for (const i of input.items) wanted.set(i.tierId, (wanted.get(i.tierId) ?? 0) + i.quantity)
  const totalQty = [...wanted.values()].reduce((a, b) => a + b, 0)
  if (totalQty > (event.maxPerOrder ?? 10)) return void res.status(400).json({ error: 'too_many' })

  const items: OrderItem[] = []
  for (const [tierId, quantity] of wanted) {
    const tier = (event.tiers ?? []).find((t) => t.tierId === tierId)
    if (!tier || !tierOnSale(tier)) return void res.status(409).json({ error: 'tier_unavailable' })
    items.push({
      tierId,
      name: pick(tier.name, input.locale),
      unitPrice: toMinor(tier.price),
      quantity,
    })
  }

  // Promo code (optional).
  let promo: PromoCode | null = null
  if (input.promoCode) {
    if (!settings.features.promoCodes) return void res.status(400).json({ error: 'invalid_promo' })
    promo = await findPromo(input.promoCode)
    if (!promo || !promoApplies(promo, String(event._id)))
      return void res.status(400).json({ error: 'invalid_promo' })
  }

  const totals = calculate(items, settings, event.vatRate ?? settings.defaultVatRate, promo)
  if (totals.total > 0 && !stripe())
    return void res.status(503).json({ error: 'payments_unavailable' })

  // Hold the tickets — all tiers or none.
  const eventId = String(event._id)
  await sweepExpiredHolds()
  const held: OrderItem[] = []
  for (const item of items) {
    const capacity = (event.tiers ?? []).find((t) => t.tierId === item.tierId)?.quantity ?? 0
    if (!(await reserve(eventId, item.tierId, item.quantity, capacity))) {
      for (const h of held) await release(eventId, h.tierId, h.quantity)
      return void res.status(409).json({ error: 'sold_out', tierId: item.tierId })
    }
    held.push(item)
  }

  const result = await createOrder({ input, event, items, totals, promo, settings, eventId }).catch(
    async (e: unknown) => {
      for (const h of held) await release(eventId, h.tierId, h.quantity)
      throw e
    },
  )
  if ('error' in result) {
    for (const h of held) await release(eventId, h.tierId, h.quantity)
    return void res.status(result.status).json({ error: result.error })
  }
  res.status(201).json(result)
})

async function createOrder(args: {
  input: z.infer<typeof body>
  event: NonNullable<Awaited<ReturnType<typeof findPublishedEvent>>>
  items: OrderItem[]
  totals: ReturnType<typeof calculate>
  promo: PromoCode | null
  settings: Awaited<ReturnType<typeof getSettings>>
  eventId: string
}): Promise<{ ref: string; url: string } | Fail> {
  const { input, event, items, totals, promo, settings, eventId } = args
  if (promo && !(await claimPromoUse(promo))) return fail(400, 'invalid_promo')

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
    ...totals,
    ticketVatRate: event.vatRate ?? settings.defaultVatRate,
    feeVatRate: settings.defaultVatRate,
    ...(promo ? { promoCodeId: promo._id, promoCode: promo.code } : {}),
    status: 'pending',
    createdAt: now,
  }
  await orders().insertOne(order)

  const holdUntil = new Date(now.getTime() + settings.holdMinutes * 60_000)
  const holds: Hold[] = items.map((i) => ({
    orderId: order._id,
    eventId,
    tierId: i.tierId,
    quantity: i.quantity,
    status: 'active',
    expiresAt: holdUntil,
    createdAt: now,
  }))
  await getDb().collection<Hold>('booking_holds').insertMany(holds)

  // Free tickets (e.g. 100% promo): no payment step.
  if (totals.total === 0) {
    await fulfilOrder(order._id)
    return { ref: order._id, url: orderLink(order) }
  }

  const s = stripe()
  if (!s) return fail(503, 'payments_unavailable')

  try {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((i) => ({
      quantity: i.quantity,
      price_data: {
        currency: order.currency.toLowerCase(),
        unit_amount: i.unitPrice,
        product_data: { name: `${order.eventTitle} — ${i.name}` },
      },
    }))
    if (totals.fees > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: order.currency.toLowerCase(),
          unit_amount: totals.fees,
          product_data: { name: 'Booking & service fee' },
        },
      })
    }
    const discounts = totals.discount
      ? [
          {
            coupon: (
              await s.coupons.create({
                amount_off: totals.discount,
                currency: order.currency.toLowerCase(),
                duration: 'once',
                max_redemptions: 1,
                name: promo?.code ?? 'Discount',
              })
            ).id,
          },
        ]
      : undefined

    // Stripe keeps a checkout page open for at least 30 minutes. Our hold may be shorter;
    // if someone pays after their hold ended, fulfilOrder re-checks stock (and refunds if gone).
    const session = await s.checkout.sessions.create({
      mode: 'payment',
      customer_email: order.email,
      client_reference_id: order._id,
      metadata: { orderId: order._id },
      payment_intent_data: {
        metadata: { orderId: order._id },
        description: `${order.eventTitleEn} (${order._id})`,
      },
      line_items: lineItems,
      discounts,
      locale: stripeLocale(order.locale),
      expires_at: Math.floor(Date.now() / 1000) + STRIPE_MIN_SESSION_MINUTES * 60 + 60,
      success_url: `${orderLink(order)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.WEB_URL}/${order.locale}/events/${order.eventSlug}?checkout=cancelled#tickets`,
    })
    await orders().updateOne({ _id: order._id }, { $set: { stripeSessionId: session.id } })
    if (!session.url) throw new Error('Stripe returned no checkout URL')
    return { ref: order._id, url: session.url }
  } catch (e) {
    await orders().updateOne({ _id: order._id }, { $set: { status: 'cancelled' } })
    await getDb()
      .collection<Hold>('booking_holds')
      .updateMany({ orderId: order._id }, { $set: { status: 'released' } })
    if (promo) await releasePromoUse(promo._id)
    console.error('[checkout] Stripe error', e)
    return fail(502, 'payment_provider_error')
  }
}
