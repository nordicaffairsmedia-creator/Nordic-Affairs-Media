import Link from 'next/link'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { href } from '@/lib/site'
import { CartBadge } from './CartBadge'

export type HubView = 'discover' | 'cart' | 'tickets'

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
  const base = href(locale, '/events')
  const items: { view: HubView; label: string; to: string }[] = [
    { view: 'discover', label: t.hubDiscover, to: base },
    { view: 'cart', label: t.hubCart, to: `${base}?view=cart` },
    { view: 'tickets', label: t.hubMyTickets, to: href(locale, '/account') },
  ]
  return (
    <nav aria-label={t.myBookings} className="flex gap-6 overflow-x-auto border-b border-rule">
      {items.map((i) => (
        <Link
          key={i.view}
          href={i.to}
          aria-current={i.view === active ? 'page' : undefined}
          className={`-mb-px min-h-11 shrink-0 border-b-2 py-3 font-ui text-caption font-semibold ${
            i.view === active
              ? 'border-ink text-ink'
              : 'border-transparent text-slate hover:text-ink'
          }`}
        >
          {i.label}
          {i.view === 'cart' ? <CartBadge /> : null}
        </Link>
      ))}
    </nav>
  )
}
