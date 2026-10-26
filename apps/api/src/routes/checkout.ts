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
import { newOrderRef, newToken, orders, type Order, type OrderItem, type SeatItem } from '../orders.js'
import { calculate, promoApplies, toMinor } from '../pricing.js'
import { release, remaining, reserve, sweepExpiredHolds, type Hold } from '../stock.js'
import { stripe, stripeLocale } from '../stripe.js'
import { demoPayUrl, demoPaymentsOn } from '../demo.js'
import { offeredServices, priceServices } from '../services.js'
import {
  attachSeats,
  holdSeats,
  publicSeating,
  releaseSeatsByClaim,
  seatedSetup,
  takenSeatIds,
  tierForSection,
} from '../seating.js'
import { randomUUID } from 'node:crypto'

function paymentMethodTypes() {
  const list = (env.STRIPE_PAYMENT_METHODS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  return list.length ? (list as never) : undefined
}

export const checkoutRouter = Router()

const STRIPE_MIN_SESSION_MINUTES = 30

const body = z.object({
  eventId: z.string().min(12).max(40),
  locale: z.enum(LOCALES as [Locale, ...Locale[]]).default('en'),
  // Paid orders: the buyer's details are collected on the Stripe payment page, so these are optional here.
  // Free orders never reach Stripe, so they must send both.
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  name: z.string().trim().min(2).max(80).optional(),
  items: z
    .array(
      z.object({ tierId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(50) }),
    )
    .max(10)
    .default([]),
  // Reserved seating: the exact seats picked on the seat map (ids like "A:C:12").
  seats: z.array(z.string().trim().min(3).max(40)).max(20).optional(),
  promoCode: z.string().trim().max(40).optional(),
  // Buyer information step of the My Booking checkout (all optional so the Events page keeps working).
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  postalCode: z.string().trim().max(12).optional(),
  companyName: z.string().trim().max(80).optional(),
  consent: z.object({ marketing: z.boolean(), promoter: z.boolean() }).optional(),
  // Extras from the Services step. Anything not offered is ignored by the server.
  services: z
    .object({
      smsTickets: z.boolean().optional(),
      refundProtection: z.boolean().optional(),
      reminder: z.boolean().optional(),
    })
    .optional(),
  webOrigin: z.string().trim().max(200).optional(),
  // Marketing center: the tracking link the buyer came from (a short name, set by the website).
  trackingSource: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,60}$/).optional(),
  // Which payment button the buyer clicked. Only narrows Stripe's page to that method; falls back to all methods if Stripe can't.
  paymentMethod: z.enum(['card', 'klarna', 'swish', 'googlepay', 'applepay']).optional(),
  acceptTerms: z.literal(true),
  // Set by the My Booking hub so an abandoned payment returns there. Absent = Events page.
  returnTo: z.enum(['account']).optional(),
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
  const setup = await seatedSetup(event)
  const locale = LOCALES.includes(req.query.locale as Locale) ? (req.query.locale as Locale) : 'en'
  const seating = setup
    ? publicSeating(setup, tiers, await takenSeatIds(String(event._id)), (t) => pick(t.name, locale), toMinor)
    : null
  res.set('Cache-Control', 'no-store').json({
    seating,
    onSale: settings.features.ticketSales && eventOnSale(event),
    paymentsReady: Boolean(stripe()) || demoPaymentsOn(),
    demoPayments: demoPaymentsOn(),
    promoCodes: settings.features.promoCodes,
    maxPerOrder: event.maxPerOrder ?? 10,
    holdMinutes: settings.holdMinutes,
    serviceFeePercent: settings.serviceFeePercent,
    services: offeredServices(settings),
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

  // Reserved seating: the buyer sends exact seats; price and tier come from the seat's section.
  const setup = await seatedSetup(event)
  const seatItems: SeatItem[] = []
  if (event.seating === 'reserved' && !setup) return void res.status(409).json({ error: 'not_on_sale' })
  if (setup) {
    const ids = [...new Set(input.seats ?? [])]
    if (!ids.length) return void res.status(400).json({ error: 'seats_required' })
    if (ids.length > (event.maxPerOrder ?? 10)) return void res.status(400).json({ error: 'too_many' })
    for (const id of ids) {
      const seat = setup.seats.get(id)
      const tier = seat ? tierForSection(event.tiers ?? [], seat.section) : null
      if (!seat || !tier || !tierOnSale(tier)) return void res.status(409).json({ error: 'seat_unavailable', seat: id })
      seatItems.push({ seatId: id, label: seat.label, tierId: tier.tierId, tierName: pick(tier.name, input.locale) })
    }
    input.items = []
    for (const s of seatItems) {
      const line = input.items.find((i) => i.tierId === s.tierId)
      if (line) line.quantity++
      else input.items.push({ tierId: s.tierId, quantity: 1 })
    }
  } else if (!input.items.length) return void res.status(400).json({ error: 'invalid_request' })

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
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
    if (!promo || !promoApplies(promo, String(event._id), new Date(), subtotal))
      return void res.status(400).json({ error: 'invalid_promo' })
    // Per-buyer limit: counted from this buyer's earlier paid or in-progress orders.
    if (promo.perEmailLimit && input.email) {
      const used = await orders().countDocuments({
        promoCodeId: promo._id,
        email: input.email,
        status: { $in: ['pending', 'paid', 'partially_refunded'] },
      })
      if (used >= promo.perEmailLimit) return void res.status(400).json({ error: 'invalid_promo' })
    }
  }

  const services = priceServices(input.services, settings)
  if ((services.chosen.smsTickets || services.chosen.reminder) && !input.phone)
    return void res.status(400).json({ error: 'phone_required' })
  const totals = calculate(
    items,
    settings,
    event.vatRate ?? settings.defaultVatRate,
    promo,
    services.total,
  )
  if (totals.total === 0 && (!input.email || !input.name))
    return void res.status(400).json({ error: 'details_required' })
  if (totals.total > 0 && !stripe() && !demoPaymentsOn())
    return void res.status(503).json({ error: 'payments_unavailable' })

  // Hold the tickets — all tiers or none.
  const eventId = String(event._id)
  await sweepExpiredHolds()
  const held: OrderItem[] = []
  for (const item of items) {
    const tierQty = (event.tiers ?? []).find((t) => t.tierId === item.tierId)?.quantity ?? 0
    // Reserved seating: the tier's capacity is simply its seats (the seat map decides who gets which).
    const capacity = setup
      ? [...setup.seats.values()].filter((s) => tierForSection(event.tiers ?? [], s.section)?.tierId === item.tierId).length
      : tierQty
    if (!(await reserve(eventId, item.tierId, item.quantity, capacity))) {
      for (const h of held) await release(eventId, h.tierId, h.quantity)
      return void res.status(409).json({ error: 'sold_out', tierId: item.tierId })
    }
    held.push(item)
  }

  // Reserved seating: hold the exact seats (all or none) before the order exists.
  const claim = randomUUID()
  if (seatItems.length) {
    const lost = await holdSeats(
      eventId,
      seatItems.map((s) => s.seatId),
      claim,
      new Date(Date.now() + settings.holdMinutes * 60_000),
    )
    if (lost.length) {
      for (const h of held) await release(eventId, h.tierId, h.quantity)
      return void res.status(409).json({ error: 'seat_taken', seats: lost })
    }
  }

  const result = await createOrder({
    seatItems,
    claim,
    input,
    event,
    items,
    totals,
    promo,
    settings,
    eventId,
    services,
  }).catch(
    async (e: unknown) => {
      for (const h of held) await release(eventId, h.tierId, h.quantity)
      await releaseSeatsByClaim(claim)
      throw e
    },
  )
  if ('error' in result) {
    for (const h of held) await release(eventId, h.tierId, h.quantity)
    await releaseSeatsByClaim(claim)
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
  services: ReturnType<typeof priceServices>
  seatItems: SeatItem[]
  claim: string
}): Promise<{ ref: string; url: string; wallet?: { clientSecret: string; publishableKey: string } } | Fail> {
  const { input, event, items, totals, promo, settings, eventId, services, seatItems, claim } = args
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
    email: input.email ?? '',
    name: input.name ?? '',
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.country ? { country: input.country } : {}),
    ...(input.postalCode ? { postalCode: input.postalCode } : {}),
    ...(input.companyName ? { companyName: input.companyName } : {}),
    ...(input.consent ? { consent: input.consent } : {}),
    ...(input.trackingSource ? { trackingSource: input.trackingSource } : {}),
    services: services.chosen,
    currency: event.currency,
    items,
    ...(seatItems.length ? { seatItems } : {}),
    ...totals,
    ticketVatRate: event.vatRate ?? settings.defaultVatRate,
    feeVatRate: settings.defaultVatRate,
    ...(promo ? { promoCodeId: promo._id, promoCode: promo.code } : {}),
    // The site the buyer is on (if it is one of ours), not just the first configured address.
    ...(input.webOrigin && env.ALLOWED_ORIGINS.includes(input.webOrigin) ? { webOrigin: input.webOrigin } : {}),
    status: 'pending',
    ...(totals.total > 0 && !stripe() && demoPaymentsOn() ? { demo: true } : {}),
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
  if (seatItems.length) await attachSeats(claim, order._id, holdUntil)

  // Free tickets (e.g. 100% promo): no payment step.
  if (totals.total === 0) {
    await fulfilOrder(order._id)
    return { ref: order._id, url: orderLink(order) }
  }

  // Dummy gateway: send the buyer to our own payment page instead of Stripe.
  if (order.demo) return { ref: order._id, url: demoPayUrl(order) }

  const s = stripe()
  if (!s) return fail(503, 'payments_unavailable')

  try {
    // Google Pay / Apple Pay: the wallet sheet opens on our own page (Stripe Express Checkout), so we create
    // a PaymentIntent for the exact order total instead of a hosted Checkout page. Without the publishable
    // key we fall back to Stripe's card page, which shows the wallet button itself.
    if ((input.paymentMethod === 'googlepay' || input.paymentMethod === 'applepay') && env.STRIPE_PUBLISHABLE_KEY) {
      const intent = await s.paymentIntents.create({
        amount: order.total,
        currency: order.currency.toLowerCase(),
        payment_method_types: ['card'],
        ...(order.email ? { receipt_email: order.email } : {}),
        description: `${order.eventTitleEn} (${order._id})`,
        metadata: { orderId: order._id },
      })
      if (!intent.client_secret) throw new Error('Stripe returned no client secret')
      await orders().updateOne({ _id: order._id }, { $set: { stripePaymentIntentId: intent.id } })
      return {
        ref: order._id,
        url: orderLink(order),
        wallet: { clientSecret: intent.client_secret, publishableKey: env.STRIPE_PUBLISHABLE_KEY },
      }
    }
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
    for (const line of services.lines) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: order.currency.toLowerCase(),
          unit_amount: line.price,
          product_data: { name: line.name },
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
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      // Unset = Stripe shows every method enabled in Dashboard → Settings → Payment methods
      // (cards, Apple Pay, Google Pay, Klarna, Swish ...). Set STRIPE_PAYMENT_METHODS to force a list.
      // If the buyer already gave email and phone in step 2 they are prefilled / skipped. Otherwise (Events page)
      // Stripe's page asks for them and the webhook copies them onto the order.
      ...(order.email ? { customer_email: order.email } : {}),
      phone_number_collection: { enabled: !order.phone },
      billing_address_collection: 'auto',
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
      cancel_url: `${order.webOrigin ?? env.WEB_URL}/${order.locale}/${
        'events'
      }/${order.eventSlug}?checkout=cancelled#tickets`,
    }
    const forced = paymentMethodTypes()
    // Wallet buttons that could not use the on-page sheet use Stripe's card page.
    const chosen = input.paymentMethod === 'googlepay' || input.paymentMethod === 'applepay' ? 'card' : input.paymentMethod
    let session: Stripe.Checkout.Session
    if (forced) {
      session = await s.checkout.sessions.create({ ...params, payment_method_types: forced })
    } else if (chosen) {
      try {
        session = await s.checkout.sessions.create({ ...params, payment_method_types: [chosen] })
      } catch (e) {
        // Method not enabled on the Stripe account / not valid for this currency: show everything instead.
        console.warn('[checkout] Stripe refused payment method', chosen, '- retrying with all methods', (e as Error).message)
        session = await s.checkout.sessions.create(params)
      }
    } else {
      session = await s.checkout.sessions.create(params)
    }
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
