import { ApiWarmup } from '@/components/account/ApiWarmup'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { bookingApiUrl } from '@/lib/booking'
import { intlLocales } from '@/lib/format'
import { formatEventDate } from '@/lib/format'
import { getEventFilterOptions, pageParam, textParam } from '@/lib/listings'
import {
  dateRanges,
  listHubEvents,
  listHubHighlights,
  listHubMapEvents,
  type DateRange,
} from '@/lib/hubListings'
import { eventPlace } from '@/lib/eventLocation'
import { href } from '@/lib/site'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'
import { MyBookings } from '@/components/account/MyBookings'
import { AccountSections, type HubView } from '@/components/account/AccountSections'
import { HubEventCard } from '@/components/account/HubEventCard'
import { HubMap, type MapPoint } from '@/components/account/HubMap'
import { CartView } from '@/components/account/CartView'
import { buildMetadata } from '@/lib/seo'
import { routes } from '@/lib/site'
import { checkoutLabels } from '@/lib/checkoutLabels'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return buildMetadata({ locale, path: routes.events(), title: getDictionary(locale).concertsEvents })
}

const views: HubView[] = ['discover', 'cart', 'tickets']

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!isLocale(locale) || !bookingApiUrl) notFound()
  const t = getDictionary(locale)
  const sp = await searchParams
  const viewParam = textParam(sp.view) as HubView
  const view: HubView = views.includes(viewParam) ? viewParam : 'discover'

  const myBookings = (
    <MyBookings
      locale={locale}
      intlLocale={intlLocales[locale]}
      labels={{
        myBookingsIntro: t.myBookingsIntro,
        emailLabel: t.emailLabel,
        sendCode: t.sendCode,
        codeSent: t.codeSent,
        enterCode: t.enterCode,
        verify: t.verify,
        invalidCode: t.invalidCode,
        signOut: t.signOut,
        noBookings: t.noBookings,
        downloadTickets: t.downloadTickets,
        downloadReceipt: t.downloadReceipt,
        resendTickets: t.resendTickets,
        sent: t.sent,
        requestCancellation: t.requestCancellation,
        cancellationRequested: t.cancellationRequested,
        statusPaid: t.statusPaid,
        statusRefunded: t.statusRefunded,
        statusPartiallyRefunded: t.statusPartiallyRefunded,
        orderRef: t.orderRef,
        ticketsCount: t.ticketsCount,
        total: t.total,
        processing: t.processing,
        errGeneric: t.errGeneric,
      }}
    />
  )

  return (
    <div className="container-wide pb-20">
      <ApiWarmup />
      <PageHeader title={t.concertsEvents} />
      <div className="mt-6">
        <AccountSections locale={locale} t={t} active={view} />
      </div>
      <div className="mt-8">
        {view === 'discover' ? <Discover locale={locale} sp={sp} /> : null}
        {view === 'cart' ? (
          <CartView
            labels={checkoutLabels(t)}
            intlLocale={intlLocales[locale]}
            checkoutBase={href(locale, '/events')}
            browseHref={href(locale, '/events')}
          />
        ) : null}
        {view === 'tickets' ? myBookings : null}
      </div>
    </div>
  )
}

async function Discover({
  locale,
  sp,
}: {
  locale: Locale
  sp: Record<string, string | string[] | undefined>
}) {
  const t = getDictionary(locale)
  const page = pageParam(sp.page)
  const rangeParam = textParam(sp.range) as DateRange
  const range = dateRanges.includes(rangeParam) ? rangeParam : undefined
  const layout = textParam(sp.layout) === 'map' ? 'map' : 'list'
  const filter = {
    q: textParam(sp.q, 80) || undefined,
    city: textParam(sp.city) || undefined,
    categorySlug: textParam(sp.category) || undefined,
    range,
  }
  const filtering = Boolean(filter.q || filter.city || filter.categorySlug || filter.range)

  const [upcoming, options, highlights, mapEvents] = await Promise.all([
    listHubEvents(locale, filter, page),
    getEventFilterOptions(locale),
    !filtering && page === 1 ? listHubHighlights(locale) : Promise.resolve([]),
    layout === 'map' ? listHubMapEvents(locale, filter) : Promise.resolve([]),
  ])

  const base = href(locale, '/events')
  /** Builds a link that changes some filters and keeps the others. */
  const link = (change: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    const merged = { q: filter.q, city: filter.city, category: filter.categorySlug, range: filter.range, layout: layout === 'map' ? 'map' : undefined, ...change }
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v)
    const s = q.toString()
    return s ? `${base}?${s}` : base
  }

  const chip = (active: boolean) =>
    `inline-flex min-h-10 items-center border px-4 font-ui text-caption font-semibold ${active ? 'border-ink bg-ink text-snow' : 'border-rule text-ink hover:border-ink'}`
  const rangeLabel: Record<DateRange, string> = {
    today: t.hubToday,
    weekend: t.hubWeekend,
    nextweek: t.hubNextWeek,
    month: t.hubNext30,
    past: t.hubPastEvents,
  }

  const points: MapPoint[] = mapEvents.flatMap((e) => {
    const place = eventPlace(e)
    if (!place) return []
    return [
      {
        id: e.id,
        slug: e.slug,
        title: e.title,
        when: formatEventDate(e.startsAt, locale).full,
        where: [place.name, place.city].filter(Boolean).join(', '),
        lat: place.lat,
        lng: place.lng,
      },
    ]
  })

  return (
    <>
      <section aria-label={t.hubDiscover}>
        <h2 className="font-display text-h2">{t.hubNearYou}</h2>
        <p className="mt-2 text-charcoal">{t.hubIntro}</p>

        <form method="get" action={base} className="mt-6 grid gap-3 md:grid-cols-[2fr_1fr_auto]" role="search">
          {filter.range ? <input type="hidden" name="range" value={filter.range} /> : null}
          {filter.categorySlug ? <input type="hidden" name="category" value={filter.categorySlug} /> : null}
          {layout === 'map' ? <input type="hidden" name="layout" value="map" /> : null}
          <input
            type="search"
            name="q"
            defaultValue={filter.q ?? ''}
            maxLength={80}
            placeholder={t.hubSearchPlaceholder}
            aria-label={t.hubSearchPlaceholder}
            className="h-11 w-full border border-rule bg-snow px-4 font-ui text-body text-ink focus-visible:border-fjord"
          />
          <select name="city" defaultValue={filter.city ?? ''} aria-label={t.hubChooseCity} className="h-11 w-full border border-rule bg-snow px-3 font-ui text-caption text-ink focus-visible:border-fjord">
            <option value="">{t.hubAllCities}</option>
            {options.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="submit" className="h-11 bg-ink px-6 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep">
            {t.hubSearch}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t.date}>
          <Link href={link({ range: undefined, page: undefined })} className={chip(!filter.range)}>
            {t.hubAnyDate}
          </Link>
          {dateRanges.map((r) => (
            <Link key={r} href={link({ range: r })} className={chip(filter.range === r)} aria-current={filter.range === r ? 'true' : undefined}>
              {rangeLabel[r]}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.hubCategories}>
          <Link href={link({ category: undefined })} className={chip(!filter.categorySlug)}>
            {t.hubAllCategories}
          </Link>
          {options.categories.map((c) => (
            <Link key={c.slug} href={link({ category: c.slug })} className={chip(filter.categorySlug === c.slug)}>
              {c.title}
            </Link>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2" role="group" aria-label={`${t.hubList} / ${t.hubMap}`}>
            <Link href={link({ layout: undefined })} className={chip(layout === 'list')}>
              {t.hubList}
            </Link>
            <Link href={link({ layout: 'map' })} className={chip(layout === 'map')}>
              {t.hubMap}
            </Link>
          </div>
          {filtering ? (
            <Link href={base} className="font-ui text-meta font-semibold text-fjord hover:underline">
              {t.hubClear}
            </Link>
          ) : null}
        </div>
      </section>

      {highlights.length > 0 ? (
        <section className="mt-10" aria-label={t.hubComingUp}>
          <h2 className="font-display text-h3">{t.hubComingUp}</h2>
          <ul className="mt-4 grid gap-x-8 gap-y-10 md:grid-cols-3">
            {highlights.map((e) => (
              <li key={e.id}>
                <HubEventCard event={e} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-label={t.upcomingEvents}>
        {layout === 'map' ? (
          points.length > 0 ? (
            <>
              <HubMap points={points} locale={locale} viewLabel={t.hubViewDetails} />
              <p className="meta mt-2">{t.hubMapNote}</p>
            </>
          ) : (
            <EmptyState title={t.hubMap} body={t.hubMapEmpty} />
          )
        ) : null}
        <h2 className="mt-10 font-display text-h3">{t.upcomingEvents}</h2>
        <div className="mt-4">
          {upcoming.docs.length === 0 ? (
            <EmptyState title={filtering ? t.noResults : t.upcomingEvents} body={t.noEvents} />
          ) : (
            <ul className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.docs.map((e) => (
                <li key={e.id}>
                  <HubEventCard event={e} locale={locale} t={t} />
                </li>
              ))}
            </ul>
          )}
          <Pagination
            basePath={base}
            page={page}
            totalPages={upcoming.totalPages}
            params={{ q: filter.q, city: filter.city, category: filter.categorySlug, range: filter.range, layout: layout === 'map' ? 'map' : undefined }}
            t={t}
          />
        </div>
      </section>
    </>
  )
}
