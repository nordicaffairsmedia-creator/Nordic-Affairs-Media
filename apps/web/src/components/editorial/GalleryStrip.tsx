import Link from 'next/link'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { Gallery } from '@/payload-types'
import { formatDate } from '@/lib/format'
import { href } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { SectionHeading } from '@/components/ui/primitives'

type Card = Pick<Gallery, 'id' | 'title' | 'slug' | 'date' | 'cover' | 'photoCount'>

/** The agency's photo coverage on the front page: newest 12 galleries, first one large, then a link to all of them. */
export function GalleryStrip({
  galleries,
  total = galleries.length,
  locale,
  t,
}: {
  galleries: Card[]
  total?: number
  locale: Locale
  t: Dictionary
}) {
  if (galleries.length === 0) return null
  return (
    <section aria-label={t.latestGalleries} className="container-max pb-12 md:pb-16">
      <SectionHeading title={t.latestGalleries} />
      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {galleries.map((g, i) => (
          <li key={g.id} className={i === 0 ? 'sm:col-span-2 lg:row-span-2' : ''}>
            <Link href={href(locale, `/gallery/${g.slug}`)} className="story block">
              <MediaImage
                media={g.cover}
                ratio={i === 0 ? '4/3' : '3/2'}
                sizes={
                  i === 0
                    ? '(min-width: 1024px) 60vw, 100vw'
                    : '(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw'
                }
                priority={i === 0}
              />
              <h3 className={`mt-3 ${i === 0 ? 'text-h2' : 'text-h3'}`}>
                <span className="story-link">{g.title}</span>
              </h3>
              <p className="meta mt-1">
                {[
                  g.date ? formatDate(g.date, locale) : null,
                  g.photoCount ? `${g.photoCount} ${t.photos}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-12 flex justify-center">
        <Link
          href={href(locale, '/gallery')}
          className="inline-flex items-center gap-2 border border-brass px-6 py-3 text-sm font-semibold uppercase tracking-wider text-brass-text transition-colors hover:bg-brass hover:text-navy-deep"
        >
          {t.allGalleries} ({total}) <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}
