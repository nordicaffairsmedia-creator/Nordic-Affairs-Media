'use client'

import { useEffect, useState } from 'react'
import { bookingApiUrl } from '@/lib/booking'
import { formatMinor, type PublicOrder } from '@/lib/bookingTypes'
import { forgetOrder, readMyOrders } from '@/lib/myOrders'
import { TicketImage } from '@/components/account/TicketImage'

export type MyTicketsLabels = {
  title: string
  intro: string
  loading: string
  empty: string
  error: string
  retry: string
  orderRef: string
  total: string
  pdf: string
  imageAlt: string
  ticketWord: string
  pngLabel: string
  openLabel: string
  remove: string
  demo: string
}

type Row = { order: PublicOrder; token: string }

/** Tickets bought on this device, shown with their QR pictures. No sign-in needed. */
export function MyTickets({ labels, intlLocale }: { labels: MyTicketsLabels; intlLocale: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [n, setN] = useState(0)

  useEffect(() => {
    let live = true
    const saved = readMyOrders()
    setFailed(false)
    if (!bookingApiUrl || saved.length === 0) {
      setRows([])
      return
    }
    setRows(null)
    Promise.all(
      saved.map(async (s) => {
        const r = await fetch(`${bookingApiUrl}/orders/${encodeURIComponent(s.ref)}?t=${encodeURIComponent(s.token)}`, {
          cache: 'no-store',
        })
        if (r.status === 404) {
          forgetOrder(s.ref)
          return null
        }
        if (!r.ok) throw new Error(String(r.status))
        return { order: (await r.json()) as PublicOrder, token: s.token }
      }),
    )
      .then((all) => {
        if (!live) return
        const ok = all.filter((x): x is Row => Boolean(x) && ['paid', 'partially_refunded'].includes(x!.order.status))
        ok.sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt))
        setRows(ok)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [n])

  return (
    <section aria-label={labels.title} data-testid="my-tickets">
      <h2 className="text-h2">{labels.title}</h2>
      <p className="mt-2 max-w-prose text-charcoal">{labels.intro}</p>
      {failed ? (
        <div className="mt-6">
          <p className="font-ui text-caption font-semibold text-alert">{labels.error}</p>
          <button
            type="button"
            onClick={() => setN((x) => x + 1)}
            className="mt-3 inline-flex min-h-11 items-center border border-ink px-5 font-ui text-caption font-semibold hover:bg-ink hover:text-snow"
          >
            {labels.retry}
          </button>
        </div>
      ) : rows === null ? (
        <p className="mt-6 text-slate" role="status">{labels.loading}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-slate" data-testid="my-tickets-empty">{labels.empty}</p>
      ) : (
        <ul className="mt-6 grid gap-10">
          {rows.map(({ order, token }) => {
            const live = order.tickets.filter((t) => t.status !== 'cancelled')
            const when = new Date(order.event.startsAt).toLocaleString(intlLocale, {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: 'Europe/Stockholm',
            })
            const file = (f: string) => `${bookingApiUrl}/orders/${encodeURIComponent(order.ref)}/${f}?t=${encodeURIComponent(token)}`
            return (
              <li key={order.ref} data-testid="my-order" className="border border-rule bg-snow p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-display text-h3">{order.event.title}</h3>
                  <p className="meta">
                    {labels.orderRef}: {order.ref}
                    {order.demo ? ` · ${labels.demo}` : ''}
                  </p>
                </div>
                <p className="meta mt-1">
                  {when}
                  {order.event.venue ? ` · ${order.event.venue}` : ''}
                </p>
                <p className="meta mt-1">
                  {labels.total}: {formatMinor(order.total, order.currency, intlLocale)}
                </p>
                <ul className="mt-5 grid gap-6 md:grid-cols-2">
                  {live.map((tk, i) => (
                    <li key={tk.code} data-testid="my-ticket">
                      <p className="mb-2 font-ui text-caption font-semibold">
                        {labels.ticketWord} {i + 1}/{live.length} · {tk.tier}
                      </p>
                      <TicketImage
                        src={file(`tickets/${tk.code}.svg`)}
                        fileName={`ticket-${order.ref}-${i + 1}`}
                        alt={`${labels.imageAlt} ${tk.code}`}
                        downloadLabel={labels.pngLabel}
                        openLabel={labels.openLabel}
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-5">
                  <a href={file('tickets.pdf')} className="font-ui text-meta font-semibold text-fjord hover:underline">
                    {labels.pdf}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      forgetOrder(order.ref)
                      setN((x) => x + 1)
                    }}
                    className="font-ui text-meta text-slate hover:underline"
                  >
                    {labels.remove}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
