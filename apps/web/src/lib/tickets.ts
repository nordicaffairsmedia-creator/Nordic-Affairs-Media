import type { Event } from '@/payload-types'
import { eventSalesClose } from './stockholm'

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
  if ((eventSalesClose(event) ?? now) <= now) return 'salesEnded'
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

/** Dictionary key explaining why tickets cannot be bought right now, or null when they can. */
export type TicketBlock =
  | 'hubReasonCancelled'
  | 'hubReasonSoldOut'
  | 'hubReasonAnnounced'
  | 'hubReasonNoDate'
  | 'hubReasonPast'
  | 'hubReasonNoTiers'
  | 'hubReasonNotYet'
  | 'hubReasonSalesEnded'

export function ticketBlock(event: Event, now = new Date()): TicketBlock | null {
  if (event.salesStatus === 'cancelled') return 'hubReasonCancelled'
  if (event.salesStatus === 'soldOut') return 'hubReasonSoldOut'
  if (event.salesStatus === 'announced') return 'hubReasonAnnounced'
  if (!event.startsAt) return 'hubReasonNoDate'
  if ((eventSalesClose(event) ?? now) <= now) return 'hubReasonPast'
  const tiers = event.tiers ?? []
  if (tiers.length === 0) return 'hubReasonNoTiers'
  if (tiers.some((t) => tierOnSale(t, now))) return null
  return tiers.some((t) => t.salesStart && new Date(t.salesStart) > now)
    ? 'hubReasonNotYet'
    : 'hubReasonSalesEnded'
}

/** The sales status exactly as the admin chose it (dictionary key). */
export const salesStatusKey = (event: Event) =>
  (
    {
      announced: 'salesStatusAnnounced',
      onSale: 'salesStatusOnSale',
      soldOut: 'salesStatusSoldOut',
      cancelled: 'salesStatusCancelled',
    } as const
  )[event.salesStatus ?? 'onSale']
