import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { requireStaff, stockholmTime } from '@/lib/staff'
import { Scanner } from '@/components/staff/Scanner'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Scanning' }

/** Full-screen door view for one event (PRD G-01..G-04). */
export default async function ScanEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('gate', 'admin')
  const { id } = await params
  const payload = await getPayloadClient()
  const event = await payload
    .findByID({ collection: 'events', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!event) notFound()
  return (
    <div className="flex min-h-dvh flex-col bg-navy-deep text-ink">
      <header className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-display text-[1.25rem] leading-tight">{event.title}</p>
          <p className="font-ui text-meta text-mist">{stockholmTime(event.startsAt)}</p>
        </div>
        <Link href="/staff/scan" className="shrink-0 font-ui text-meta text-mist hover:text-ink">
          ← Events
        </Link>
      </header>
      <Scanner eventId={id} />
    </div>
  )
}
