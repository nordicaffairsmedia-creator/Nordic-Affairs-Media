import Link from 'next/link'
import type { Event } from '@/payload-types'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { isDoc } from '@/lib/payload'
import { formatEventDate, formatPrice } from '@/lib/format'
import { lowestPrice, ticketState, tierOnSale } from '@/lib/tickets'
import { href, routes } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'

/** Event teaser used on the front page and the events listing. */
export function EventCard({
  event,
  locale,
  t,
  muted = false,
}: {
  event: Event
  locale: Locale
  t: Dictionary
  muted?: boolean
}) {
  const date = formatEventDate(event.startsAt, locale)
  const venue = isDoc(event.venue) ? event.venue : null
  const openPrices = (event.tiers ?? []).filter((x) => tierOnSale(x)).map((x) => x.price)
  const from = openPrices.length ? Math.min(...openPrices) : lowestPrice(event)
  const where = [venue?.name, venue?.city].filter(Boolean).join(', ')
  const state = ticketState(event)

  return (
    <article className={`story ${muted ? 'opacity-75' : ''}`}>
      <Link href={href(locale, routes.event(event.slug))} className="block">
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
        <h3 className="mt-3 text-h3">
          <span className="story-link">{event.title}</span>
        </h3>
        <p className="meta mt-2">
          {event.startsAt ? <time dateTime={event.startsAt}>{date.full}</time> : date.full}
          {where ? ` · ${where}` : ` · ${t.venueTba}`}
        </p>
        {!muted ? (
          <p className="mt-3 font-ui text-caption font-semibold text-fjord">
            {state === 'onSale' && from !== null
              ? from === 0
                ? t.hubFree
                : `${t.from} ${formatPrice(from, event.currency, locale)}`
              : t[state]}
          </p>
        ) : null}
      </Link>
    </article>
  )
}
