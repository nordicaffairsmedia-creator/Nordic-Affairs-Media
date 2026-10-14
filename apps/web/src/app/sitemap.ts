import type { MetadataRoute } from 'next'
import type { Where } from 'payload'
import { locales } from '@/i18n/config'
import { getPayloadClient } from '@/lib/payload'
import { routes, siteUrl } from '@/lib/site'

export const revalidate = 3600

/** All published, non-placeholder content in all four languages, with hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadClient()
  const live: Where = {
    and: [{ _status: { equals: 'published' } }, { isPlaceholder: { not_equals: true } }],
  }
  const common = { depth: 0, limit: 5000, pagination: false, overrideAccess: false, where: live }

  const [articles, publications, pages, events, galleries] = await Promise.all([
    payload.find({ collection: 'articles', ...common, select: { slug: true, updatedAt: true } }),
    payload.find({
      collection: 'publications',
      ...common,
      select: { slug: true, updatedAt: true },
    }),
    payload.find({
      collection: 'pages',
      depth: 0,
      limit: 500,
      pagination: false,
      overrideAccess: false,
      where: { _status: { equals: 'published' } },
      select: { slug: true, updatedAt: true },
    }),
    payload.find({ collection: 'events', ...common, select: { slug: true, updatedAt: true } }),
    payload.find({
      collection: 'galleries',
      depth: 0,
      limit: 2000,
      pagination: false,
      overrideAccess: false,
      where: { _status: { equals: 'published' } },
      select: { slug: true, updatedAt: true },
    }),
  ])

  const entry = (path: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${siteUrl}/en${path}`,
    lastModified,
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}${path}`])),
    },
  })

  return [
    entry(''),
    entry(routes.events()),
    entry(routes.publications()),
    entry('/about-us'),
    entry('/gallery'),
    entry('/media'),
    entry('/articles'),
    entry('/contact'),
    ...articles.docs.map((d) => entry(routes.article(d.slug), d.updatedAt)),
    ...publications.docs.map((d) => entry(routes.publication(d.slug), d.updatedAt)),
    ...pages.docs
      .filter((d) => d.slug !== 'about-us')
      .map((d) => entry(`/${d.slug}`, d.updatedAt)),
    ...events.docs.map((d) => entry(routes.event(d.slug), d.updatedAt)),
    ...galleries.docs.map((d) => entry(`/gallery/${d.slug}`, d.updatedAt)),
  ]
}
