import 'server-only'
import { unstable_cache } from 'next/cache'
import type { Where } from 'payload'
import type { Locale } from '@/i18n/config'
import { getPayloadClient } from '@/lib/payload'

/**
 * Listings for the My Booking events hub. Same published events and same visibility rules as
 * Events & Concerts (`_status = published`, read through Payload access control); this file only
 * adds search, date ranges and map points, so lib/listings.ts is left untouched.
 */

export type DateRange = 'today' | 'weekend' | 'nextweek' | 'month' | 'past'
export const dateRanges: DateRange[] = ['today', 'weekend', 'nextweek', 'month', 'past']
export const HUB_PAGE_SIZE = 12

const TZ = 'Europe/Stockholm'

/** Minutes that Stockholm is ahead of UTC at a moment (handles summer/winter time). */
function offsetMinutes(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  )
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!)
  return Math.round((asUtc - at.getTime()) / 60000)
}

/** The instant when calendar day y-m-d begins in Stockholm. */
function dayStart(y: number, m: number, d: number): Date {
  let guess = new Date(Date.UTC(y, m, d))
  for (let i = 0; i < 2; i++) {
    guess = new Date(Date.UTC(y, m, d) - offsetMinutes(guess) * 60000)
  }
  return guess
}

/** [from, to) for a date chip, using Stockholm midnights. */
export function rangeBounds(range: DateRange, now = new Date()): { from: Date; to: Date } {
  const off = offsetMinutes(now)
  const local = new Date(now.getTime() + off * 60000) // fields read with getUTC* = Stockholm wall clock
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()
  const dow = (local.getUTCDay() + 6) % 7 // Monday = 0
  const today = dayStart(y, m, d)
  switch (range) {
    case 'today':
      return { from: now, to: dayStart(y, m, d + 1) }
    case 'weekend': {
      const saturday = dayStart(y, m, d + (5 - dow))
      const monday = dayStart(y, m, d + (7 - dow))
      // On Saturday/Sunday the weekend has already begun.
      return { from: dow >= 5 ? now : saturday, to: monday }
    }
    case 'past':
      return { from: new Date(0), to: now }
    case 'nextweek':
      return { from: dayStart(y, m, d + (7 - dow)), to: dayStart(y, m, d + (14 - dow)) }
    case 'month':
    default:
      return { from: now < today ? today : now, to: new Date(now.getTime() + 30 * 24 * 3600_000) }
  }
}

export type HubFilter = {
  q?: string
  city?: string
  categorySlug?: string
  range?: DateRange
}

/** Midnight (Stockholm) at the start of today. */
function startOfToday(now: Date): Date {
  const local = new Date(now.getTime() + offsetMinutes(now) * 60000)
  return dayStart(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
}

const published: Where = { _status: { equals: 'published' } }

function buildWhere(filter: HubFilter, now: Date): Where {
  const and: Where[] = [published]
  if (filter.range) {
    const { from, to } = rangeBounds(filter.range, now)
    and.push({ startsAt: { greater_than_equal: from.toISOString() } })
    and.push({ startsAt: { less_than: to.toISOString() } })
  } else {
    // Today and later (an event earlier today stays visible until midnight), plus events whose
    // date is not confirmed yet. Finished events are under the "Past events" chip.
    and.push({
      or: [
        { startsAt: { greater_than_equal: startOfToday(now).toISOString() } },
        { endsAt: { greater_than_equal: now.toISOString() } },
        { startsAt: { exists: false } },
        { startsAt: { equals: null } },
      ],
    })
  }
  if (filter.city) and.push({ 'venue.city': { equals: filter.city } })
  if (filter.categorySlug) and.push({ 'category.slug': { equals: filter.categorySlug } })
  if (filter.q) {
    and.push({
      or: [
        { title: { like: filter.q } },
        { summary: { like: filter.q } },
        { 'venue.name': { like: filter.q } },
        { 'venue.city': { like: filter.q } },
        { 'lineup.name': { like: filter.q } },
      ],
    })
  }
  return { and }
}

const HUB_CACHE = { revalidate: 30, tags: ['content'] }

export const listHubEvents = (locale: Locale, filter: HubFilter, page: number) =>
  unstable_cache(() => queryHubEvents(locale, filter, page), ['hub-events', locale, JSON.stringify(filter), String(page)], HUB_CACHE)()

async function queryHubEvents(locale: Locale, filter: HubFilter, page: number) {
  const payload = await getPayloadClient()
  return payload.find({
    collection: 'events',
    locale,
    depth: 1,
    page,
    limit: HUB_PAGE_SIZE,
    sort: filter.range === 'past' ? '-startsAt' : 'startsAt',
    where: buildWhere(filter, new Date()),
    overrideAccess: false,
  })
}

/** "Coming up": the next few real, published, on-sale events. Never invented. */
export const listHubHighlights = (locale: Locale) =>
  unstable_cache(() => queryHubHighlights(locale), ['hub-highlights', locale], HUB_CACHE)()

async function queryHubHighlights(locale: Locale) {
  const payload = await getPayloadClient()
  const now = new Date().toISOString()
  const res = await payload.find({
    collection: 'events',
    locale,
    depth: 1,
    limit: 3,
    sort: 'startsAt',
    where: {
      and: [published, { salesStatus: { equals: 'onSale' } }, { startsAt: { greater_than_equal: now } }],
    },
    overrideAccess: false,
  })
  return res.docs
}

/** Events (the map keeps only those with real coordinates), for the map. Others stay in the list only. */
export const listHubMapEvents = (locale: Locale, filter: HubFilter) =>
  unstable_cache(() => queryHubMapEvents(locale, filter), ['hub-map', locale, JSON.stringify(filter)], HUB_CACHE)()

async function queryHubMapEvents(locale: Locale, filter: HubFilter) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'events',
    locale,
    depth: 1,
    limit: 100,
    pagination: false,
    sort: 'startsAt',
    where: buildWhere(filter, new Date()),
    overrideAccess: false,
  })
  return res.docs
}
