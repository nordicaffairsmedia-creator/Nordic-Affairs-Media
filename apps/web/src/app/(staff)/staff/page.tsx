import Link from 'next/link'
import { redirect } from 'next/navigation'
import { hasRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { internalApi, money, requireStaff, stockholmTime } from '@/lib/staff'
import type { EventStats } from '@/lib/staffTypes'
import { primaryPill, secondaryPill, StaffShell, StatCard } from '@/components/staff/StaffShell'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Events' }

/** Organizer home (PRD A-03): every recent and upcoming event with its sales at a glance. */
export default async function StaffHome() {
  const user = await requireStaff('admin', 'gate')
  if (!hasRole(user, 'admin')) redirect('/staff/scan')

  const payload = await getPayloadClient()
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  const events = await payload.find({
    collection: 'events',
    depth: 1,
    limit: 50,
    sort: 'startsAt',
    where: { or: [{ startsAt: { greater_than: since } }, { startsAt: { exists: false } }, { startsAt: { equals: null } }] },
    overrideAccess: true,
    draft: true,
  })
  const stats = await Promise.all(
    events.docs.map((e) =>
      internalApi<EventStats>(`/internal/events/${e.id}/stats`).then((r) => (r.ok ? r.data : null)),
    ),
  )

  const rows = events.docs.map((e, i) => {
    const st = stats[i]
    const sold = st?.tiers.reduce((n, t) => n + t.sold, 0) ?? 0
    const cap = st?.tiers.reduce((n, t) => n + t.capacity, 0) ?? 0
    const checked = st?.tiers.reduce((n, t) => n + t.checkedIn, 0) ?? 0
    return { e, st, sold, cap, checked }
  })
  const upcoming = rows.filter((r) => !r.e.startsAt || new Date(r.e.startsAt).getTime() > Date.now())
  const totalSold = rows.reduce((n, r) => n + r.sold, 0)
  const totalChecked = rows.reduce((n, r) => n + r.checked, 0)
  const currency = rows.find((r) => r.st)?.st?.event.currency ?? 'SEK'
  const revenue = rows.reduce((n, r) => n + (r.st ? r.st.gross - r.st.refunded : 0), 0)
  const requests = rows.reduce((n, r) => n + (r.st?.cancelRequests ?? 0), 0)

  return (
    <StaffShell
      user={user}
      title="Events"
      subtitle="Every recent and upcoming event, with live sales."
      actions={
        <a href="/admin/collections/events/create" className={primaryPill}>
          New event
        </a>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Upcoming events" value={upcoming.length} hint={`${rows.length} in view`} />
        <StatCard label="Tickets sold" value={totalSold.toLocaleString('sv-SE')} />
        <StatCard
          label="Checked in"
          value={totalChecked.toLocaleString('sv-SE')}
          hint={requests ? `${requests} cancellation request(s) waiting` : undefined}
        />
        <StatCard label="Revenue" value={money(revenue, currency)} hint="After refunds, incl. VAT" accent />
      </div>

      <h2 className="mt-14 mb-4 text-[22px] font-semibold tracking-[-0.02em] text-[#f5f5f7]">All events</h2>

      {rows.length === 0 ? (
        <div className="rounded-[20px] bg-[#141416] px-6 py-16 text-center ring-1 ring-white/[0.06]">
          <p className="text-[22px] font-semibold tracking-[-0.02em] text-[#f5f5f7]">No events yet</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-[#86868b]">
            Create the first one in the content manager. It appears here with live sales as soon as it is published.
          </p>
          <a href="/admin/collections/events/create" className={`${primaryPill} mt-6`}>
            Create event
          </a>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[20px] bg-[#141416] ring-1 ring-white/[0.06]">
          {rows.map(({ e, st, sold, cap, checked }, i) => {
            const pct = cap ? Math.min(100, Math.round((sold / cap) * 100)) : 0
            const date = e.startsAt ? new Date(e.startsAt) : null
            const past = date ? date.getTime() < Date.now() : false
            const published = e._status === 'published'
            return (
              <li
                key={e.id}
                className={`grid gap-4 px-5 py-5 transition-colors hover:bg-white/[0.025] sm:grid-cols-[56px_1fr_auto] sm:items-center sm:px-6 ${
                  i > 0 ? 'border-t border-white/[0.06]' : ''
                }`}
              >
                <div className="flex size-14 flex-col items-center justify-center rounded-2xl bg-[#1c1c1e] text-center">
                  <span className="text-[11px] font-semibold text-[#ff453a] uppercase">
                    {date ? date.toLocaleString('en-GB', { month: 'short', timeZone: 'Europe/Stockholm' }) : 'TBA'}
                  </span>
                  <span className="text-[22px] leading-none font-semibold tracking-[-0.03em] text-white">
                    {date ? date.toLocaleString('en-GB', { day: 'numeric', timeZone: 'Europe/Stockholm' }) : '–'}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="truncate text-[17px] font-semibold tracking-[-0.015em] text-[#f5f5f7]">{e.title}</p>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-[#86868b]">
                      <span
                        aria-hidden="true"
                        className={`size-1.5 rounded-full ${published ? 'bg-[#30d158]' : 'bg-[#86868b]'}`}
                      />
                      {published ? 'Published' : 'Draft'}
                      {past ? ' · Past' : ''}
                    </span>
                    {st?.cancelRequests ? (
                      <span className="rounded-full bg-[#ff9f0a]/15 px-2.5 py-0.5 text-[12px] font-medium text-[#ffb340]">
                        {st.cancelRequests} cancellation request(s)
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[13px] text-[#86868b]">{stockholmTime(e.startsAt)}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1 max-w-sm flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <div className="h-full rounded-full bg-[#0a84ff]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="shrink-0 text-[12px] text-[#86868b] tabular-nums">
                      {st ? `${sold} of ${cap} sold · ${checked} checked in` : 'No sales yet'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <p className="text-[20px] font-semibold tracking-[-0.02em] text-[#f5f5f7] tabular-nums">
                    {st ? money(st.gross - st.refunded, st.event.currency) : '—'}
                  </p>
                  <div className="flex gap-2">
                    <Link href={`/staff/events/${e.id}`} className={secondaryPill}>
                      Manage
                    </Link>
                    <Link href={`/staff/scan/${e.id}`} className={secondaryPill}>
                      Scan
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-5 text-[12px] text-[#6e6e73]">
        Revenue is after refunds and includes VAT. Draft events show no sales until published.
      </p>
    </StaffShell>
  )
}
