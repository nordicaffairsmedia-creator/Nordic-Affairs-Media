import type { Event } from '@/payload-types'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { href, routes } from '@/lib/site'
import { SectionHeading } from '@/components/ui/primitives'
import { EventCard } from './EventCard'

/** Upcoming events on the front page — the bridge between the magazine and the box office. */
export function EventStrip({
  events,
  locale,
  t,
}: {
  events: Event[]
  locale: Locale
  t: Dictionary
}) {
  if (!events.length) return null
  return (
    <section aria-label={t.upcomingEvents} className="bg-snow">
      <div className="container-max py-12 md:py-16">
        <SectionHeading
          title={t.upcomingEvents}
          href={href(locale, routes.events())}
          linkLabel={t.allEvents}
        />
        <ul className="grid gap-8 md:grid-cols-3">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
