import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { LOCALES, findPromo, findPublishedEvent, getSettings, pick, tierOnSale, type Locale } from '../catalog.js'
import type { OrderItem } from '../orders.js'
import { calculate, promoApplies, toMinor } from '../pricing.js'
import { priceServices } from '../services.js'

/** Server-side promo code preview for the ticket picker ("Apply"). Prices are never trusted from the browser. */
export const promoRouter = Router()

const limiter = (limit: number, windowMs = 15 * 60_000) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false })
const locale = z.enum(LOCALES as [Locale, ...Locale[]]).default('en')

promoRouter.post('/promo/preview', limiter(30, 60_000), async (req, res) => {
  const parsed = z
    .object({
      eventId: z.string().regex(/^[a-f0-9]{24}$/),
      locale,
      promoCode: z.string().trim().min(1).max(40),
      items: z.array(z.object({ tierId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(50) })).min(1).max(10),
    })
    .safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const { eventId, items: lines, promoCode, locale: lang } = parsed.data
  const [event, settings] = await Promise.all([findPublishedEvent(eventId), getSettings()])
  if (!event || !settings.features.promoCodes) return void res.status(400).json({ error: 'invalid_promo' })
  const items: OrderItem[] = []
  for (const l of lines) {
    const tier = (event.tiers ?? []).find((t) => t.tierId === l.tierId)
    if (!tier || !tierOnSale(tier)) return void res.status(409).json({ error: 'tier_unavailable' })
    items.push({ tierId: l.tierId, name: pick(tier.name, lang), unitPrice: toMinor(tier.price), quantity: l.quantity })
  }
  const promo = await findPromo(promoCode)
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  if (!promo || !promoApplies(promo, String(event._id), new Date(), subtotal))
    return void res.status(400).json({ error: 'invalid_promo' })
  const totals = calculate(items, settings, event.vatRate ?? settings.defaultVatRate, promo)
  res.json({ ...totals, currency: event.currency })
})

/**
 * Live order summary for the My Booking checkout: tickets, optional promo code and optional
 * services in, authoritative totals out. The browser never calculates money it will pay.
 */
promoRouter.post('/quote', limiter(120, 60_000), async (req, res) => {
  const parsed = z
    .object({
      eventId: z.string().regex(/^[a-f0-9]{24}$/),
      locale,
      promoCode: z.string().trim().max(40).optional(),
      items: z.array(z.object({ tierId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(50) })).max(10),
      services: z
        .object({ smsTickets: z.boolean().optional(), refundProtection: z.boolean().optional(), reminder: z.boolean().optional() })
        .optional(),
    })
    .safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const { eventId, items: lines, promoCode, locale: lang, services } = parsed.data
  const [event, settings] = await Promise.all([findPublishedEvent(eventId), getSettings()])
  if (!event) return void res.status(404).json({ error: 'not_found' })
  const items: OrderItem[] = []
  for (const l of lines.filter((x) => x.quantity > 0)) {
    const tier = (event.tiers ?? []).find((t) => t.tierId === l.tierId)
    if (!tier || !tierOnSale(tier)) return void res.status(409).json({ error: 'tier_unavailable' })
    items.push({ tierId: l.tierId, name: pick(tier.name, lang), unitPrice: toMinor(tier.price), quantity: l.quantity })
  }
  let promo = null
  if (promoCode) {
    promo = settings.features.promoCodes ? await findPromo(promoCode) : null
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    if (!promo || !items.length || !promoApplies(promo, String(event._id), new Date(), subtotal))
      return void res.status(400).json({ error: 'invalid_promo' })
  }
  const svc = priceServices(services, settings)
  const totals = items.length
    ? calculate(items, settings, event.vatRate ?? settings.defaultVatRate, promo, svc.total)
    : { subtotal: 0, discount: 0, fees: 0, servicesTotal: 0, total: 0, vatAmount: 0 }
  res.json({
    ...totals,
    currency: event.currency,
    promoCode: promo?.code ?? null,
    services: svc.lines,
  })
})
