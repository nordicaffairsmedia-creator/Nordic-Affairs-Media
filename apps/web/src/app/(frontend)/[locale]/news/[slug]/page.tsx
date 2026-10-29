import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { isLocale, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getArticleBySlug } from '@/lib/queries'
import { docs, isDoc } from '@/lib/payload'
import { formatDate, readingMinutes } from '@/lib/format'
import { buildMetadata } from '@/lib/seo'
import { href, routes, siteUrl } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'
import { Eyebrow, JsonLd, SectionHeading } from '@/components/ui/primitives'
import { StoryCard } from '@/components/editorial/StoryCard'
import { ShareLinks } from '@/components/editorial/ShareLinks'

type Params = { params: Promise<{ locale: string; slug: string }> }

// Articles are rendered on first visit, then cached (ISR via the layout's `revalidate`).
// No empty generateStaticParams: in Next.js 15.4 that turns unknown slugs into a bare 404.
export const dynamicParams = true

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const article = await getArticleBySlug(locale, slug)
  if (!article) return {}
  return buildMetadata({
    locale,
    path: routes.article(article.slug),
    title: article.seo?.title || article.title,
    description: article.seo?.description || article.deck,
    image: article.seo?.image ?? article.heroImage,
    type: 'article',
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    noIndex: Boolean(article.seo?.noIndex || article.isPlaceholder),
  })
}

export default async function ArticlePage({ params }: Params) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const article = await getArticleBySlug(locale, slug)
  if (!article) notFound()

  const t = getDictionary(locale)
  const category = isDoc(article.category) ? article.category : null
  const authors = docs(article.authors)
  const related = docs(article.relatedArticles)
    .filter((a) => a._status === 'published')
    .slice(0, 3)
  const hero = isDoc(article.heroImage) ? article.heroImage : null
  const video = isDoc(article.heroVideo) ? article.heroVideo : null
  const poster = video && isDoc(video.poster) ? video.poster : hero
  const url = `${siteUrl}/${locale}${routes.article(article.slug)}`
  const wasUpdated =
    new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime() >
    24 * 60 * 60 * 1000

  return (
    <article>
      <JsonLd data={articleJsonLd(article, locale, url, authors, hero?.url ?? null)} />
      <JsonLd data={breadcrumbJsonLd(locale, category, article.title, url)} />

      {/* Header */}
      <header className="container-wide pt-10 md:pt-16">
        <div className="mx-auto max-w-4xl text-center">
          {article.isPlaceholder ? (
            <PlaceholderBadge label={t.placeholder} className="mb-4" />
          ) : null}
          {category ? (
            <Eyebrow href={href(locale, routes.category(category.slug))}>{category.title}</Eyebrow>
          ) : null}
          <h1 className="mt-4 text-h1 md:text-display">{article.title}</h1>
          {article.deck ? (
            <p className="mx-auto mt-6 max-w-2xl font-text text-deck text-charcoal">
              {article.deck}
            </p>
          ) : null}
          <div className="meta mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {authors.length > 0 ? (
              <span>
                {t.by}{' '}
                {authors.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 ? ', ' : ''}
                    <Link
                      href={href(locale, routes.author(a.slug))}
                      className="font-semibold text-ink hover:underline"
                    >
                      {a.name}
                    </Link>
                  </span>
                ))}
              </span>
            ) : null}
            <span aria-hidden="true">·</span>
            <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time>
            {wasUpdated ? (
              <span>
                ({t.updated}{' '}
                <time dateTime={article.updatedAt}>{formatDate(article.updatedAt, locale)}</time>)
              </span>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>
              {readingMinutes(article.body)} {t.minRead}
            </span>
          </div>
        </div>
      </header>

      {/* Hero: a video file if the story has one, otherwise the main photo */}
      {video?.url ? (
        <figure className="container-max mt-10 md:mt-14">
          <video
            src={video.url}
            poster={poster?.url ?? undefined}
            controls
            playsInline
            preload="none"
            className="aspect-video w-full bg-ink"
          >
            <a href={video.url}>{video.title}</a>
          </video>
          {video.credit ? <figcaption className="meta mt-3">{video.credit}</figcaption> : null}
        </figure>
      ) : hero ? (
        <figure className="container-max mt-10 md:mt-14">
          <MediaImage
            media={hero}
            ratio="16/9"
            sizes="(min-width: 1440px) 1400px, 100vw"
            priority
          />
          {hero.caption || hero.credit ? (
            <figcaption className="meta mt-3 max-w-(--container-measure)">
              {hero.caption}
              {hero.credit ? <span className="ml-1 text-mist">{hero.credit}</span> : null}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {/* Body */}
      <div className="container-measure mt-12 md:mt-16">
        <RichText data={article.body} className="prose-article" />
        <div className="mt-12 border-t border-rule pt-6">
          <ShareLinks url={url} title={article.title} label={t.share} />
        </div>
      </div>

      {/* Related */}
      {related.length > 0 ? (
        <section aria-label={t.relatedStories} className="container-max mt-20 mb-16">
          <SectionHeading title={t.relatedStories} />
          <div className="grid gap-10 md:grid-cols-3">
            {related.map((a) => (
              <StoryCard key={a.id} article={a} locale={locale} t={t} variant="standard" />
            ))}
          </div>
        </section>
      ) : (
        <div className="mb-16" />
      )}
    </article>
  )
}

function articleJsonLd(
  article: { title: string; deck?: string | null; publishedAt: string; updatedAt: string },
  locale: Locale,
  url: string,
  authors: { name: string; slug: string }[],
  imageUrl: string | null,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.deck ?? undefined,
    inLanguage: locale,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: url,
    image: imageUrl ? [new URL(imageUrl, siteUrl).toString()] : undefined,
    author: authors.map((a) => ({
      '@type': 'Person',
      name: a.name,
      url: `${siteUrl}/${locale}/authors/${a.slug}`,
    })),
    publisher: { '@type': 'NewsMediaOrganization', name: 'Nordic Affairs Media', url: siteUrl },
  }
}

function breadcrumbJsonLd(
  locale: Locale,
  category: { title: string; slug: string } | null,
  title: string,
  url: string,
) {
  const items = [
    { name: 'Nordic Affairs Media', item: `${siteUrl}/${locale}` },
    ...(category
      ? [{ name: category.title, item: `${siteUrl}/${locale}${routes.category(category.slug)}` }]
      : []),
    { name: title, item: url },
  ]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
  }
}
