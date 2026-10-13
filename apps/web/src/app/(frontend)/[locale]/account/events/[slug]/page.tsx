import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { isLocale, localeMeta } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getEventBySlug } from '@/lib/queries'
import { isDoc } from '@/lib/payload'
import { formatEventDate, formatPrice, intlLocales } from '@/lib/format'
import { ticketState, tierOnSale } from '@/lib/tickets'
import { bookingApiUrl, bookingLabels } from '@/lib/booking'
import { TicketPicker } from '@/components/events/TicketPicker'
import { href } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { Eyebrow, SectionHeading } from '@/components/ui/primitives'

export const dynamicParams = true

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const event = await getEventBySlug(locale, slug)
  return { title: event?.title ?? getDictionary(locale).myBookings, robots: { index: false, follow: false } }
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
  const languages = (event.eventLanguage ?? []).filter(isLocale).map((l) => localeMeta[l].nativeLabel)

  return (
    <article className="pb-20">
      <div className="container-max pt-8">
        <Link
          href={href(locale, '/account')}
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

          <section id="tickets" aria-label={t.tickets} className="mt-10">
            <SectionHeading title={t.tickets} />
            {state === 'onSale' && tiers.length > 0 ? (
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
                returnTo="account"
              />
            ) : (
              <>
                {tiers.length > 0 ? (
                  <ul className="divide-y divide-rule border-b border-rule">
                    {tiers.map((tier) => {
                      const available = state === 'onSale' && tierOnSale(tier)
                      return (
                        <li key={tier.tierId} className="flex items-baseline justify-between gap-6 py-4">
                          <p className="font-ui text-body font-semibold">{tier.name}</p>
                          <div className="text-right">
                            <p className="font-display text-h3">{formatPrice(tier.price, event.currency, locale)}</p>
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
      {event.description ? (
        <div className="container-max mt-14 lg:max-w-3xl">
          <RichText data={event.description} className="prose-article" />
        </div>
      ) : null}
    </article>
  )
}
