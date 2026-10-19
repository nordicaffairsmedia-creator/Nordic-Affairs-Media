import Link from 'next/link'
import type { Publication } from '@/payload-types'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { formatDate } from '@/lib/format'
import { href, routes } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'

/** Latest issue band — a dark "magazine on the table" moment between news sections. */
export function PublicationFeature({
  publication,
  locale,
  t,
}: {
  publication: Publication
  locale: Locale
  t: Dictionary
}) {
  const url = href(locale, routes.publication(publication.slug))
  return (
    <section aria-label={t.latestIssue} className="bg-navy-deep text-ink">
      <div className="container-wide grid items-center gap-10 py-14 md:grid-cols-12 md:py-20">
        <Link
          href={url}
          className="story mx-auto block w-56 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)] md:col-span-4 md:w-full md:max-w-72"
        >
          <MediaImage
            media={publication.cover}
            ratio="2/3"
            sizes="(min-width: 768px) 18rem, 14rem"
          />
        </Link>
        <div className="md:col-span-7 md:col-start-6">
          {publication.isPlaceholder ? (
            <PlaceholderBadge label={t.placeholder} className="mb-3" />
          ) : null}
          <span className="eyebrow text-brass">{t.latestIssue}</span>
          <h2 className="mt-3 text-h1 text-ink">{publication.title}</h2>
          <p className="meta mt-3 text-mist">
            {[publication.issueNumber ? `No. ${publication.issueNumber}` : null, publication.year]
              .filter(Boolean)
              .join(' · ')}
            {publication.publishedAt ? ` · ${formatDate(publication.publishedAt, locale)}` : ''}
          </p>
          {publication.description ? (
            <p className="mt-5 max-w-xl font-text text-deck text-ink/85">
              {publication.description}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={url}
              className="inline-flex min-h-11 items-center bg-snow px-5 font-ui text-caption font-semibold text-ink hover:bg-fjord-wash"
            >
              {t.readIssue}
            </Link>
            <Link
              href={href(locale, routes.publications())}
              className="inline-flex min-h-11 items-center border border-ink/50 px-5 font-ui text-caption font-semibold text-ink hover:border-ink"
            >
              {t.publications}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
