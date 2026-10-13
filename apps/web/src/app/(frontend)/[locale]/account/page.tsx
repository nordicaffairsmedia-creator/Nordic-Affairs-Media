import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/i18n/getDictionary'
import { bookingApiUrl } from '@/lib/booking'
import { intlLocales } from '@/lib/format'
import { isLocale, localeMeta, locales } from '@/i18n/config'
import { getEventFilterOptions, listEvents, pageParam, textParam } from '@/lib/listings'
import { href } from '@/lib/site'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'
import { MyBookings } from '@/components/account/MyBookings'
import { AccountSections } from '@/components/account/AccountSections'
import { HubEventCard } from '@/components/account/HubEventCard'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return { title: getDictionary(locale).myBookings, robots: { index: false, follow: false } }
}

export default async function AccountPage({
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
  const view = textParam(sp.view) === 'tickets' ? 'tickets' : 'discover'

  const page = pageParam(sp.page)
  const filter = {
    city: textParam(sp.city) || undefined,
    categorySlug: textParam(sp.category) || undefined,
    language: (locales as readonly string[]).includes(textParam(sp.lang))
      ? textParam(sp.lang)
      : undefined,
  }
  const [upcoming, options] =
    view === 'discover'
      ? await Promise.all([
          listEvents(locale, filter, 'upcoming', page),
          getEventFilterOptions(locale),
        ])
      : [null, null]
  const filtering = Boolean(filter.city || filter.categorySlug || filter.language)
  const selectCls =
    'h-10 w-auto max-w-full border border-rule bg-snow px-3 font-ui text-caption text-ink focus-visible:border-fjord'

  return (
    <div className="container-wide pb-20">
      <PageHeader title={t.myBookings} />
      <div className="mt-6">
        <AccountSections locale={locale} t={t} active={view} />
      </div>
      {view === 'discover' && upcoming && options ? (
        <section className="mt-8" aria-label={t.hubDiscover}>
          <p className="text-charcoal">{t.hubIntro}</p>
          <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
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
              <select
                name="category"
                defaultValue={filter.categorySlug ?? ''}
                className={selectCls}
              >
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
          <div className="pt-8">
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
              basePath={href(locale, '/account')}
              page={page}
              totalPages={upcoming.totalPages}
              params={{ city: filter.city, category: filter.categorySlug, lang: filter.language }}
              t={t}
            />
          </div>
        </section>
      ) : (
        <div className="mt-10">
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
        </div>
      )}
    </div>
  )
}
