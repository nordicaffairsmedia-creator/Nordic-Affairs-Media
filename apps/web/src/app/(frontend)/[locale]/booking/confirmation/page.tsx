import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { bookingApiUrl } from '@/lib/booking'
import { formatMinor, type PublicOrder } from '@/lib/bookingTypes'
import { formatEventDate, intlLocales } from '@/lib/format'
import { textParam } from '@/lib/listings'
import { href, routes } from '@/lib/site'
import { RememberOrder } from '@/components/account/RememberOrder'
import { ClearCart } from '@/components/account/ClearCart'
import { TicketImage } from '@/components/account/TicketImage'

// Personal page: never cached, never indexed.
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function loadOrder(ref: string, token: string, fresh = false): Promise<PublicOrder | null> {
  if (!bookingApiUrl || !ref || !token) return null
  const res = await fetch(
    `${bookingApiUrl}/orders/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}${fresh ? `&r=${Date.now()}` : ''}`,
    {
      cache: 'no-store',
      // Server-to-server: lets the API tell this page apart from visitors for rate limiting.
      headers: process.env.INTERNAL_API_KEY ? { 'x-internal-key': process.env.INTERNAL_API_KEY } : {},
    },
  ).catch(() => null)
  return res?.ok ? ((await res.json()) as PublicOrder) : null
}

/**
 * Where Stripe sends the buyer after paying, and where the email's "view tickets"
 * link points. While Stripe's confirmation is on its way the page refreshes itself.
 */
export default async function ConfirmationPage({ params, searchParams }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const sp = await searchParams
  const ref = textParam(sp.order, 20)
  const token = textParam(sp.t, 64)
  let order = await loadOrder(ref, token)
  if (!order) notFound()
  // Back from Stripe: ask the booking server to check the payment right now (it asks Stripe
  // directly), so tickets show at once instead of waiting for Stripe's webhook.
  if (order.status === 'pending' && bookingApiUrl && !order.demo) {
    await fetch(
      `${bookingApiUrl}/orders/${encodeURIComponent(ref)}/confirm?t=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: process.env.INTERNAL_API_KEY ? { 'x-internal-key': process.env.INTERNAL_API_KEY } : {},
      },
    ).catch(() => null)
    // `fresh` stops Next.js reusing the first answer it already fetched during this page render.
    order = (await loadOrder(ref, token, true)) ?? order
  }

  const money = (n: number) => formatMinor(n, order.currency, intlLocales[locale])
  const date = formatEventDate(order.event.startsAt, locale)
  const fileLink = (file: string) =>
    `${bookingApiUrl}/orders/${encodeURIComponent(order.ref)}/${file}?t=${encodeURIComponent(token)}`

  if (order.status === 'pending') {
    return (
      <div className="container-measure py-20 text-center">
        <meta httpEquiv="refresh" content="3" />
        <span
          className="mx-auto block size-10 animate-spin rounded-pill border-2 border-rule border-t-ink"
          aria-hidden="true"
        />
        <h1 className="mt-8 text-h2">{t.pendingTitle}</h1>
        <p className="mt-4 text-slate" role="status">
          {t.pendingBody}
        </p>
        <p className="meta mt-6">
          {t.orderRef}: {order.ref}
        </p>
      </div>
    )
  }

  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    return (
      <div className="container-measure py-20">
        <h1 className="text-h1">
          {order.status === 'refunded' ? t.statusRefunded : t.failedTitle}
        </h1>
        <p className="mt-5 font-text text-deck text-charcoal">{t.failedBody}</p>
        <Link
          href={href(locale, routes.event(order.event.slug))}
          className="mt-8 inline-flex min-h-11 items-center bg-ink px-5 font-ui text-caption font-semibold text-snow"
        >
          {order.event.title}
        </Link>
      </div>
    )
  }

  const live = order.tickets.filter((tk) => tk.status !== 'cancelled')

  return (
    <div className="container-wide pb-20">
      <ClearCart />
      <RememberOrder orderRef={order.ref} token={token} />
      <header className="border-b border-rule-strong pt-10 pb-8 md:pt-16">
        <div role="status" className="mb-8 border-l-4 border-fjord bg-snow p-5">
          <p className="font-display text-h2">✓ {t.hubBooked}</p>
          <p className="mt-2 text-charcoal">{t.hubBookedBody}</p>
          <dl className="mt-4 grid gap-4 font-ui text-caption sm:grid-cols-4" data-testid="order-counts">
            <div>
              <dt className="text-slate">{t.hubOrderNumber}</dt>
              <dd className="font-semibold">{order.ref}</dd>
            </div>
            <div>
              <dt className="text-slate">{t.hubOrdersCount}</dt>
              <dd className="font-semibold">1</dd>
            </div>
            <div>
              <dt className="text-slate">{t.hubTicketsBookedCount}</dt>
              <dd className="font-semibold" data-testid="tickets-count">{live.length}</dd>
            </div>
            <div>
              <dt className="text-slate">{t.hubTotalPaid}</dt>
              <dd className="font-semibold">{money(order.total)}</dd>
            </div>
          </dl>
          {order.demo ? <p className="mt-3 font-ui text-meta font-semibold text-brass-text">{t.payDemoBadge}</p> : null}
        </div>
        <span className="eyebrow text-brass-text">{t.confirmTitle}</span>
        <h1 className="mt-3 text-h1">{order.event.title}</h1>
        <p className="meta mt-3">
          {date.full}
          {order.event.venue ? ` · ${order.event.venue}` : ''}
        </p>
        <p className="mt-5 text-charcoal">
          {t.emailSentTo} <strong>{order.email}</strong>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={fileLink('tickets.pdf')}
            className="inline-flex min-h-11 items-center bg-ink px-5 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep"
          >
            {t.downloadTickets}
          </a>
          {order.total > 0 ? (
            <a
              href={fileLink('receipt.pdf')}
              className="inline-flex min-h-11 items-center border border-ink px-5 font-ui text-caption font-semibold hover:bg-ink hover:text-snow"
            >
              {t.downloadReceipt}
            </a>
          ) : null}
        </div>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-12">
        <section aria-label={t.yourTickets} className="lg:col-span-8">
          <h2 className="eyebrow text-slate">{t.yourTickets}</h2>
          <p className="meta mt-2">{t.showAtEntrance}</p>
          <p className="meta mt-1">{t.hubTicketUnique}</p>
          <ul className="mt-6 grid gap-8">
            {live.map((tk, i) => (
              <li key={tk.code} data-testid="ticket-card">
                <p className="mb-2 font-ui text-caption font-semibold">
                  {t.hubTicketImage} {i + 1}/{live.length} · {tk.tier}{tk.seat ? ` · ${tk.seat}` : ''}
                </p>
                <TicketImage
                  src={fileLink(`tickets/${tk.code}.svg`)}
                  fileName={`ticket-${order.ref}-${i + 1}`}
                  alt={`${t.hubTicketImage} ${tk.code}`}
                  downloadLabel={t.hubTicketDownloadPng}
                  openLabel={t.hubTicketOpen}
                />
              </li>
            ))}
          </ul>
        </section>

        <aside className="lg:col-span-4">
          <h2 className="eyebrow text-slate">
            {t.orderRef}: {order.ref}
          </h2>
          <dl className="mt-4 space-y-2 border-t border-rule pt-4 font-ui text-caption">
            {order.items.map((it) => (
              <div key={it.tierId} className="flex justify-between gap-4">
                <dt>
                  {it.quantity} × {it.name}
                </dt>
                <dd>{money(it.unitPrice * it.quantity)}</dd>
              </div>
            ))}
            {order.discount ? (
              <div className="flex justify-between gap-4">
                <dt>
                  {t.discount}
                  {order.promoCode ? ` (${order.promoCode})` : ''}
                </dt>
                <dd>−{money(order.discount)}</dd>
              </div>
            ) : null}
            {order.fees ? (
              <div className="flex justify-between gap-4">
                <dt>{t.fees}</dt>
                <dd>{money(order.fees)}</dd>
              </div>
            ) : null}
            {order.servicesTotal ? (
              <div className="flex justify-between gap-4">
                <dt>{t.hubServicesTitle}</dt>
                <dd>{money(order.servicesTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-rule pt-2 font-semibold">
              <dt>{t.total}</dt>
              <dd>{money(order.total)}</dd>
            </div>
            <p className="meta">
              {t.vatIncluded}: {money(order.vatAmount)}
            </p>
          </dl>
          <Link
            href={href(locale, '/events?view=tickets')}
            data-testid="go-my-tickets"
            className="mt-8 inline-block font-ui text-meta font-semibold text-fjord hover:underline"
          >
            {t.hubGoMyTickets} →
          </Link>
        </aside>
      </div>
    </div>
  )
}
