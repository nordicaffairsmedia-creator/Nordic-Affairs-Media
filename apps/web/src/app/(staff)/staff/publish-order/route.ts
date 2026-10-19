import { NextResponse } from 'next/server'
import { hasRole } from '@/access/roles'
import { purge } from '@/lib/revalidate'
import { getStaffUser } from '@/lib/staff'

export const dynamic = 'force-dynamic'

/**
 * "Publish order" button on every list that can be rearranged by dragging.
 * The new order is already saved in the database when the row is dropped; this clears the
 * website's saved pages so every visitor sees that order straight away (staff only).
 */
export async function POST() {
  const user = await getStaffUser()
  if (!user || !hasRole(user, 'admin', 'editor'))
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  purge()
  return NextResponse.json({ ok: true, at: new Date().toISOString() })
}
