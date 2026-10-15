import { internalApi, money, requireStaff } from '@/lib/staff'
import type { Reports } from '@/lib/staffTypes'
import { Notice, StaffShell, StatCard } from '@/components/staff/StaffShell'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reports' }

const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const sourceLabel: Record<string, string> = {
  online: 'Online',
  comp: 'Complimentary',
  boxoffice: 'Box office',
}

/** Owner-only revenue reports (PRD S-08). Amounts include VAT; net = gross − refunds. */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requireStaff() // SuperAdmin only
  const sp = await searchParams
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined)
  const from = valid(sp.from) ?? isoDay(new Date(Date.now() - 365 * 86400_000))
  const to = valid(sp.to) ?? isoDay(new Date())
  const r = await internalApi<Reports>(`/internal/reports?from=${from}&to=${to}T23:59:59Z`)
  const data = r.ok ? r.data : null
  const input = 'min-h-10 border border-rule bg-snow px-3 font-ui text-caption'

  const table = (
    title: string,
    first: string,
    rows: {
      label: string
      currency: string
      orders: number
      tickets: number
      gross: number
      refunded: number
      vat: number
    }[],
  ) => (
    <section className="mt-10">
      <h2 className="text-h3">{title}</h2>
      <div className="mt-3 overflow-x-auto border border-rule bg-snow">
        <table className="w-full min-w-[40rem] font-ui text-caption">
          <thead className="border-b border-rule text-left text-slate">
            <tr>
              <th className="p-3">{first}</th>
              <th className="p-3 text-right">Orders</th>
              <th className="p-3 text-right">Tickets</th>
              <th className="p-3 text-right">Gross</th>
              <th className="p-3 text-right">Refunded</th>
              <th className="p-3 text-right">Net</th>
              <th className="p-3 text-right">VAT in gross</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-3 text-slate">
                  No sales in this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.label}-${row.currency}`}>
                  <td className="p-3 font-semibold">{row.label}</td>
                  <td className="p-3 text-right">{row.orders}</td>
                  <td className="p-3 text-right">{row.tickets}</td>
                  <td className="p-3 text-right">{money(row.gross, row.currency)}</td>
                  <td className="p-3 text-right">{money(row.refunded, row.currency)}</td>
                  <td className="p-3 text-right font-semibold">
                    {money(row.gross - row.refunded, row.currency)}
                  </td>
                  <td className="p-3 text-right">{money(row.vat, row.currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )

  return (
    <StaffShell user={user} title="Reports" subtitle="Sales, refunds and VAT for any period.">
      <form method="get" className="flex flex-wrap items-end gap-3 font-ui text-caption">
        <label>
          <span className="meta block">From</span>
          <input type="date" name="from" defaultValue={from} className={input} />
        </label>
        <label>
          <span className="meta block">To</span>
          <input type="date" name="to" defaultValue={to} className={input} />
        </label>
        <button className="min-h-10 bg-ink px-4 font-semibold text-snow">Show</button>
      </form>
      {data && data.byMonth.length ? (() => {
        const cur = data.byMonth[0]!._id.currency
        const rows = data.byMonth.filter((x) => x._id.currency === cur)
        const sum = (k: 'orders' | 'tickets' | 'gross' | 'refunded' | 'vat') => rows.reduce((n, x) => n + x[k], 0)
        return (
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Orders" value={sum('orders').toLocaleString('sv-SE')} />
            <StatCard label="Tickets" value={sum('tickets').toLocaleString('sv-SE')} />
            <StatCard label="Refunded" value={money(sum('refunded'), cur)} />
            <StatCard label="Net revenue" value={money(sum('gross') - sum('refunded'), cur)} hint={`VAT in gross ${money(sum('vat'), cur)}`} accent />
          </div>
        )
      })() : null}
      {!data ? (
        <div className="mt-6">
          <Notice err="Booking system not reachable." />
        </div>
      ) : null}
      {data
        ? table(
            'By event',
            'Event',
            data.byEvent.map((x) => ({ label: x._id.event, currency: x._id.currency, ...x })),
          )
        : null}
      {data
        ? table(
            'By month (Stockholm time)',
            'Month',
            data.byMonth.map((x) => ({ label: x._id.month, currency: x._id.currency, ...x })),
          )
        : null}
      {data
        ? table(
            'By sales channel',
            'Channel',
            data.bySource.map((x) => ({
              label: sourceLabel[x._id.source] ?? x._id.source,
              currency: x._id.currency,
              ...x,
            })),
          )
        : null}
      {data && data.byOrganizer.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-h3">Partner organizers</h2>
          <p className="meta mt-1">
            Net ticket revenue (after discounts and refunds, excluding fees).
          </p>
          <div className="mt-3 overflow-x-auto border border-rule bg-snow">
            <table className="w-full min-w-[36rem] font-ui text-caption">
              <thead className="border-b border-rule text-left text-slate">
                <tr>
                  <th className="p-3">Organizer</th>
                  <th className="p-3 text-right">Events</th>
                  <th className="p-3 text-right">Net tickets</th>
                  <th className="p-3 text-right">Commission</th>
                  <th className="p-3 text-right">To pay organizer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {data.byOrganizer.map((o) => (
                  <tr key={`${o.organizer}-${o.currency}`}>
                    <td className="p-3 font-semibold">{o.organizer}</td>
                    <td className="p-3 text-right">{o.events}</td>
                    <td className="p-3 text-right">{money(o.net, o.currency)}</td>
                    <td className="p-3 text-right">
                      {money(o.commission, o.currency)} ({o.commissionPercent}%)
                    </td>
                    <td className="p-3 text-right font-semibold">{money(o.payout, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {data?.platformFee ? (
        <section className="mt-10">
          <h2 className="text-h3">Entraiot commission</h2>
          <p className="meta mt-1">
            {data.platformFee.percent}% of net ticket revenue
            {Object.keys(data.platformFee.fixed).length
              ? ` plus ${Object.entries(data.platformFee.fixed)
                  .map(([cur, minor]) => money(minor, cur))
                  .join(' / ')} per paid ticket`
              : ''}
            , invoiced monthly by Entraiot Solutions. Free, complimentary, refunded and cancelled
            tickets are not charged; booking and service fees are not counted.
          </p>
          <div className="mt-3 overflow-x-auto border border-rule bg-snow">
            <table className="w-full min-w-[36rem] font-ui text-caption">
              <thead className="border-b border-rule text-left text-slate">
                <tr>
                  <th className="p-3">Month</th>
                  <th className="p-3 text-right">Orders</th>
                  <th className="p-3 text-right">Paid tickets</th>
                  <th className="p-3 text-right">Net ticket revenue</th>
                  <th className="p-3 text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {data.platformFee.byMonth.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-slate">
                      No paid tickets in this period.
                    </td>
                  </tr>
                ) : (
                  data.platformFee.byMonth.map((m) => (
                    <tr key={`${m.month}-${m.currency}`}>
                      <td className="p-3 font-semibold">{m.month}</td>
                      <td className="p-3 text-right">{m.orders}</td>
                      <td className="p-3 text-right">{m.tickets}</td>
                      <td className="p-3 text-right">{money(m.net, m.currency)}</td>
                      <td className="p-3 text-right font-semibold">
                        {money(m.commission, m.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <p className="meta mt-6">
        Card fees charged by Stripe are not included — see the Stripe dashboard for payouts. VAT
        figures are for guidance; your accountant’s records are authoritative.
      </p>
    </StaffShell>
  )
}
