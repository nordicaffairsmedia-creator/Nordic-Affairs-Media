import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getAuthor, listArticles, pageParam } from '@/lib/listings'
import { buildMetadata } from '@/lib/seo'
import { href, routes, siteUrl } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'
import { JsonLd, SectionHeading } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'
import { StoryCard } from '@/components/editorial/StoryCard'
import { platformLabel } from '@/components/layout/SiteFooter'

// Rendered on request (filters/pages come from the URL); not pre-built.
export const dynamicParams = true

type Props = {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const author = await getAuthor(locale, slug)
  if (!author) return {}
  return buildMetadata({
    locale,
    path: routes.author(author.slug),
    title: author.name,
    description: author.bio,
    image: author.photo,
    noIndex: Boolean(author.isPlaceholder),
  })
}

/** Contributor profile (master prompt §13): photo, bio, expertise, links, and their stories. */
export default async function AuthorPage({ params, searchParams }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const author = await getAuthor(locale, slug)
  if (!author) notFound()

  const t = getDictionary(locale)
  const page = pageParam((await searchParams).page)
  const result = await listArticles(locale, { authorId: author.id }, page)
  const url = `${siteUrl}/${locale}${routes.author(author.slug)}`

  return (
    <div className="container-wide pb-20">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: author.name,
          url,
          ...(author.role ? { jobTitle: author.role } : {}),
          ...(author.socialLinks?.length ? { sameAs: author.socialLinks.map((s) => s.url) } : {}),
        }}
      />
      <header className="grid gap-8 border-b border-rule-strong pt-10 pb-10 md:grid-cols-12 md:pt-16">
        <div className="md:col-span-3">
          <div className="max-w-56">
            <MediaImage
              media={author.photo}
              ratio="4/5"
              sizes="14rem"
              fallbackLabel={author.name.slice(0, 1)}
            />
          </div>
        </div>
        <div className="md:col-span-8 md:col-start-5">
          {author.isPlaceholder ? (
            <PlaceholderBadge label={t.placeholder} className="mb-3" />
          ) : null}
          {author.role ? <span className="eyebrow text-brass-text">{author.role}</span> : null}
          <h1 className="mt-3 text-h1">{author.name}</h1>
          {author.bio ? (
            <p className="mt-5 max-w-2xl font-text text-deck text-charcoal">{author.bio}</p>
          ) : null}
          {author.expertise?.length ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {author.expertise.map((e) => (
                <li
                  key={e}
                  className="rounded-pill border border-rule px-3 py-1 font-ui text-meta text-charcoal"
                >
                  {e}
                </li>
              ))}
            </ul>
          ) : null}
          {author.socialLinks?.length ? (
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {author.socialLinks.map((s) => (
                <li key={s.id ?? s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="font-ui text-meta font-semibold text-fjord hover:underline"
                  >
                    {platformLabel[s.platform] ?? s.platform}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <section className="pt-10" aria-label={`${t.storiesBy} ${author.name}`}>
        <SectionHeading title={`${t.storiesBy} ${author.name}`} />
        {result.docs.length === 0 ? (
          <p className="text-slate">{t.noStories}</p>
        ) : (
          <ul className="grid gap-8 lg:grid-cols-2 lg:gap-x-12">
            {result.docs.map((a: any) => (
              <li key={a.id} className="border-t border-rule pt-6">
                <StoryCard
                  article={a}
                  locale={locale}
                  t={t}
                  variant="horizontal"
                  headingLevel="h2"
                />
              </li>
            ))}
          </ul>
        )}
        <Pagination
          basePath={href(locale, routes.author(author.slug))}
          page={page}
          totalPages={result.totalPages}
          t={t}
        />
      </section>
    </div>
  )
}
