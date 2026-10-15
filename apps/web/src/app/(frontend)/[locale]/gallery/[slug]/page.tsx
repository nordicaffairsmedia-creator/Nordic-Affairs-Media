import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { isLocale, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPayloadClient, isDoc } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { buildMetadata } from '@/lib/seo'
import { href, routes } from '@/lib/site'
import { GalleryPhotos, type Photo } from '@/components/gallery/GalleryPhotos'
import { PageHeader } from '@/components/ui/primitives'

export const dynamicParams = true

type Props = { params: Promise<{ locale: string; slug: string }> }

const getGallery = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'galleries',
    locale,
    depth: 2,
    limit: 1,
    where: { and: [{ _status: { equals: 'published' } }, { slug: { equals: slug } }] },
    overrideAccess: false,
    draft: false,
  })
  return res.docs[0] ?? null
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const g = await getGallery(locale, slug)
  if (!g) return {}
  return buildMetadata({
    locale,
    path: `/gallery/${g.slug}`,
    title: g.seo?.title || g.title,
    description: g.seo?.description || g.description,
    image: g.seo?.image && typeof g.seo.image === 'object' ? g.seo.image : g.photos?.[0]?.image,
    noIndex: Boolean(g.seo?.noIndex),
  })
}

/**
 * One gallery: photos as a grid or a list (visitor's choice); a click opens the photo
 * large in a pop-up on the same page.
 */
export default async function GalleryPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const g = await getGallery(locale, slug)
  if (!g) notFound()
  const t = getDictionary(locale)
  const event = isDoc(g.event) ? g.event : null

  // When every photo carries the same credit, say it once under the title instead of
  // repeating it under each picture.
  const credits = (g.photos ?? []).map((p) => (isDoc(p.image) ? p.image.credit || '' : ''))
  const sharedCredit =
    credits.length > 0 && credits.every((c) => c && c === credits[0]) ? credits[0] : ''

  // Plain data for the browser: the cuts Payload made at upload, never the resize server.
  const photos: Photo[] = (g.photos ?? []).flatMap((p, i) => {
    const media = isDoc(p.image) ? p.image : null
    if (!media?.url) return []
    const cuts = [media.sizes?.thumb, media.sizes?.card, media.sizes?.feature].filter(
      (c): c is { url: string; width: number } =>
        Boolean(c && typeof c.url === 'string' && typeof c.width === 'number'),
    )
    const original = typeof media.width === 'number' ? [`${media.url} ${media.width}w`] : []
    const mid = cuts.filter((c) => c.width <= 960)
    const feature = cuts.find((c) => c.width >= 1200)
    return [
      {
        id: p.id ?? `${media.id}-${i}`,
        src: (cuts.find((c) => c.width >= 960) ?? cuts[cuts.length - 1])?.url ?? media.url,
        srcSet: mid.map((c) => `${c.url} ${c.width}w`).join(', ') || undefined,
        full: feature?.url ?? media.url,
        fullSrcSet: [...cuts.map((c) => `${c.url} ${c.width}w`), ...original].join(', ') || undefined,
        width: media.width ?? undefined,
        height: media.height ?? undefined,
        alt: media.alt || `${g.title} — ${i + 1}`,
        caption: p.caption || undefined,
        credit: !sharedCredit && media.credit ? media.credit : undefined,
        focal:
          typeof media.focalX === 'number' && typeof media.focalY === 'number'
            ? `${media.focalX}% ${media.focalY}%`
            : undefined,
      },
    ]
  })

  return (
    <div className="container-max pb-20">
      <PageHeader centered eyebrow={t.gallery} title={g.title} intro={g.description}>
        <p className="meta mt-4">
          {g.date ? formatDate(g.date, locale) : null}
          {sharedCredit ? `${g.date ? ' · ' : ''}© ${sharedCredit}` : null}
          {event ? (
            <>
              {g.date || sharedCredit ? ' · ' : ''}
              <Link href={href(locale, routes.event(event.slug))} className="text-fjord underline">
                {event.title}
              </Link>
            </>
          ) : null}
        </p>
      </PageHeader>
      <GalleryPhotos
        photos={photos}
        labels={{
          label: t.viewLabel,
          grid: t.viewGrid,
          list: t.viewList,
          viewer: t.photoViewer,
          close: t.closePhoto,
          previous: t.prevPhoto,
          next: t.nextPhoto,
        }}
      />
      <Link
        href={href(locale, '/gallery')}
        className="mt-12 inline-block font-ui text-meta font-semibold text-fjord hover:underline"
      >
        ← {t.gallery}
      </Link>
    </div>
  )
}
