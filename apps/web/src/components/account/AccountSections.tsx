import Link from 'next/link'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { href } from '@/lib/site'

export type HubView = 'discover' | 'tickets'

/** Two in-page sections of the My Booking hub: browse events, and your own tickets. */
export function AccountSections({
  locale,
  t,
  active,
}: {
  locale: Locale
  t: Dictionary
  active: HubView
}) {
  const items: { view: HubView; label: string; to: string }[] = [
    { view: 'discover', label: t.hubDiscover, to: href(locale, '/account') },
    { view: 'tickets', label: t.hubMyTickets, to: `${href(locale, '/account')}?view=tickets` },
  ]
  return (
    <nav aria-label={t.myBookings} className="flex gap-6 border-b border-rule">
      {items.map((i) => (
        <Link
          key={i.view}
          href={i.to}
          aria-current={i.view === active ? 'page' : undefined}
          className={`-mb-px min-h-11 border-b-2 py-3 font-ui text-caption font-semibold ${
            i.view === active
              ? 'border-ink text-ink'
              : 'border-transparent text-slate hover:text-ink'
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  )
}
