import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'
import { isLocale, localeMeta } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getEventBySlug } from '@/lib/queries'
import { isDoc } from '@/lib/payload'
import { formatEventDate, formatPrice, intlLocales } from '@/lib/format'
import { ticketState, tierOnSale } from '@/lib/tickets'
import { bookingApiUrl, bookingLabels } from '@/lib/booking'
import { TicketPicker } from '@/components/events/TicketPicker'
import { ShareLinks } from '@/components/editorial/ShareLinks'
import { buildMetadata } from '@/lib/seo'
import { href, routes, siteUrl } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'
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

/** Event page (PRD W-06): poster, trailer, venue, line-up and ticket tiers. */
export default async function EventPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const event = await getEventBySlug(locale, slug)
  if (!event) notFound()

  const t = getDictionary(locale)
  const date = formatEventDate(event.startsAt, locale)
  const venue = isDoc(event.venue) ? event.venue : null
  const category = isDoc(event.category) ? event.category : null
  const state = ticketState(event)
  const tiers = event.tiers ?? []
  const url = `${siteUrl}/${locale}${routes.event(event.slug)}`
  const poster = isDoc(event.poster) ? event.poster : null
  const languages = (event.eventLanguage ?? [])
    .filter(isLocale)
    .map((l) => localeMeta[l].nativeLabel)

  return (
    <article className="pb-20">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: event.title,
          description: event.summary ?? undefined,
          startDate: event.startsAt ?? undefined,
          endDate: event.endsAt ?? undefined,
          url,
          eventStatus:
            event.salesStatus === 'cancelled'
              ? 'https://schema.org/EventCancelled'
              : 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          image: poster?.url ? [new URL(poster.url, siteUrl).toString()] : undefined,
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
            url,
          })),
        }}
      />

      <div className="container-max grid gap-10 pt-10 md:pt-14 lg:grid-cols-12 lg:gap-14">
        {/* Poster */}
        <div className="lg:col-span-5">
          <MediaImage
            media={event.poster}
            ratio="4/5"
            sizes="(min-width: 1024px) 40vw, 100vw"
            priority
          />
          {event.trailerUrl ? (
            <a
              href={event.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-2 font-ui text-caption font-semibold text-fjord hover:underline"
            >
              ▶ {t.watchTrailer}
            </a>
          ) : null}
        </div>

        {/* Details */}
        <div className="lg:col-span-7">
          {event.isPlaceholder ? <PlaceholderBadge label={t.placeholder} className="mb-3" /> : null}
          {category ? <Eyebrow tone="brass">{category.title}</Eyebrow> : null}
          <h1 className="mt-3 text-h1 md:text-display">{event.title}</h1>
          {event.summary ? (
            <p className="mt-5 font-text text-deck text-charcoal">{event.summary}</p>
          ) : null}

          <dl className="mt-8 grid gap-4 border-y border-rule py-6 sm:grid-cols-2">
            <div>
              <dt className="eyebrow text-slate">{t.date}</dt>
              <dd className="mt-1 font-ui text-body font-semibold">
                {event.startsAt ? <time dateTime={event.startsAt}>{date.full}</time> : date.full}
              </dd>
            </div>
            {venue ? (
              <div>
                <dt className="eyebrow text-slate">{t.venue}</dt>
                <dd className="mt-1 font-ui text-body">
                  <span className="font-semibold">{venue.name}</span>, {venue.city}
                  {venue.mapUrl ? (
                    <a
                      href={venue.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-meta text-fjord underline"
                    >
                      {t.getDirections}
                    </a>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {languages.length ? (
              <div>
                <dt className="eyebrow text-slate">{t.eventLanguage}</dt>
                <dd className="mt-1 font-ui text-body">{languages.join(', ')}</dd>
              </div>
            ) : null}
          </dl>

          {/* Tickets */}
          <section id="tickets" aria-label={t.tickets} className="mt-10">
            <SectionHeading title={t.tickets} />
            {state === 'onSale' && bookingApiUrl && tiers.length > 0 ? (
              <TicketPicker
                eventId={event.id}
                tiers={tiers.map((tier) => ({
                  tierId: tier.tierId,
                  name: tier.name,
                  description: tier.description,
                  price: tier.price,
                }))}
                currency={event.currency}
                locale={locale}
                intlLocale={intlLocales[locale]}
                termsHref={href(locale, '/terms')}
                privacyHref={href(locale, '/privacy')}
                labels={bookingLabels(t)}
              />
            ) : (
              <>
                {tiers.length > 0 ? (
                  <ul className="divide-y divide-rule border-b border-rule">
                    {tiers.map((tier) => {
                      const available = state === 'onSale' && tierOnSale(tier)
                      return (
                        <li
                          key={tier.tierId}
                          className="flex items-baseline justify-between gap-6 py-4"
                        >
                          <div>
                            <p className="font-ui text-body font-semibold">{tier.name}</p>
                            {tier.description ? (
                              <p className="meta mt-0.5">{tier.description}</p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="font-display text-h3">
                              {formatPrice(tier.price, event.currency, locale)}
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
                <p className="mt-6 font-ui text-caption font-semibold text-alert">
                  {state === 'onSale' ? t.bookingSoon : t[state]}
                </p>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Description + line-up + venue info */}
      <div className="container-max mt-16 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {event.description ? (
            <RichText data={event.description} className="prose-article" />
          ) : null}
        </div>
        <aside className="space-y-10 lg:col-span-4 lg:col-start-9">
          {event.lineup?.length ? (
            <div>
              <SectionHeading title={t.lineup} as="h2" />
              <ul className="space-y-3">
                {event.lineup.map((p) => (
                  <li key={p.id ?? p.name}>
                    <p className="font-ui text-body font-semibold">{p.name}</p>
                    {p.role ? <p className="meta">{p.role}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {venue ? (
            <div>
              <SectionHeading title={t.venue} as="h2" />
              <p className="font-ui text-body font-semibold">{venue.name}</p>
              <p className="meta mt-1 whitespace-pre-line">{venue.address}</p>
              {venue.accessInfo ? (
                <p className="mt-3 text-caption text-charcoal">{venue.accessInfo}</p>
              ) : null}
            </div>
          ) : null}
          <ShareLinks url={url} title={event.title} label={t.shareEvent} />
          <Link
            href={href(locale, routes.events())}
            className="inline-block font-ui text-meta font-semibold text-fjord hover:underline"
          >
            ← {t.allEvents}
          </Link>
        </aside>
      </div>
    </article>
  )
}
