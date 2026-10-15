import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getCategory, listArticles, pageParam } from '@/lib/listings'
import { buildMetadata } from '@/lib/seo'
import { href, routes } from '@/lib/site'
import { StoryCard } from '@/components/editorial/StoryCard'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'

// Rendered on request (filters/pages come from the URL); not pre-built.
export const dynamicParams = true

type Props = {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const category = await getCategory(locale, slug)
  if (!category) return {}
  const page = pageParam((await searchParams).page)
  return buildMetadata({
    locale,
    path: routes.category(category.slug),
    title: page > 1 ? `${category.title} — ${page}` : category.title,
    description: category.description,
  })
}

/** Category page: the newest story large, then a grid, then pages of older stories. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const category = await getCategory(locale, slug)
  if (!category) notFound()

  const t = getDictionary(locale)
  const page = pageParam((await searchParams).page)
  const result = await listArticles(locale, { categoryId: category.id }, page)
  if (page > 1 && result.docs.length === 0) notFound()

  const [first, ...rest] = result.docs
  const showLead = page === 1 && first

  return (
    <div className="container-max pb-20">
      <PageHeader eyebrow={t.category} title={category.title} intro={category.description} />

      {result.docs.length === 0 ? (
        <div className="mt-12">
          <EmptyState title={t.noStories} body={t.emptyHomeBody} />
        </div>
      ) : (
        <>
          {showLead ? (
            <div className="py-10 md:py-14">
              <StoryCard
                article={showLead}
                locale={locale}
                t={t}
                variant="lead"
                priority
                headingLevel="h2"
              />
            </div>
          ) : null}
          <div className="grid gap-x-8 gap-y-12 border-t border-rule pt-10 md:grid-cols-2 lg:grid-cols-3">
            {(showLead ? rest : result.docs).map((a) => (
              <StoryCard
                key={a.id}
                article={a}
                locale={locale}
                t={t}
                variant="standard"
                headingLevel="h2"
              />
            ))}
          </div>
          <Pagination
            basePath={href(locale, routes.category(category.slug))}
            page={page}
            totalPages={result.totalPages}
            t={t}
          />
        </>
      )}
    </div>
  )
}
