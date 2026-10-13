import Link from 'next/link'
import type { Article } from '@/payload-types'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { docs, isDoc } from '@/lib/payload'
import { formatDate, readingMinutes } from '@/lib/format'
import { href, routes } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'
import { Eyebrow } from '@/components/ui/primitives'

/**
 * One component, several editorial shapes (master prompt §11):
 * - lead:       front-page headline with large image (image right on desktop)
 * - feature:    large image above, big headline
 * - standard:   image above, medium headline, deck
 * - horizontal: small image left, text right
 * - text:       headline + meta only (lists, "Latest" column)
 */
export type StoryVariant = 'lead' | 'feature' | 'standard' | 'horizontal' | 'text'

type Props = {
  article: Article
  locale: Locale
  t: Dictionary
  variant?: StoryVariant
  priority?: boolean
  headingLevel?: 'h2' | 'h3'
}

export function StoryCard({
  article,
  locale,
  t,
  variant = 'standard',
  priority,
  headingLevel = 'h3',
}: Props) {
  const Heading = headingLevel
  const url = href(locale, routes.article(article.slug))
  const category = isDoc(article.category) ? article.category : null
  const authors = docs(article.authors)

  const eyebrow = category ? (
    <Eyebrow href={href(locale, routes.category(category.slug))}>{category.title}</Eyebrow>
  ) : null

  const meta = (
    <p className="meta mt-3 flex flex-wrap items-center gap-x-2">
      {authors.length > 0 ? (
        <span>
          {t.by} {authors.map((a) => a.name).join(', ')}
        </span>
      ) : null}
      {authors.length > 0 ? <span aria-hidden="true">·</span> : null}
      <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time>
      {variant === 'lead' || variant === 'feature' ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {readingMinutes(article.body)} {t.minRead}
          </span>
        </>
      ) : null}
    </p>
  )

  const badge = article.isPlaceholder ? (
    <PlaceholderBadge label={t.placeholder} className="mb-2" />
  ) : null
  const headline = (size: string) => (
    <Heading className={`${size} mt-2`}>
      <Link href={url} className="story-link">
        {article.title}
      </Link>
    </Heading>
  )

  switch (variant) {
    case 'lead':
      return (
        <article className="story grid gap-6 lg:grid-cols-12 lg:gap-10">
          <div className="lg:order-2 lg:col-span-7">
            <MediaImage
              media={article.heroImage}
              ratio="3/2"
              sizes="(min-width: 1024px) 58vw, 100vw"
              priority={priority}
            />
          </div>
          <div className="flex flex-col justify-end lg:order-1 lg:col-span-5 lg:pb-2">
            {badge}
            {eyebrow}
            {headline('text-h1 md:text-display')}
            {article.deck ? (
              <p className="mt-5 font-text text-deck text-charcoal">{article.deck}</p>
            ) : null}
            {meta}
          </div>
        </article>
      )
    case 'feature':
      return (
        <article className="story">
          <MediaImage
            media={article.heroImage}
            ratio="3/2"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div className="mt-4">
            {badge}
            {eyebrow}
            {headline('text-h2')}
            {article.deck ? (
              <p className="mt-3 font-text text-deck text-charcoal">{article.deck}</p>
            ) : null}
            {meta}
          </div>
        </article>
      )
    case 'horizontal':
      return (
        <article className="story grid grid-cols-[1fr_7rem] gap-4 sm:grid-cols-[1fr_10rem] md:grid-cols-[12rem_1fr] md:gap-6">
          <div className="order-2 md:order-1">
            <MediaImage
              media={article.heroImage}
              ratio="4/3"
              sizes="(min-width: 768px) 12rem, 7rem"
            />
          </div>
          <div className="order-1 md:order-2">
            {badge}
            {eyebrow}
            {headline('text-h3')}
            {meta}
          </div>
        </article>
      )
    case 'text':
      return (
        <article className="story">
          {badge}
          {eyebrow}
          <Heading className="mt-1 font-display text-[1.1875rem] leading-snug">
            <Link href={url} className="story-link">
              {article.title}
            </Link>
          </Heading>
          {meta}
        </article>
      )
    default:
      return (
        <article className="story">
          <MediaImage
            media={article.heroImage}
            ratio="3/2"
            sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
          />
          <div className="mt-4">
            {badge}
            {eyebrow}
            {headline('text-h3')}
            {article.deck ? <p className="mt-2 line-clamp-3 text-slate">{article.deck}</p> : null}
            {meta}
          </div>
        </article>
      )
  }
}
