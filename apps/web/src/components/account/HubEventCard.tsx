import Link from 'next/link'
import type { Event } from '@/payload-types'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { isDoc } from '@/lib/payload'
import { formatEventDate, formatPrice } from '@/lib/format'
import { lowestPrice, salesStatusKey, ticketBlock, ticketState } from '@/lib/tickets'
import { href } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'

/** Event card for the My Booking hub: poster, date, venue, category, "from" price, status. */
export function HubEventCard({ event, locale, t }: { event: Event; locale: Locale; t: Dictionary }) {
  const date = formatEventDate(event.startsAt, locale)
  const venue = isDoc(event.venue) ? event.venue : null
  const category = isDoc(event.category) ? event.category : null
  const from = lowestPrice(event)
  const state = ticketState(event)
  const detail = href(locale, `/events/${event.slug}`)

  return (
    <article className="story relative">
      <Link href={detail} className="block">
        <div className="relative">
          <MediaImage
            media={event.poster}
            ratio="4/5"
            fit="contain"
            sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
          />
          <div className="absolute bottom-0 left-0 bg-paper px-3 py-2 text-center">
            <span className="block font-display text-h3 leading-none">{date.day}</span>
            <span className="eyebrow text-brass-text">{date.month}</span>
          </div>
        </div>
        {event.isPlaceholder ? <PlaceholderBadge label={t.placeholder} className="mt-3" /> : null}
        {category ? <p className="eyebrow mt-3 text-brass-text">{category.title}</p> : null}
        <h3 className="mt-1 text-h3">
          <span className="story-link">{event.title}</span>
        </h3>
        <p className="meta mt-2">
          {event.startsAt ? <time dateTime={event.startsAt}>{date.full}</time> : date.full}
          {venue ? ` · ${venue.name}, ${venue.city}` : ''}
        </p>
        <p className="mt-3 font-ui text-meta text-slate">
          {t.salesStatusLabel}:{' '}
          <strong className={event.salesStatus === 'onSale' || !event.salesStatus ? 'text-fjord' : 'text-alert'}>
            {t[salesStatusKey(event)]}
          </strong>
        </p>
        <p className={`mt-1 font-ui text-caption font-semibold ${state === 'onSale' ? 'text-fjord' : 'text-alert'}`}>
          {state === 'onSale' && from !== null
            ? `${t.from} ${formatPrice(from, event.currency, locale)}`
            : ticketBlock(event)
              ? t[ticketBlock(event)!]
              : t[state]}
        </p>
      </Link>
    </article>
  )
}
