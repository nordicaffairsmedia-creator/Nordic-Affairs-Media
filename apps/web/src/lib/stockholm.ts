import type { Event } from '@/payload-types'

const TZ = 'Europe/Stockholm'
/** Minutes Stockholm is ahead of UTC at a moment (handles summer/winter time). */
export function stockholmOffsetMinutes(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at).map((x) => [x.type, x.value]),
  )
  return Math.round((Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!) - at.getTime()) / 60000)
}

/**
 * When ticket sales close. Tickets stay on sale until the event ends. If the admin gave no usable
 * end time (empty, or not after the start), the event counts as running until midnight (Stockholm)
 * at the end of its start day, so an event happening today can still be booked today.
 */
export function salesCloseAt(startsAt: Date | string, endsAt?: Date | string | null): Date {
  const start = new Date(startsAt)
  if (endsAt && new Date(endsAt) > start) return new Date(endsAt)
  const local = new Date(start.getTime() + stockholmOffsetMinutes(start) * 60000)
  let guess = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1))
  for (let i = 0; i < 2; i++) guess = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - stockholmOffsetMinutes(guess) * 60000)
  return guess
}

export const eventSalesClose = (event: Pick<Event, 'startsAt' | 'endsAt'>): Date | null =>
  event.startsAt ? salesCloseAt(event.startsAt, event.endsAt) : null
