import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { listArticles, pageParam } from '@/lib/listings'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
import { StoryCard } from '@/components/editorial/StoryCard'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'

// Rendered on request so a new article shows up as soon as it is published.
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
  const result = await listArticles(locale, {}, page)
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
            {result.docs.map((a) => (
              <StoryCard key={a.id} article={a} locale={locale} t={t} variant="standard" headingLevel="h2" />
            ))}
          </div>
          <Pagination basePath={href(locale, '/articles')} page={page} totalPages={result.totalPages} t={t} />
        </>
      )}
    </div>
  )
}
