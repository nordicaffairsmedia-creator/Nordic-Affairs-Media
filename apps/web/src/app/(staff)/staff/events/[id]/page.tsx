import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { internalApi, money, requireStaff, stockholmTime } from '@/lib/staff'
import type { EventStats, StaffOrder } from '@/lib/staffTypes'
import { Notice, StaffShell } from '@/components/staff/StaffShell'
import { announceAction, cancelTicketAction, manualOrderAction, refundAction } from '../../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const statusLabel: Record<string, string> = {
  paid: 'Paid',
  partially_refunded: 'Part-refunded',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
}
const sourceLabel: Record<string, string> = {
  online: 'Online',
  comp: 'Complimentary',
  boxoffice: 'Box office',
}

/**
 * One event for organizers (PRD A-03..A-09): live numbers per ticket type, orders with
 * refunds, guest-list / box-office bookings, attendee export and a message to all buyers.
 */
export default async function StaffEventPage({ params, searchParams }: Props) {
  const user = await requireStaff('admin')
  const { id } = await params
  const sp = await searchParams
  const q = (sp.q ?? '').slice(0, 80)

  const payload = await getPayloadClient()
  const event = await payload
    .findByID({ collection: 'events', id, depth: 0, overrideAccess: true, draft: true })
    .catch(() => null)
  if (!event) notFound()

  const [statsRes, ordersRes] = await Promise.all([
    internalApi<EventStats>(`/internal/events/${id}/stats`),
    internalApi<{ orders: StaffOrder[] }>(
      `/internal/events/${id}/orders${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    ),
  ])
  const stats = statsRes.ok ? statsRes.data : null
  const orderList = ordersRes.ok ? ordersRes.data.orders : []
  const cur = event.currency
  const input =
    'min-h-10 border border-rule bg-snow px-3 font-ui text-caption focus-visible:border-fjord'
  const btn =
    'min-h-10 bg-ink px-4 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep'

  return (
    <StaffShell user={user} title={event.title}>
      <Notice msg={sp.msg} err={sp.err} />
      <p className="meta -mt-6 mb-8">
        {stockholmTime(event.startsAt)} ·{' '}
        {event._status === 'published' ? 'Published' : 'Draft (not on sale)'} ·{' '}
        <a href={`/admin/collections/events/${id}`} className="text-fjord underline">
          Edit event
        </a>{' '}
        ·{' '}
        <a href={`/staff/scan/${id}`} className="text-fjord underline">
          Open gate scanner
        </a>
      </p>

      {!statsRes.ok ? (
        <Notice
          err={`Booking system not reachable (${statsRes.status}). Check BOOKING_API_URL and INTERNAL_API_KEY on Render.`}
        />
      ) : null}

      {/* Numbers */}
      {stats ? (
        <section className="grid gap-6 lg:grid-cols-12">
          <div className="overflow-x-auto border border-rule bg-snow lg:col-span-8">
            <table className="w-full min-w-[36rem] font-ui text-caption">
              <thead className="border-b border-rule text-left text-slate">
                <tr>
                  <th className="p-3">Ticket type</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">Sold</th>
                  <th className="p-3 text-right">In checkout</th>
                  <th className="p-3 text-right">Left</th>
                  <th className="p-3 text-right">Checked in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {stats.tiers.map((t) => (
                  <tr key={t.tierId}>
                    <td className="p-3 font-semibold">{t.name}</td>
                    <td className="p-3 text-right">{money(t.price, cur)}</td>
                    <td className="p-3 text-right">
                      {t.sold} / {t.capacity}
                    </td>
                    <td className="p-3 text-right">{t.held}</td>
                    <td className="p-3 text-right">{t.remaining}</td>
                    <td className="p-3 text-right">{t.checkedIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid grid-cols-2 gap-px border border-rule bg-rule lg:col-span-4">
            {[
              ['Orders', String(stats.orders)],
              ['Revenue (net)', money(stats.gross - stats.refunded, cur)],
              ['Refunded', money(stats.refunded, cur)],
              ['Cancel requests', String(stats.cancelRequests)],
            ].map(([k, v]) => (
              <div key={k} className="bg-snow p-4">
                <dt className="meta">{k}</dt>
                <dd className="mt-1 font-display text-h3">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* Orders */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-h3">Orders</h2>
          <div className="flex flex-wrap items-center gap-3">
            <form method="get" className="flex gap-2">
              <input
                name="q"
                defaultValue={q}
                placeholder="Name, email or NAM-…"
                className={input}
              />
              <button className={btn}>Search</button>
            </form>
            <a
              href={`/staff/events/${id}/attendees.csv`}
              className="font-ui text-caption font-semibold text-fjord underline"
            >
              Download attendee list (CSV)
            </a>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-rule border border-rule bg-snow">
          {orderList.length === 0 ? (
            <li className="p-4 text-slate">No orders{q ? ' match this search' : ' yet'}.</li>
          ) : null}
          {orderList.map((o) => {
            const liveTickets = o.tickets.filter((t) => t.status === 'valid')
            const left = o.total - o.refundedAmount
            return (
              <li key={o.ref} className="p-4">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-3 font-ui text-caption">
                    <span>
                      <strong>{o.ref}</strong> · {o.name} ·{' '}
                      <span className="text-slate">{o.email}</span>
                      {o.cancelRequested && o.status === 'paid' ? (
                        <span className="ml-2 rounded-pill border border-alert px-2 text-[0.6875rem] font-bold text-alert">
                          CANCELLATION REQUESTED
                        </span>
                      ) : null}
                    </span>
                    <span className="whitespace-nowrap">
                      {o.tickets.length} tickets · {money(o.total, cur)} ·{' '}
                      {statusLabel[o.status] ?? o.status} · {sourceLabel[o.source] ?? o.source}
                    </span>
                  </summary>
                  <div className="mt-4 grid gap-6 md:grid-cols-2">
                    <div className="font-ui text-caption">
                      <p className="meta">Created {stockholmTime(o.createdAt)}</p>
                      {o.note ? <p className="meta">Note: {o.note}</p> : null}
                      {o.refundedAmount ? (
                        <p className="meta">Refunded so far: {money(o.refundedAmount, cur)}</p>
                      ) : null}
                      <ul className="mt-3 space-y-1">
                        {o.tickets.map((t) => (
                          <li key={t.code} className="flex items-center justify-between gap-3">
                            <span>
                              {t.tier} ·{' '}
                              <span className="font-mono text-[0.6875rem]">
                                {t.code.slice(0, 8)}…
                              </span>{' '}
                              · {t.status === 'checked_in' ? 'checked in' : t.status}
                            </span>
                            {t.status === 'valid' ? (
                              <form action={cancelTicketAction}>
                                <input type="hidden" name="eventId" value={id} />
                                <input type="hidden" name="code" value={t.code} />
                                <button className="text-alert hover:underline">
                                  Cancel ticket
                                </button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {(o.status === 'paid' || o.status === 'partially_refunded') &&
                    (left > 0 || liveTickets.length > 0) ? (
                      <form
                        action={refundAction}
                        className="space-y-3 border-l border-rule pl-6 font-ui text-caption"
                      >
                        <input type="hidden" name="eventId" value={id} />
                        <input type="hidden" name="ref" value={o.ref} />
                        <p className="font-semibold">Refund</p>
                        <p className="meta">
                          {o.refundable
                            ? 'Money goes back to the buyer’s card/wallet through Stripe.'
                            : 'Not paid online — this only records the refund; pay it back by hand.'}
                        </p>
                        <label className="block">
                          <span className="meta">
                            Amount ({cur}) — leave empty for the full remaining {money(left, cur)}
                          </span>
                          <input
                            name="amount"
                            inputMode="decimal"
                            className={`${input} mt-1 w-40`}
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="cancelTickets" /> Also cancel the tickets
                          (put places back on sale)
                        </label>
                        <button className="min-h-10 border border-alert px-4 font-semibold text-alert hover:bg-alert hover:text-snow">
                          Refund
                        </button>
                      </form>
                    ) : null}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        {/* Guest list / box office */}
        <section className="border border-rule bg-snow p-5">
          <h2 className="text-h3">Guest list &amp; box office</h2>
          <p className="meta mt-1">
            Creates a booking and emails the tickets. Counts toward capacity.
          </p>
          <form
            action={manualOrderAction}
            className="mt-4 grid gap-3 font-ui text-caption sm:grid-cols-2"
          >
            <input type="hidden" name="eventId" value={id} />
            <label className="block sm:col-span-2">
              <span className="meta">Type</span>
              <select name="kind" className={`${input} mt-1 w-full`}>
                <option value="comp">Complimentary (free)</option>
                <option value="boxoffice">Box office (paid in person)</option>
              </select>
            </label>
            <label className="block">
              <span className="meta">Ticket type</span>
              <select name="tierId" required className={`${input} mt-1 w-full`}>
                {(event.tiers ?? []).map((t) => (
                  <option key={t.tierId} value={t.tierId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="meta">Quantity</span>
              <input
                name="quantity"
                type="number"
                min={1}
                max={50}
                defaultValue={1}
                className={`${input} mt-1 w-full`}
              />
            </label>
            <label className="block">
              <span className="meta">Guest name</span>
              <input name="name" required minLength={2} className={`${input} mt-1 w-full`} />
            </label>
            <label className="block">
              <span className="meta">Guest email</span>
              <input name="email" type="email" required className={`${input} mt-1 w-full`} />
            </label>
            <label className="block">
              <span className="meta">Amount paid ({cur}, box office only)</span>
              <input
                name="amountPaid"
                inputMode="decimal"
                defaultValue="0"
                className={`${input} mt-1 w-full`}
              />
            </label>
            <label className="block">
              <span className="meta">Email language</span>
              <select name="locale" className={`${input} mt-1 w-full`}>
                <option value="en">English</option>
                <option value="sv">Svenska</option>
                <option value="ta">தமிழ்</option>
                <option value="ml">മലയാളം</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="meta">Internal note</span>
              <input name="note" maxLength={300} className={`${input} mt-1 w-full`} />
            </label>
            <div className="sm:col-span-2">
              <button className={btn}>Create booking</button>
            </div>
          </form>
        </section>

        {/* Announcement */}
        <section className="border border-rule bg-snow p-5">
          <h2 className="text-h3">Message all ticket holders</h2>
          <p className="meta mt-1">For changes such as a new start time or venue information.</p>
          <form action={announceAction} className="mt-4 space-y-3 font-ui text-caption">
            <input type="hidden" name="eventId" value={id} />
            <label className="block">
              <span className="meta">Subject</span>
              <input
                name="subject"
                required
                minLength={3}
                maxLength={150}
                className={`${input} mt-1 w-full`}
              />
            </label>
            <label className="block">
              <span className="meta">Message</span>
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={5000}
                rows={7}
                className={`${input} mt-1 w-full py-2`}
              />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirm" /> I want to email every ticket holder of this
              event now
            </label>
            <button className={btn}>Send</button>
          </form>
        </section>
      </div>
    </StaffShell>
  )
}
