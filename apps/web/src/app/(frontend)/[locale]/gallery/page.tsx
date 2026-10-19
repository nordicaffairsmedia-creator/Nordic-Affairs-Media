import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPayloadClient } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { ViewSwitch } from '@/components/gallery/ViewToggle'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return buildMetadata({ locale, path: '/gallery', title: getDictionary(locale).gallery })
}

/** Photo galleries of past events (PRD W-14). */
export default async function GalleryIndex({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const payload = await getPayloadClient()
  const galleries = await payload.find({
    collection: 'galleries',
    locale,
    depth: 1,
    limit: 200,
    sort: ['_order', '-date'],
    where: { _status: { equals: 'published' } },
    overrideAccess: false,
    draft: false,
    // Only what the cards need — never every photo of every gallery.
    select: { title: true, slug: true, date: true, cover: true, photoCount: true },
  })

  const meta = (g: { date?: string | null; photoCount?: number | null }) =>
    [g.date ? formatDate(g.date, locale) : null, g.photoCount ? `${g.photoCount} ${t.photos}` : null]
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="container-max pb-20">
      <PageHeader centered title={t.gallery} />
      {galleries.docs.length === 0 ? (
        <div className="mt-12">
          <EmptyState title={t.noGalleries} body={t.emptyHomeBody} />
        </div>
      ) : (
        <ViewSwitch labels={{ label: t.viewLabel, grid: t.viewGrid, list: t.viewList }}>
          {/* Grid */}
          <ul className="mt-6 grid gap-x-8 gap-y-12 group-data-[view=list]/view:hidden sm:grid-cols-2 lg:grid-cols-3">
            {galleries.docs.map((g: any) => (
              <li key={g.id}>
                <Link href={href(locale, `/gallery/${g.slug}`)} className="story block">
                  <MediaImage
                    media={g.cover}
                    ratio="4/3"
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                  />
                  <h2 className="mt-3 text-h3">
                    <span className="story-link">{g.title}</span>
                  </h2>
                  <p className="meta mt-1">{meta(g)}</p>
                </Link>
              </li>
            ))}
          </ul>
          {/* List */}
          <ul className="mt-6 hidden divide-y divide-rule border-y border-rule group-data-[view=list]/view:block">
            {galleries.docs.map((g: any) => (
              <li key={g.id}>
                <Link
                  href={href(locale, `/gallery/${g.slug}`)}
                  className="story flex items-center gap-4 py-4 sm:gap-6"
                >
                  <MediaImage
                    media={g.cover}
                    ratio="4/3"
                    sizes="(min-width: 640px) 192px, 112px"
                    className="w-28 shrink-0 sm:w-48"
                  />
                  <div className="min-w-0">
                    <h2 className="text-h3">
                      <span className="story-link">{g.title}</span>
                    </h2>
                    <p className="meta mt-1">{meta(g)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </ViewSwitch>
      )}
    </div>
  )
}
