import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { Where } from 'payload'
import type { Locale } from '@/i18n/config'
import type { Article, Event, Media, Publication } from '@/payload-types'
import { normalizePath } from '@/collections/Pages'
import { docs, getPayloadClient, isDoc } from './payload'
import { localizedSettings } from './i18n-content'

/**
 * All public reads go through here with `overrideAccess: false`, so the collection
 * access rules (published-only for the public) are enforced exactly as for an
 * anonymous visitor. Draft content can never leak onto the public site.
 */
const PUBLIC = { overrideAccess: false, draft: false } as const

const published: Where = { _status: { equals: 'published' } }

/** Database reads kept for a minute and dropped the instant an editor publishes (tag "content"). */
const CACHE = { revalidate: 60, tags: ['content'] }

export const getSiteChrome = cache((locale: Locale) => unstable_cache(async () => {
  const payload = await getPayloadClient()
  const [navigation, settings] = await Promise.all([
    payload.findGlobal({ slug: 'navigation', locale, depth: 0, ...PUBLIC }),
    payload.findGlobal({ slug: 'site-settings', locale, depth: 1, ...PUBLIC }),
  ])
  // Fixed wording (footer text, key figures…) in the reader's language.
  return { navigation, settings: localizedSettings(settings, locale) }
}, ['site-chrome', locale], CACHE)())

export const getLatestArticles = cache(
  async (locale: Locale, limit = 8, excludeIds: string[] = []): Promise<Article[]> => {
    const payload = await getPayloadClient()
    const where: Where = excludeIds.length
      ? { and: [published, { id: { not_in: excludeIds } }] }
      : published
    const result = await payload.find({
      collection: 'articles',
      locale,
      depth: 2,
      limit,
      sort: '-publishedAt',
      where,
      ...PUBLIC,
    })
    return result.docs
  },
)

export const getArticlesByCategory = cache(
  async (
    locale: Locale,
    categoryId: string,
    limit: number,
    excludeIds: string[],
  ): Promise<Article[]> => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'articles',
      locale,
      depth: 2,
      limit,
      sort: '-publishedAt',
      where: {
        and: [published, { category: { equals: categoryId } }, { id: { not_in: excludeIds } }],
      },
      ...PUBLIC,
    })
    return result.docs
  },
)

export const getArticleBySlug = cache(
  async (locale: Locale, slug: string): Promise<Article | null> => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'articles',
      locale,
      depth: 2,
      limit: 1,
      where: { and: [published, { slug: { equals: slug } }] },
      ...PUBLIC,
    })
    return result.docs[0] ?? null
  },
)

export const getUpcomingEvents = cache(async (locale: Locale, limit = 4): Promise<Event[]> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'events',
    locale,
    depth: 1,
    limit,
    sort: 'startsAt',
    where: {
      and: [
        published,
        { startsAt: { greater_than: new Date().toISOString() } },
        { salesStatus: { not_equals: 'cancelled' } },
      ],
    },
    ...PUBLIC,
  })
  return result.docs
})

export const getEventBySlug = cache((locale: Locale, slug: string): Promise<Event | null> => unstable_cache(async (): Promise<Event | null> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'events',
    locale,
    depth: 1,
    limit: 1,
    where: { and: [published, { slug: { equals: slug } }] },
    ...PUBLIC,
  })
  return result.docs[0] ?? null
}, ['event-by-slug', locale, slug], CACHE)())

export const getLatestPublication = cache(async (locale: Locale): Promise<Publication | null> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'publications',
    locale,
    depth: 1,
    limit: 1,
    sort: ['-year', '-publishedAt'],
    where: published,
    ...PUBLIC,
  })
  return result.docs[0] ?? null
})

export const getPageBySlug = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'pages',
    locale,
    depth: 1,
    limit: 1,
    where: { and: [published, { slug: { equals: slug } }] },
    ...PUBLIC,
  })
  return result.docs[0] ?? null
})

/** Old WordPress paths: explicit redirect entries first, then an article's `legacyUrl`. */
export type RedirectTarget = { to: string; permanent: boolean }

export const findRedirect = cache(
  async (path: string, locale: Locale): Promise<RedirectTarget | null> => {
    const payload = await getPayloadClient()
    const from = normalizePath(path)
    const variants = [from, `${from}/`]
    const redirect = await payload.find({
      collection: 'redirects',
      depth: 0,
      limit: 1,
      where: { from: { equals: from } },
      overrideAccess: false,
    })
    const hit = redirect.docs[0]
    if (hit) return { to: hit.to, permanent: hit.permanent !== false }
    const article = await payload.find({
      collection: 'articles',
      depth: 0,
      limit: 1,
      where: { and: [published, { legacyUrl: { in: variants } }] },
      ...PUBLIC,
    })
    const slug = article.docs[0]?.slug
    if (slug) return { to: `/${locale}/news/${slug}`, permanent: true }
    // Old site: every gallery lived at /<slug>/. The importer keeps the same slug, so an
    // old link still lands on its gallery even if its redirect entry was never written.
    const segment = from.split('/').filter(Boolean)
    if (segment.length !== 1) return null
    const gallery = await payload.find({
      collection: 'galleries',
      depth: 0,
      limit: 1,
      where: { and: [published, { slug: { equals: segment[0] } }] },
      select: { slug: true },
      ...PUBLIC,
    })
    const gallerySlug = gallery.docs[0]?.slug
    return gallerySlug ? { to: `/${locale}/gallery/${gallerySlug}`, permanent: true } : null
  },
)

/**
 * Everything the front page needs, resolved in one place. Each story appears at most
 * once on the page, so sections exclude stories already shown above them.
 */
export async function getHomepage(locale: Locale) {
  const payload = await getPayloadClient()
  const home = await payload.findGlobal({ slug: 'homepage', locale, depth: 2, ...PUBLIC })

  const shown = new Set<string>()
  const take = (list: Article[]) =>
    list.filter((a) => !shown.has(a.id) && a._status === 'published')
  const mark = (list: Article[]) => list.forEach((a) => shown.add(a.id))

  let lead = isDoc(home.leadStory) && home.leadStory._status === 'published' ? home.leadStory : null
  if (!lead) lead = (await getLatestArticles(locale, 1))[0] ?? null
  if (lead) shown.add(lead.id)

  const featured = take(docs(home.featured))
  mark(featured)

  const latest = home.showLatest ? await getLatestArticles(locale, 6, [...shown]) : []
  mark(latest)

  const sections = []
  for (const section of home.sections ?? []) {
    if (!isDoc(section.category)) continue
    const stories = await getArticlesByCategory(locale, section.category.id, section.limit ?? 4, [
      ...shown,
    ])
    mark(stories)
    if (stories.length) {
      sections.push({
        id: section.id ?? section.category.id,
        heading: section.heading || section.category.title,
        categorySlug: section.category.slug,
        layout: section.layout,
        stories,
      })
    }
  }

  const [events, publication, galleries] = await Promise.all([
    home.showEvents ? getUpcomingEvents(locale, 3) : Promise.resolve([]),
    isDoc(home.featuredPublication)
      ? Promise.resolve(home.featuredPublication)
      : getLatestPublication(locale),
    home.showGalleries === false
      ? Promise.resolve({ docs: [], total: 0 })
      : getLatestGalleries(locale, 12),
  ])

  return {
    galleries: galleries.docs,
    galleryTotal: galleries.total,
    lead,
    featured,
    latest,
    sections,
    events,
    publication,
    showNewsletter: home.showNewsletter ?? true,
    hero: {
      slides: docs<Media>(home.heroSlides as (string | Media)[] | null | undefined),
      title: home.heroTitle || '',
      text: home.heroText || '',
      buttonLabel: home.heroButtonLabel || '',
      buttonLink: home.heroButtonLink || '',
    },
  }
}

/** Newest published photo galleries — cover and count only, never every photo — plus how many exist. */
export const getLatestGalleries = cache(async (locale: Locale, limit = 12) => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'galleries',
    locale,
    depth: 1,
    limit,
    sort: '-date',
    where: published,
    select: { title: true, slug: true, date: true, cover: true, photoCount: true },
    ...PUBLIC,
  })
  return { docs: result.docs, total: result.totalDocs }
})

/** Gallery titles for the menu's Gallery list (newest first). */
export const getGalleryMenu = cache(async (locale: Locale) => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'galleries',
    locale,
    depth: 0,
    limit: 200,
    sort: '-date',
    where: published,
    select: { title: true, slug: true },
    ...PUBLIC,
  })
  return result.docs.map((g) => ({ title: g.title, slug: g.slug }))
})

/** Public "Media" page content: files the admin uploaded in the Media library. */
export const getPublicVideos = cache(async (limit = 60) => {
  const payload = await getPayloadClient()
  const r = await payload.find({
    collection: 'videos',
    depth: 1,
    limit,
    sort: '-createdAt',
    where: { showOnWebsite: { not_equals: false } },
    ...PUBLIC,
  })
  return r.docs
})

export const getPublicPhotos = cache(async (limit = 60) => {
  const payload = await getPayloadClient()
  const r = await payload.find({
    collection: 'media',
    depth: 0,
    limit,
    sort: '-createdAt',
    // Opt-in: only pictures ticked "Show on the Media page" appear there.
    where: { and: [{ showOnMediaPage: { equals: true } }, { isPlaceholder: { not_equals: true } }] },
    ...PUBLIC,
  })
  return r.docs
})

export const getPublicDocuments = cache(async (limit = 60) => {
  const payload = await getPayloadClient()
  const r = await payload.find({
    collection: 'documents',
    depth: 0,
    limit,
    sort: '-createdAt',
    where: { showOnWebsite: { not_equals: false } },
    ...PUBLIC,
  })
  return r.docs
})
