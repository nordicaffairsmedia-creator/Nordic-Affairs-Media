import type { PlatformSettings, PromoCode } from './catalog.js'
import type { OrderItem } from './orders.js'

/** Prices are entered in the CMS in normal money (e.g. 250 SEK); we calculate in öre/cents. */
export const toMinor = (major: number) => Math.round(major * 100)

/** VAT contained in a VAT-inclusive amount, e.g. 6% moms in 106 kr = 6 kr. */
export const vatPart = (gross: number, ratePercent: number) =>
  ratePercent > 0 ? Math.round((gross * ratePercent) / (100 + ratePercent)) : 0

export type Totals = {
  subtotal: number
  discount: number
  fees: number
  /** Optional extras the buyer chose in step 3 (SMS tickets, refund protection, reminder). */
  servicesTotal: number
  total: number
  vatAmount: number
}

export function promoApplies(
  promo: PromoCode,
  eventId: string,
  now = new Date(),
  subtotal?: number,
): boolean {
  if (promo.active === false) return false
  if (promo.validFrom && new Date(promo.validFrom) > now) return false
  if (promo.validUntil && new Date(promo.validUntil) < now) return false
  if (promo.maxUses && (promo.timesUsed ?? 0) >= promo.maxUses) return false
  if (promo.event && String(promo.event) !== eventId) return false
  // Minimum spend is in the event currency (major units), compared with the ticket subtotal.
  if (promo.minSpend && subtotal !== undefined && subtotal < toMinor(promo.minSpend)) return false
  return true
}

/**
 * Order maths, all in minor units:
 *   subtotal  = Σ ticket price × quantity
 *   discount  = promo code (never more than the subtotal)
 *   fees      = booking fee per order + service fee % of tickets after discount
 *   total     = subtotal − discount + fees
 *   VAT       = ticket VAT on (subtotal − discount) + fee VAT on fees
 * Free orders (total 0) carry no fees.
 */
export function calculate(
  items: OrderItem[],
  settings: PlatformSettings,
  ticketVatRate: number,
  promo: PromoCode | null,
  servicesTotal = 0,
): Totals {
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  let discount = 0
  if (promo) {
    discount =
      promo.discountType === 'percent'
        ? Math.round((subtotal * Math.min(100, Math.max(0, promo.amount))) / 100)
        : toMinor(Math.max(0, promo.amount))
    if (promo.maxDiscount) discount = Math.min(discount, toMinor(promo.maxDiscount))
    discount = Math.min(discount, subtotal)
  }
  const ticketsNet = subtotal - discount
  const fees =
    ticketsNet === 0
      ? 0
      : toMinor(settings.bookingFee) + Math.round((ticketsNet * settings.serviceFeePercent) / 100)
  const total = ticketsNet + fees + servicesTotal
  const vatAmount =
    vatPart(ticketsNet, ticketVatRate) +
    vatPart(fees + servicesTotal, settings.defaultVatRate)
  return { subtotal, discount, fees, servicesTotal, total, vatAmount }
}

export type ServiceSelection = { smsTickets?: boolean; refundProtection?: boolean; reminder?: boolean }

export const SERVICE_NAMES: Record<keyof ServiceSelection, string> = {
  smsTickets: 'Get your tickets sent via SMS',
  refundProtection: 'Get your money back in case of illness',
  reminder: 'Get a reminder about the event',
}

export function formatMoney(minor: number, currency: string, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100)
}
