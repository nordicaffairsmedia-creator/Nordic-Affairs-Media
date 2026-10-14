import Link from 'next/link'
import type { Publication } from '@/payload-types'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { formatDate } from '@/lib/format'
import { href, routes } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'

export function issueLabel(p: Publication, t: Dictionary): string {
  return [p.issueNumber ? `${t.issue} ${p.issueNumber}` : null, p.year].filter(Boolean).join(' · ')
}

/** A magazine cover on the archive shelf, or (feature) the latest issue presented large. */
export function PublicationCard({
  publication,
  locale,
  t,
  feature = false,
}: {
  publication: Publication
  locale: Locale
  t: Dictionary
  feature?: boolean
}) {
  const url = href(locale, routes.publication(publication.slug))

  if (feature) {
    return (
      <article className="story grid items-center gap-8 md:grid-cols-12">
        <Link
          href={url}
          className="mx-auto block w-56 shadow-[0_24px_50px_-24px_rgb(0_0_0/0.45)] md:col-span-4 md:w-full md:max-w-80"
        >
          <MediaImage
            media={publication.cover}
            ratio="2/3"
            sizes="(min-width: 768px) 20rem, 14rem"
            priority
          />
        </Link>
        <div className="md:col-span-7 md:col-start-6">
          {publication.isPlaceholder ? (
            <PlaceholderBadge label={t.placeholder} className="mb-3" />
          ) : null}
          <span className="eyebrow text-brass-text">{t.latestIssue}</span>
          <h2 className="mt-3 text-h1">
            <Link href={url} className="story-link">
              {publication.title}
            </Link>
          </h2>
          <p className="meta mt-3">
            {issueLabel(publication, t)}
            {publication.publishedAt ? ` · ${formatDate(publication.publishedAt, locale)}` : ''}
          </p>
          {publication.description ? (
            <p className="mt-5 max-w-xl font-text text-deck text-charcoal">
              {publication.description}
            </p>
          ) : null}
          <Link
            href={url}
            className="mt-8 inline-flex min-h-11 items-center bg-ink px-5 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep"
          >
            {t.readIssue}
          </Link>
        </div>
      </article>
    )
  }

  return (
    <article className="story">
      <Link href={url} className="block">
        <div className="shadow-[0_16px_32px_-20px_rgb(0_0_0/0.45)]">
          <MediaImage
            media={publication.cover}
            ratio="2/3"
            sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
          />
        </div>
        {publication.isPlaceholder ? (
          <PlaceholderBadge label={t.placeholder} className="mt-3" />
        ) : null}
        <h3 className="mt-3 font-display text-[1.125rem] leading-snug">
          <span className="story-link">{publication.title}</span>
        </h3>
        <p className="meta mt-1">{issueLabel(publication, t)}</p>
      </Link>
    </article>
  )
}
