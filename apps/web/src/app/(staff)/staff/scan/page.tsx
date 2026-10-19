import Link from 'next/link'
import type { Where } from 'payload'
import { hasRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { requireStaff, stockholmTime } from '@/lib/staff'
import { StaffShell } from '@/components/staff/StaffShell'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Gate scanner' }

/** Pick the event at the door. Gate staff only see events they are assigned to. */
export default async function ScanIndex() {
  const user = await requireStaff('gate', 'admin')
  const payload = await getPayloadClient()
  const since = new Date(Date.now() - 12 * 3600_000).toISOString()
  const until = new Date(Date.now() + 14 * 86400_000).toISOString()
  const and: Where[] = [
    { _status: { equals: 'published' } },
    { startsAt: { greater_than: since } },
    { startsAt: { less_than: until } },
  ]
  if (!hasRole(user, 'admin')) and.push({ gateStaff: { in: [user.id] } })
  const events = await payload.find({
    collection: 'events',
    depth: 1,
    limit: 30,
    sort: 'startsAt',
    where: { and },
    overrideAccess: true,
  })

  return (
    <StaffShell user={user} title="Gate scanner">
      {events.docs.length === 0 ? (
        <p className="text-slate">
          No events in the next two weeks{hasRole(user, 'admin') ? '' : ' assigned to you'}.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.docs.map((e) => (
            <li key={e.id}>
              <Link
                href={`/staff/scan/${e.id}`}
                className="block border border-rule bg-snow p-5 hover:border-ink"
              >
                <p className="font-display text-h3">{e.title}</p>
                <p className="meta mt-1">
                  {stockholmTime(e.startsAt)}
                  {typeof e.venue === 'object' && e.venue ? ` · ${e.venue.name}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </StaffShell>
  )
}
