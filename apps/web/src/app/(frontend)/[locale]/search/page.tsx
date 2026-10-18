import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Search } from 'lucide-react'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { listArticles, listEvents, listPublications, pageParam, textParam } from '@/lib/listings'
import { buildMetadata } from '@/lib/seo'
import { href, routes } from '@/lib/site'
import { StoryCard } from '@/components/editorial/StoryCard'
import { PublicationCard } from '@/components/editorial/PublicationCard'
import { EventCard } from '@/components/events/EventCard'
import { SectionHeading } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  // Result pages are thin by nature; keep them out of search engines.
  return buildMetadata({
    locale,
    path: routes.search(),
    title: getDictionary(locale).searchTitle,
    noIndex: true,
  })
}

/**
 * Site search across stories, upcoming events and issues (master prompt §17).
 * Runs on the server with a plain GET form, so it works without JavaScript.
 */
export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const sp = await searchParams
  const q = textParam(sp.q, 80)
  const page = pageParam(sp.page)
  const hasQuery = q.length >= 2

  const [articles, events, publications] = hasQuery
    ? await Promise.all([
        listArticles(locale, { query: q }, page),
        page === 1 ? listEvents(locale, { query: q }, 'upcoming', 1) : Promise.resolve(null),
        page === 1 ? listPublications(locale, null, 1, q) : Promise.resolve(null),
      ])
    : [null, null, null]

  const total =
    (articles?.totalDocs ?? 0) + (events?.totalDocs ?? 0) + (publications?.totalDocs ?? 0)

  return (
    <div className="container-wide pb-20">
      <header className="border-b border-rule-strong pt-10 pb-8 md:pt-16">
        <h1 className="text-h1">{t.searchTitle}</h1>
        <form method="get" role="search" className="mt-6 flex max-w-2xl border-b-2 border-ink">
          <label htmlFor="q" className="sr-only">
            {t.searchTitle}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            maxLength={80}
            className="min-h-14 flex-1 bg-transparent font-display text-h3 placeholder:text-mist focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex size-14 items-center justify-center text-ink hover:text-fjord"
          >
            <Search aria-hidden="true" className="size-6" />
            <span className="sr-only">{t.searchTitle}</span>
          </button>
        </form>
        {hasQuery ? (
          <p className="meta mt-4" role="status">
            {t.resultsFor} “{q}” · {total}
          </p>
        ) : null}
      </header>

      {hasQuery && total === 0 ? <p className="mt-12 font-display text-h3">{t.noResults}</p> : null}

      {events && events.docs.length > 0 ? (
        <section className="mt-12" aria-label={t.events}>
          <SectionHeading title={t.events} />
          <ul className="grid gap-8 md:grid-cols-3">
            {events.docs.slice(0, 3).map((e) => (
              <li key={e.id}>
                <EventCard event={e} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {articles && articles.docs.length > 0 ? (
        <section className="mt-12" aria-label={t.articles}>
          <SectionHeading title={t.articles} />
          <ul className="space-y-8">
            {articles.docs.map((a: any) => (
              <li key={a.id} className="border-t border-rule pt-6 first:border-0 first:pt-0">
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
          <Pagination
            basePath={href(locale, routes.search())}
            page={page}
            totalPages={articles.totalPages}
            params={{ q }}
            t={t}
          />
        </section>
      ) : null}

      {publications && publications.docs.length > 0 ? (
        <section className="mt-12" aria-label={t.publications}>
          <SectionHeading title={t.publications} />
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {publications.docs.slice(0, 4).map((p) => (
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
