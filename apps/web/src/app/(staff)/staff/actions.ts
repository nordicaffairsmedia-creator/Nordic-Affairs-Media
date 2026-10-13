'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { hasRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { internalApi, requireStaff } from '@/lib/staff'
import type { CheckinResult } from '@/lib/staffTypes'
import { logAudit } from '@/lib/audit'
import { logLogin } from '@/lib/loginLog'

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const email = (u: { email?: unknown; id: unknown }) =>
  typeof u.email === 'string' ? u.email : String(u.id)

async function audit(
  user: { email?: unknown; id: unknown },
  action: string,
  targetId: string,
  summary: string,
) {
  await logAudit(await getPayloadClient(), {
    user: email(user),
    action,
    target: 'booking',
    targetId,
    summary,
  })
}

const back = (eventId: string, msg: string, ok = true) =>
  redirect(`/staff/events/${eventId}?${ok ? 'msg' : 'err'}=${encodeURIComponent(msg)}`)

// ---------- sign in / out ----------

export async function loginAction(formData: FormData) {
  // Username (e.g. "rana") or email address.
  const email = (str(formData, 'login') || str(formData, 'email')).toLowerCase()
  const password = str(formData, 'password')
  const payload = await getPayloadClient()
  let token: string | undefined
  let exp: number | undefined
  try {
    const result = await payload.login({
      collection: 'users',
      data: (email.includes('@') ? { email, password } : { username: email, password }) as never,
    })
    token = result.token
    exp = result.exp
  } catch {
    await logLogin(payload, { email, ok: false, source: 'staff', headers: await headers() })
    redirect('/staff/login?failed=1')
  }
  if (!token) redirect('/staff/login?failed=1')
  ;(await cookies()).set('payload-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(exp ? { expires: new Date(exp * 1000) } : {}),
  })
  redirect('/staff')
}

export async function logoutAction() {
  ;(await cookies()).delete('payload-token')
  redirect('/staff/login')
}

// ---------- organizer actions (role: admin) ----------

export async function refundAction(formData: FormData) {
  const user = await requireStaff('admin')
  const eventId = str(formData, 'eventId')
  const ref = str(formData, 'ref')
  const amountMajor = Number(str(formData, 'amount').replace(',', '.'))
  const partial = Number.isFinite(amountMajor) && amountMajor > 0
  const r = await internalApi<{ error?: string; refundedAmount?: number }>(
    `/internal/orders/${encodeURIComponent(ref)}/refund`,
    {
      method: 'POST',
      body: {
        ...(partial ? { amount: Math.round(amountMajor * 100) } : {}),
        cancelTickets: formData.get('cancelTickets') === 'on',
      },
    },
  )
  if (r.ok)
    await audit(
      user,
      'refund',
      ref,
      `Refunded order ${ref}${partial ? ` (${amountMajor})` : ' (full)'}`,
    )
  back(
    eventId,
    r.ok ? `${ref}: refund done` : `${ref}: refund failed (${r.data.error ?? r.status})`,
    r.ok,
  )
}

export async function cancelTicketAction(formData: FormData) {
  const user = await requireStaff('admin')
  const eventId = str(formData, 'eventId')
  const code = str(formData, 'code')
  await audit(user, 'cancel-ticket', code, `Cancelled ticket ${code.slice(0, 8)}…`)
  const r = await internalApi<{ cancelled?: boolean }>(
    `/internal/tickets/${encodeURIComponent(code)}/cancel`,
    { method: 'POST' },
  )
  back(
    eventId,
    r.ok && r.data.cancelled
      ? 'Ticket cancelled and put back on sale'
      : 'Ticket could not be cancelled',
    Boolean(r.ok && r.data.cancelled),
  )
}

export async function manualOrderAction(formData: FormData) {
  const user = await requireStaff('admin')
  const eventId = str(formData, 'eventId')
  const r = await internalApi<{ ref?: string; error?: string }>('/internal/manual-order', {
    method: 'POST',
    body: {
      eventId,
      tierId: str(formData, 'tierId'),
      quantity: Number(str(formData, 'quantity')) || 1,
      name: str(formData, 'name'),
      email: str(formData, 'email'),
      locale: str(formData, 'locale') || 'en',
      kind: str(formData, 'kind') === 'boxoffice' ? 'boxoffice' : 'comp',
      amountPaid: Number(str(formData, 'amountPaid').replace(',', '.')) || 0,
      note: str(formData, 'note') || undefined,
      staffEmail: typeof user.email === 'string' ? user.email : undefined,
    },
  })
  if (r.ok)
    await audit(
      user,
      'manual-booking',
      r.data.ref ?? '',
      `Created ${str(formData, 'kind')} booking ${r.data.ref}`,
    )
  back(
    eventId,
    r.ok
      ? `Booking ${r.data.ref} created and tickets emailed`
      : `Could not create booking (${r.data.error ?? r.status})`,
    r.ok,
  )
}

export async function announceAction(formData: FormData) {
  const user = await requireStaff('admin')
  const eventId = str(formData, 'eventId')
  if (formData.get('confirm') !== 'on')
    back(eventId, 'Tick the confirmation box to send the announcement', false)
  const r = await internalApi<{ recipients?: number; sent?: number; error?: string }>(
    `/internal/events/${eventId}/announce`,
    {
      method: 'POST',
      body: { subject: str(formData, 'subject'), message: str(formData, 'message') },
    },
  )
  if (r.ok)
    await audit(
      user,
      'announcement',
      eventId,
      `Emailed ticket holders: ${str(formData, 'subject')}`,
    )
  back(
    eventId,
    r.ok
      ? `Announcement sent to ${r.data.sent} of ${r.data.recipients} ticket holders`
      : `Not sent (${r.data.error ?? r.status})`,
    r.ok,
  )
}

// ---------- gate (roles: gate, admin) ----------

export async function checkInAction(eventId: string, code: string): Promise<CheckinResult> {
  const user = await requireStaff('gate', 'admin')
  if (!(await mayScan(eventId, user))) return { result: 'error' }
  const r = await internalApi<CheckinResult>('/internal/checkin', {
    method: 'POST',
    body: { eventId, code, staff: typeof user.email === 'string' ? user.email : undefined },
  })
  return r.ok ? r.data : { result: 'error' }
}

export async function searchTicketsAction(eventId: string, q: string) {
  const user = await requireStaff('gate', 'admin')
  if (!(await mayScan(eventId, user))) return []
  const r = await internalApi<{
    tickets: { code: string; holder: string; tier: string; order: string; status: string }[]
  }>(`/internal/events/${eventId}/search?q=${encodeURIComponent(q)}`)
  return r.ok ? r.data.tickets : []
}

export async function countsAction(eventId: string) {
  const user = await requireStaff('gate', 'admin')
  if (!(await mayScan(eventId, user))) return null
  const r = await internalApi<{ tiers: { sold: number; checkedIn: number }[] }>(
    `/internal/events/${eventId}/stats`,
  )
  if (!r.ok) return null
  return {
    sold: r.data.tiers.reduce((a, t) => a + t.sold, 0),
    checkedIn: r.data.tiers.reduce((a, t) => a + t.checkedIn, 0),
  }
}

/** Organizers may scan any event; gate staff only the events they are assigned to. */
async function mayScan(eventId: string, user: { id: string | number; roles?: unknown }) {
  if (hasRole(user, 'admin')) return true
  const payload = await getPayloadClient()
  const event = await payload
    .findByID({ collection: 'events', id: eventId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const assigned = (event?.gateStaff ?? []).map((u) => (typeof u === 'object' ? u.id : u))
  return assigned.includes(String(user.id))
}
