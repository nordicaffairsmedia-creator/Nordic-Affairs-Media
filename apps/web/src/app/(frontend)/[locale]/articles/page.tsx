import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { listArticlesCached, listPublicationsCached, pageParam } from '@/lib/listings'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
import { StoryCard } from '@/components/editorial/StoryCard'
import { PublicationCard } from '@/components/editorial/PublicationCard'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'

// The list itself is cached for two minutes and refreshed the moment an article is published.
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return buildMetadata({ locale, path: '/articles', title: t.navArticles, description: t.articlesIntro })
}

/** "Articles" tab: every published article, newest first. */
export default async function ArticlesPage({ params, searchParams }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const page = pageParam((await searchParams).page)
  const [result, issues] = await Promise.all([
    listArticlesCached(locale, page),
    page === 1 ? listPublicationsCached(locale) : Promise.resolve([]),
  ])
  if (page > 1 && result.docs.length === 0) notFound()

  return (
    <div className="container-max pb-20">
      <PageHeader title={t.navArticles} intro={t.articlesIntro} />
      {result.docs.length === 0 ? (
        <div className="mt-12">
          <EmptyState title={t.emptyArticlesTitle} body={t.emptyArticlesBody} />
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {result.docs.map((a: any) => (
              <StoryCard key={a.id} article={a} locale={locale} t={t} variant="standard" headingLevel="h2" />
            ))}
          </div>
          <Pagination basePath={href(locale, '/articles')} page={page} totalPages={result.totalPages} t={t} />
        </>
      )}
      {issues.length > 0 ? (
        <section id="publications" className="scroll-mt-24 pt-16">
          <h2 className="text-h2">{t.publications}</h2>
          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-5">
            {issues.map((p: any) => (
              <li key={p.id}>
                <PublicationCard publication={p} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
