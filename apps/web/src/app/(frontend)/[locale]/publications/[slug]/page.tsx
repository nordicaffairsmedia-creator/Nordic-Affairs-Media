import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPublicationBySlug } from '@/lib/listings'
import { docs, isDoc } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { buildMetadata } from '@/lib/seo'
import { href, routes, siteUrl } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'
import { JsonLd, SectionHeading } from '@/components/ui/primitives'
import { StoryCard } from '@/components/editorial/StoryCard'
import { ShareLinks } from '@/components/editorial/ShareLinks'
import { issueLabel } from '@/components/editorial/PublicationCard'

export const dynamicParams = true

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const pub = await getPublicationBySlug(locale, slug)
  if (!pub) return {}
  return buildMetadata({
    locale,
    path: routes.publication(pub.slug),
    title: pub.seo?.title || pub.title,
    description: pub.seo?.description || pub.description,
    image: pub.seo?.image ?? pub.cover,
    noIndex: Boolean(pub.seo?.noIndex || pub.isPlaceholder),
  })
}

/**
 * One issue: cover, details, the full PDF in the browser's built-in reader, the
 * stories from this issue that are also web articles, and contributors.
 * (A page-by-page reader with thumbnails is the optional "premium reader" add-on.)
 */
export default async function PublicationPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const pub = await getPublicationBySlug(locale, slug)
  if (!pub) notFound()

  const t = getDictionary(locale)
  const pdf = isDoc(pub.pdf) ? pub.pdf : null
  const articles = docs(pub.articles).filter((a) => a._status === 'published')
  const contributors = docs(pub.contributors)
  const url = `${siteUrl}/${locale}${routes.publication(pub.slug)}`

  return (
    <article className="pb-20">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'PublicationIssue',
          name: pub.title,
          issueNumber: pub.issueNumber ?? undefined,
          datePublished: pub.publishedAt ?? String(pub.year),
          url,
          isPartOf: { '@type': 'Periodical', name: 'Nordic Affairs Media' },
        }}
      />
      <header className="container-wide grid gap-10 pt-10 md:grid-cols-12 md:pt-16">
        <div className="mx-auto w-60 md:col-span-4 md:w-full">
          <div className="shadow-[0_24px_50px_-24px_rgb(0_0_0/0.45)]">
            <MediaImage
              media={pub.cover}
              ratio="2/3"
              sizes="(min-width: 768px) 24rem, 15rem"
              priority
            />
          </div>
        </div>
        <div className="md:col-span-7 md:col-start-6 md:self-end">
          {pub.isPlaceholder ? <PlaceholderBadge label={t.placeholder} className="mb-3" /> : null}
          <span className="eyebrow text-brass-text">{issueLabel(pub, t)}</span>
          <h1 className="mt-3 text-h1 md:text-display">{pub.title}</h1>
          {pub.publishedAt ? (
            <p className="meta mt-3">{formatDate(pub.publishedAt, locale)}</p>
          ) : null}
          {pub.description ? (
            <p className="mt-5 max-w-xl font-text text-deck text-charcoal">{pub.description}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            {pdf?.url ? (
              <>
                <a
                  href="#reader"
                  className="inline-flex min-h-11 items-center bg-ink px-5 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep"
                >
                  {t.viewPdf}
                </a>
                {pdf.allowDownload !== false ? (
                  <a
                    href={pdf.url}
                    download
                    className="inline-flex min-h-11 items-center border border-ink px-5 font-ui text-caption font-semibold text-ink hover:bg-ink hover:text-snow"
                  >
                    {t.downloadPdf}
                  </a>
                ) : null}
              </>
            ) : (
              <p className="meta border-l-2 border-brass pl-4">{t.pdfMissing}</p>
            )}
          </div>
          <div className="mt-8">
            <ShareLinks url={url} title={pub.title} label={t.share} />
          </div>
        </div>
      </header>

      {pdf?.url ? (
        <section id="reader" aria-label={t.viewPdf} className="container-max mt-16 scroll-mt-6">
          <SectionHeading title={t.viewPdf} />
          {/* The browser's own PDF reader gives zoom, page navigation, print and full-screen. */}
          <object
            data={`${pdf.url}#view=FitH`}
            type="application/pdf"
            aria-label={pub.title}
            className="h-[80vh] min-h-[32rem] w-full border border-rule bg-snow"
          >
            <p className="p-6">
              <a href={pdf.url} className="font-semibold text-fjord underline">
                {t.downloadPdf}
              </a>
            </p>
          </object>
        </section>
      ) : null}

      {articles.length > 0 ? (
        <section aria-label={t.inThisIssue} className="container-max mt-16">
          <SectionHeading title={t.inThisIssue} />
          <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <StoryCard key={a.id} article={a} locale={locale} t={t} variant="standard" />
            ))}
          </div>
        </section>
      ) : null}

      {contributors.length > 0 ? (
        <section aria-label={t.contributors} className="container-max mt-16">
          <SectionHeading title={t.contributors} />
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {contributors.map((c) => (
              <li key={c.id}>
                <Link
                  href={href(locale, routes.author(c.slug))}
                  className="font-ui text-body font-semibold hover:text-fjord"
                >
                  {c.name}
                </Link>
                {c.role ? <span className="meta ml-2">{c.role}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  )
}
