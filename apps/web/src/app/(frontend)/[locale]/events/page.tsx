import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale, localeMeta, locales } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getEventFilterOptions, listEvents, pageParam, textParam } from '@/lib/listings'
import { buildMetadata } from '@/lib/seo'
import { href, routes } from '@/lib/site'
import { EventCard } from '@/components/events/EventCard'
import { EmptyState, PageHeader, SectionHeading } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return buildMetadata({ locale, path: routes.events(), title: t.events })
}

/** Events listing with date order and filters by city, category and language (PRD W-05). */
export default async function EventsPage({ params, searchParams }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const sp = await searchParams
  const page = pageParam(sp.page)
  const filter = {
    city: textParam(sp.city) || undefined,
    categorySlug: textParam(sp.category) || undefined,
    language: (locales as readonly string[]).includes(textParam(sp.lang))
      ? textParam(sp.lang)
      : undefined,
  }

  const [upcoming, past, options] = await Promise.all([
    listEvents(locale, filter, 'upcoming', page),
    page === 1 ? listEvents(locale, filter, 'past', 1) : Promise.resolve(null),
    getEventFilterOptions(locale),
  ])
  const filtering = Boolean(filter.city || filter.categorySlug || filter.language)
  const selectCls =
    'h-10 w-auto max-w-full border border-rule bg-snow px-3 font-ui text-caption text-ink focus-visible:border-fjord'

  return (
    <div className="container-max pb-20">
      <PageHeader eyebrow="Nordic Affairs Media" title={t.upcomingEvents}>
        <form
          method="get"
          className="mt-8 flex flex-wrap items-end justify-end gap-3"
        >
          <label className="block w-auto">
            <span className="meta mb-1 block">{t.city}</span>
            <select name="city" defaultValue={filter.city ?? ''} className={selectCls}>
              <option value="">{t.all}</option>
              {options.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block w-auto">
            <span className="meta mb-1 block">{t.category}</span>
            <select name="category" defaultValue={filter.categorySlug ?? ''} className={selectCls}>
              <option value="">{t.all}</option>
              {options.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block w-auto">
            <span className="meta mb-1 block">{t.eventLanguage}</span>
            <select name="lang" defaultValue={filter.language ?? ''} className={selectCls}>
              <option value="">{t.all}</option>
              {locales.map((l) => (
                <option key={l} value={l}>
                  {localeMeta[l].nativeLabel}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-10 bg-ink px-5 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep"
          >
            {t.filter}
          </button>
        </form>
      </PageHeader>

      <section className="pt-10" aria-label={t.upcomingEvents}>
        {upcoming.docs.length === 0 ? (
          <EmptyState title={filtering ? t.noResults : t.upcomingEvents} body={t.noEvents} />
        ) : (
          <ul className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.docs.map((e) => (
              <li key={e.id}>
                <EventCard event={e} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        )}
        <Pagination
          basePath={href(locale, routes.events())}
          page={page}
          totalPages={upcoming.totalPages}
          params={{ city: filter.city, category: filter.categorySlug, lang: filter.language }}
          t={t}
        />
      </section>

      {past && past.docs.length > 0 ? (
        <section className="mt-20" aria-label={t.pastEvents}>
          <SectionHeading title={t.pastEvents} />
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {past.docs.map((e) => (
              <li key={e.id}>
                <EventCard event={e} locale={locale} t={t} muted />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
