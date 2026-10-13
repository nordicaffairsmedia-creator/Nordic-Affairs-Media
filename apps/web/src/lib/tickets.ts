import type { Event } from '@/payload-types'

/**
 * What a visitor can do with an event's tickets right now. One rule set, used by
 * cards, the event page and (later) the booking API, so they never disagree.
 * Each value is also a dictionary key, so it can be shown directly.
 */
export type TicketState = 'onSale' | 'announced' | 'soldOut' | 'cancelled' | 'salesEnded'

type Tier = NonNullable<Event['tiers']>[number]

export function tierOnSale(tier: Tier, now = new Date()): boolean {
  if (tier.salesStart && new Date(tier.salesStart) > now) return false
  if (tier.salesEnd && new Date(tier.salesEnd) < now) return false
  return tier.quantity > 0
}

export function ticketState(event: Event, now = new Date()): TicketState {
  if (event.salesStatus === 'cancelled') return 'cancelled'
  if (event.salesStatus === 'soldOut') return 'soldOut'
  if (event.salesStatus === 'announced') return 'announced'
  // No confirmed date yet: shown as an announcement, tickets open once the date is set.
  if (!event.startsAt) return 'announced'
  if (new Date(event.startsAt) < now) return 'salesEnded'
  const tiers = event.tiers ?? []
  if (tiers.length === 0) return 'announced'
  if (tiers.some((t) => tierOnSale(t, now))) return 'onSale'
  const opensLater = tiers.some((t) => t.salesStart && new Date(t.salesStart) > now)
  return opensLater ? 'announced' : 'salesEnded'
}

export function lowestPrice(event: Event): number | null {
  const prices = (event.tiers ?? [])
    .map((t) => t.price)
    .filter((p): p is number => typeof p === 'number')
  return prices.length ? Math.min(...prices) : null
}
