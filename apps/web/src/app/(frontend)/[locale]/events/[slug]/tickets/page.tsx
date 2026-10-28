import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getEventBySlug } from '@/lib/queries'
import { getPayloadClient } from '@/lib/payload'
import { formatEventDate, intlLocales } from '@/lib/format'
import { ticketState } from '@/lib/tickets'
import { bookingApiUrl } from '@/lib/booking'
import { checkoutLabels } from '@/lib/checkoutLabels'
import { href } from '@/lib/site'
import { CheckoutFlow } from '@/components/account/CheckoutFlow'

export const dynamicParams = true

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const event = await getEventBySlug(locale, slug)
  return { title: event ? `${event.title} · ${getDictionary(locale).hubGetTickets}` : getDictionary(locale).concertsEvents, robots: { index: false, follow: false } }
}

/** "Get tickets": the four-step checkout (tickets, buyer, services, payment) inside My Booking. */
export default async function HubTicketsPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale) || !bookingApiUrl) notFound()
  const event = await getEventBySlug(locale, slug)
  if (!event) notFound()
  const eventHref = href(locale, `/events/${slug}`)
  // Not on sale (sold out, cancelled, date not set…): the event page explains why.
  if (ticketState(event) !== 'onSale' || !(event.tiers ?? []).length) redirect(eventHref)

  const t = getDictionary(locale)
  // Swish button: Platform settings > Feature switches > swish (off until Stripe has Swish active).
  const swish = await getPayloadClient()
    .then((payload) => payload.findGlobal({ slug: 'platform-settings', depth: 0, overrideAccess: true }))
    .then((platform) => Boolean(platform.features?.swish))
    .catch(() => false)
  return (
    <div className="container-max pb-20 pt-8">
      <CheckoutFlow
        event={{
          id: event.id,
          slug: event.slug,
          title: event.title,
          currency: event.currency,
          tiers: (event.tiers ?? []).map((tier) => ({
            tierId: tier.tierId,
            name: tier.name,
            description: tier.description,
            price: tier.price,
          })),
        }}
        locale={locale}
        intlLocale={intlLocales[locale]}
        termsHref={href(locale, '/terms')}
        privacyHref={href(locale, '/privacy')}
        cartHref={href(locale, '/events?view=cart')}
        eventHref={eventHref}
        dateLabel={formatEventDate(event.startsAt, locale).full}
        labels={checkoutLabels(t)}
        swish={swish}
      />
    </div>
  )
}
