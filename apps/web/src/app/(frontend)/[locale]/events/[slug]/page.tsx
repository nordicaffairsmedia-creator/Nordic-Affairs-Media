import type { Metadata } from 'next'
import Link from 'next/link'
import { eventPlace } from '@/lib/eventLocation'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { isLocale, localeMeta } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getEventBySlug } from '@/lib/queries'
import { isDoc } from '@/lib/payload'
import { formatEventDate, formatPrice, intlLocales } from '@/lib/format'
import { salesStatusKey, ticketBlock, ticketState, tierOnSale } from '@/lib/tickets'
import { bookingApiUrl } from '@/lib/booking'
import { href, routes, siteUrl } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'
import { ShareLinks } from '@/components/editorial/ShareLinks'
import { ApiWarmup } from '@/components/account/ApiWarmup'
import { MediaImage } from '@/components/ui/MediaImage'
import { Eyebrow, JsonLd, SectionHeading } from '@/components/ui/primitives'

export const dynamicParams = true

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const event = await getEventBySlug(locale, slug)
  if (!event) return {}
  return buildMetadata({
    locale,
    path: routes.event(event.slug),
    title: event.seo?.title || event.title,
    description: event.seo?.description || event.summary,
    image: event.seo?.image ?? event.poster,
    noIndex: Boolean(event.seo?.noIndex || event.isPlaceholder),
  })
}

/** Event details + tickets inside the My Booking hub. Same data and ticket picker as /events/[slug]. */
export default async function HubEventPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale) || !bookingApiUrl) notFound()
  const event = await getEventBySlug(locale, slug)
  if (!event) notFound()

  const t = getDictionary(locale)
  const date = formatEventDate(event.startsAt, locale)
  const venue = isDoc(event.venue) ? event.venue : null
  const category = isDoc(event.category) ? event.category : null
  const state = ticketState(event)
  const tiers = event.tiers ?? []
  const block = ticketBlock(event)
  const statusTone = event.salesStatus === 'onSale' || !event.salesStatus ? 'text-fjord' : 'text-alert'
  const organizer = isDoc(event.organizer) ? event.organizer : null
  const place = eventPlace(event)
  const fromPrice = tiers.filter((x) => tierOnSale(x)).reduce((m, x) => Math.min(m, x.price), Infinity)
  const pageUrl = `${siteUrl}/${locale}${routes.event(event.slug)}`
  const languages = (event.eventLanguage ?? []).filter(isLocale).map((l) => localeMeta[l].nativeLabel)

  return (
    <article className="pb-20">
      <ApiWarmup />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: event.title,
          description: event.summary ?? undefined,
          startDate: event.startsAt ?? undefined,
          endDate: event.endsAt ?? undefined,
          url: pageUrl,
          eventStatus:
            event.salesStatus === 'cancelled'
              ? 'https://schema.org/EventCancelled'
              : 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: venue
            ? {
                '@type': 'Place',
                name: venue.name,
                address: {
                  '@type': 'PostalAddress',
                  streetAddress: venue.address,
                  addressLocality: venue.city,
                  addressCountry: venue.country ?? 'SE',
                },
              }
            : undefined,
          organizer: { '@type': 'Organization', name: 'Nordic Affairs Media', url: siteUrl },
          offers: tiers.map((tier) => ({
            '@type': 'Offer',
            name: tier.name,
            price: tier.price,
            priceCurrency: event.currency,
            availability:
              tierOnSale(tier) && state === 'onSale'
                ? 'https://schema.org/InStock'
                : 'https://schema.org/SoldOut',
            url: pageUrl,
          })),
        }}
      />
      <div className="container-max pt-8">
        <Link
          href={href(locale, '/events')}
          className="inline-block font-ui text-meta font-semibold text-fjord hover:underline"
        >
          {t.hubBack}
        </Link>
      </div>
      <div className="container-max grid gap-10 pt-6 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <MediaImage media={event.poster} ratio="4/5" sizes="(min-width: 1024px) 40vw, 100vw" priority />
        </div>
        <div className="lg:col-span-7">
          {category ? <Eyebrow tone="brass">{category.title}</Eyebrow> : null}
          <h1 className="mt-3 text-h1 md:text-display">{event.title}</h1>
          {event.summary ? <p className="mt-5 font-text text-deck text-charcoal">{event.summary}</p> : null}

          <section id="tickets" aria-label={t.tickets} className="mt-8">
            <div className="border border-rule bg-snow p-5 sm:p-6">
              <p className="font-ui text-caption text-slate">
                {t.salesStatusLabel}:{' '}
                <strong data-testid="sales-status" className={`font-semibold ${statusTone}`}>
                  {t[salesStatusKey(event)]}
                </strong>
              </p>
              {tiers.length > 0 ? (
                <ul className="mt-4 divide-y divide-rule border-y border-rule">
                  {tiers.map((tier) => {
                    const available = state === 'onSale' && tierOnSale(tier)
                    return (
                      <li key={tier.tierId} className="flex items-baseline justify-between gap-6 py-3">
                        <p className="font-ui text-body font-semibold">{tier.name}</p>
                        <div className="text-right">
                          <p className="font-display text-h3">
                            {tier.price === 0 ? t.hubFree : formatPrice(tier.price, event.currency, locale)}
                          </p>
                          <p className={`meta ${available ? '' : 'text-alert'}`}>
                            {available ? t.incVat : state === 'onSale' ? t.soldOut : t[state]}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
              {!block && tiers.length > 0 ? (
                <>
                  <p className="mt-4 font-ui text-body">
                    <span className="text-slate">{t.hubFrom}</span>{' '}
                    <span data-testid="from-price" className="font-display text-h3">
                      {fromPrice === 0 ? t.hubFree : formatPrice(fromPrice, event.currency, locale)}
                    </span>
                  </p>
                  <Link
                    href={href(locale, `/events/${event.slug}/tickets`)}
                    data-testid="get-tickets"
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center bg-fjord px-6 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep"
                  >
                    {t.hubGetTickets}
                  </Link>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    data-testid="get-tickets"
                    className="mt-4 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center bg-fjord px-6 font-ui text-caption font-semibold text-snow opacity-40"
                  >
                    {t.hubGetTickets}
                  </button>
                  <p data-testid="ticket-block-reason" className="mt-3 font-ui text-caption font-semibold text-alert">
                    {t[block ?? 'hubReasonNoTiers']}
                  </p>
                </>
              )}
            </div>
          </section>
          <dl className="mt-6 space-y-5 border border-rule bg-snow p-5 sm:p-6">
            {venue || place ? (
              <div>
                <dt className="font-ui text-caption font-semibold">{t.hubLocation}</dt>
                <dd className="mt-2 font-ui text-body text-charcoal">
                  <span className="block">{place?.name || venue?.name}</span>
                  <span className="block whitespace-pre-line">{place?.address || venue?.address || venue?.city}</span>
                </dd>
              </div>
            ) : null}
            <div className="border-t border-rule pt-5">
              <dt className="font-ui text-caption font-semibold">{t.date}</dt>
              <dd className="mt-2 font-ui text-body text-charcoal">
                {event.startsAt ? <time dateTime={event.startsAt}>{date.full}</time> : date.full}
              </dd>
            </div>
            {organizer ? (
              <div className="border-t border-rule pt-5">
                <dt className="font-ui text-caption font-semibold">{t.organizer}</dt>
                <dd className="mt-2 font-ui text-body text-charcoal">{organizer.name}</dd>
              </div>
            ) : null}
            {languages.length ? (
              <div className="border-t border-rule pt-5">
                <dt className="font-ui text-caption font-semibold">{t.eventLanguage}</dt>
                <dd className="mt-2 font-ui text-body text-charcoal">{languages.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6">
            <ShareLinks url={pageUrl} title={event.title} label={t.shareEvent} />
          </div>
        </div>
      </div>
      {venue || place ? (
        <section className="container-max mt-14" aria-label={t.venue}>
          <SectionHeading title={t.venue} as="h2" />
          <p className="font-ui text-body font-semibold">{place?.name || venue?.name}</p>
          <p className="meta mt-1 whitespace-pre-line">{place?.address || venue?.address}</p>
          {venue?.accessInfo ? <p className="mt-3 max-w-prose text-caption text-charcoal">{venue.accessInfo}</p> : null}
          {place ? (
            <>
              <iframe
                title={place.name || event.title}
                loading="lazy"
                className="mt-4 h-72 w-full max-w-3xl border border-rule"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${place.lng - 0.006}%2C${place.lat - 0.004}%2C${place.lng + 0.006}%2C${place.lat + 0.004}&layer=mapnik&marker=${place.lat}%2C${place.lng}`}
              />
              <a
                href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=16/${place.lat}/${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-ui text-meta font-semibold text-fjord hover:underline"
              >
                {t.getDirections}
              </a>
            </>
          ) : venue?.mapUrl ? (
            <a href={venue.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-ui text-meta font-semibold text-fjord hover:underline">
              {t.getDirections}
            </a>
          ) : null}
        </section>
      ) : null}
      {event.description ? (
        <div className="container-max mt-14 lg:max-w-3xl">
          <RichText data={event.description} className="prose-article" />
        </div>
      ) : null}
    </article>
  )
}
