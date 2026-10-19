import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { Where } from 'payload'
import type { Locale } from '@/i18n/config'
import { getPayloadClient } from './payload'

/** Same rule as queries.ts: public reads always run with the visitor's (anonymous) access. */
const PUBLIC = { overrideAccess: false, draft: false } as const
const published: Where = { _status: { equals: 'published' } }

export const PAGE_SIZE = 12

/** Parses ?page= safely: anything odd becomes page 1. */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1
}

export function textParam(value: string | string[] | undefined, max = 80): string {
  const v = (Array.isArray(value) ? value[0] : value) ?? ''
  return v.trim().slice(0, max)
}

export const getCategory = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'categories',
    locale,
    limit: 1,
    depth: 0,
    where: { slug: { equals: slug } },
    overrideAccess: false,
  })
  return res.docs[0] ?? null
})

export const getAuthor = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'authors',
    locale,
    limit: 1,
    depth: 1,
    where: { slug: { equals: slug } },
    overrideAccess: false,
  })
  return res.docs[0] ?? null
})

export async function listArticles(
  locale: Locale,
  filter: { categoryId?: string; authorId?: string; query?: string },
  page: number,
  limit = PAGE_SIZE,
) {
  const payload = await getPayloadClient()
  const and: Where[] = [published]
  if (filter.categoryId) and.push({ category: { equals: filter.categoryId } })
  if (filter.authorId) and.push({ authors: { in: [filter.authorId] } })
  if (filter.query)
    and.push({ or: [{ title: { like: filter.query } }, { deck: { like: filter.query } }] })
  return payload.find({
    collection: 'articles',
    locale,
    depth: 2,
    page,
    limit,
    sort: ['_order', '-publishedAt'],
    where: { and },
    ...PUBLIC,
  })
}

/**
 * The plain Articles list (no filter), kept for two minutes and dropped the moment something is
 * published (the 'content' tag is purged by the save hooks). Opening the Articles tab then
 * does not wait for the database.
 */
export const listArticlesCached = (locale: Locale, page: number) =>
  unstable_cache(() => listArticles(locale, {}, page), ['articles-list', locale, String(page)], {
    tags: ['content'],
    revalidate: 120,
  })()

export type EventFilter = {
  city?: string
  categorySlug?: string
  language?: string
  query?: string
}

export async function listEvents(
  locale: Locale,
  filter: EventFilter,
  when: 'upcoming' | 'past',
  page: number,
) {
  const payload = await getPayloadClient()
  const now = new Date().toISOString()
  const and: Where[] = [
    published,
    when === 'upcoming'
      ? // Upcoming also lists events whose date is not confirmed yet ("Date to be announced").
        { or: [{ startsAt: { greater_than_equal: now } }, { startsAt: { exists: false } }, { startsAt: { equals: null } }] }
      : { startsAt: { less_than: now } },
  ]
  if (filter.city) and.push({ 'venue.city': { equals: filter.city } })
  if (filter.categorySlug) and.push({ 'category.slug': { equals: filter.categorySlug } })
  if (filter.language) and.push({ eventLanguage: { in: [filter.language] } })
  if (filter.query) and.push({ title: { like: filter.query } })
  return payload.find({
    collection: 'events',
    locale,
    depth: 1,
    page,
    limit: when === 'upcoming' ? PAGE_SIZE : 6,
    sort: when === 'upcoming' ? ['_order', 'startsAt'] : ['_order', '-startsAt'],
    where: { and },
    ...PUBLIC,
  })
}

/** Filter choices are built from real data, so the form never offers an empty option. */
export const getEventFilterOptions = cache((locale: Locale) => unstable_cache(async () => {
  const payload = await getPayloadClient()
  const [venues, categories] = await Promise.all([
    payload.find({
      collection: 'venues',
      depth: 0,
      limit: 200,
      pagination: false,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'event-categories',
      locale,
      depth: 0,
      limit: 100,
      pagination: false,
      overrideAccess: false,
    }),
  ])
  const cities = [...new Set(venues.docs.map((v) => v.city))].sort((a, b) => a.localeCompare(b))
  return { cities, categories: categories.docs.map((c) => ({ slug: c.slug, title: c.title })) }
}, ['event-filter-options', locale], { revalidate: 60, tags: ['content'] })())

export async function listPublications(
  locale: Locale,
  year: number | null,
  page: number,
  query?: string,
) {
  const payload = await getPayloadClient()
  const and: Where[] = [published]
  if (year) and.push({ year: { equals: year } })
  if (query) and.push({ title: { like: query } })
  return payload.find({
    collection: 'publications',
    locale,
    depth: 1,
    page,
    limit: PAGE_SIZE,
    sort: ['_order', '-year', '-publishedAt'],
    where: { and },
    ...PUBLIC,
  })
}

export const getPublicationYears = cache(async () => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'publications',
    depth: 0,
    limit: 1000,
    pagination: false,
    where: published,
    select: { year: true },
    ...PUBLIC,
  })
  return [...new Set(res.docs.map((d) => d.year))].sort((a, b) => b - a)
})

export const getPublicationBySlug = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'publications',
    locale,
    depth: 2,
    limit: 1,
    where: { and: [published, { slug: { equals: slug } }] },
    ...PUBLIC,
  })
  return res.docs[0] ?? null
})

export const getArtistProfile = cache(async (locale: Locale) => {
  const payload = await getPayloadClient()
  return payload.findGlobal({ slug: 'artist-profile', locale, depth: 1, ...PUBLIC })
})
