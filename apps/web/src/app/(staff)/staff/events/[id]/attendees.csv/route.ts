import { hasRole } from '@/access/roles'
import { getStaffUser, internalApi } from '@/lib/staff'
import type { Attendee } from '@/lib/staffTypes'

export const dynamic = 'force-dynamic'

const cell = (v: string) => {
  // Quote every cell, double inner quotes, and defuse spreadsheet formulas (=, +, -, @).
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v
  return `"${safe.replace(/"/g, '""')}"`
}

/** Attendee list for Excel / Numbers (PRD A-04). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser()
  if (!user || !hasRole(user, 'admin')) return new Response('Not signed in', { status: 401 })
  const { id } = await params
  const r = await internalApi<{ attendees: Attendee[] }>(`/internal/events/${id}/attendees`)
  if (!r.ok) return new Response('Booking system not reachable', { status: 502 })

  const header = [
    'Name',
    'Email',
    'Ticket type',
    'Seat',
    'Status',
    'Checked in at',
    'Order',
    'Source',
    'Ticket code',
  ]
  const rows = r.data.attendees.map((a) =>
    [a.name, a.email, a.tier, a.seat ?? '', a.status, a.checkedInAt ?? '', a.order, a.source, a.code]
      .map(cell)
      .join(','),
  )
  // BOM so Excel opens Swedish/Tamil/Malayalam names correctly.
  const csv = String.fromCharCode(0xfeff) + [header.map(cell).join(','), ...rows].join('\r\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendees-${id}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
