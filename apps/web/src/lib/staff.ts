import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { hasRole, type Role } from '@/access/roles'
import { getPayloadClient } from './payload'

/**
 * Staff sign-in reuses the content-manager accounts and roles. Signing in at
 * /staff/login (or /admin) sets Payload's own secure cookie; this reads it.
 */
export async function getStaffUser() {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  return user
}

/**
 * Use at the top of every staff page and action. Roles: 'admin' = organizer,
 * 'gate' = door staff. SuperAdmin always passes; no roles = SuperAdmin only.
 */
export async function requireStaff(...roles: Role[]) {
  const user = await getStaffUser()
  if (!user) redirect('/staff/login')
  if (!hasRole(user, ...roles)) redirect('/staff/login?denied=1')
  return user
}

const base = (process.env.BOOKING_API_URL || process.env.NEXT_PUBLIC_BOOKING_API_URL || '').replace(
  /\/$/,
  '',
)

/** Server-to-server call to the booking API's staff endpoints. The key never reaches a browser. */
export async function internalApi<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
) {
  if (!base || !process.env.INTERNAL_API_KEY) {
    return {
      ok: false as const,
      status: 503,
      data: { error: 'booking_api_not_configured' } as unknown as T,
    }
  }
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': process.env.INTERNAL_API_KEY,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  }).catch(() => null)
  if (!res)
    return {
      ok: false as const,
      status: 502,
      data: { error: 'booking_api_unreachable' } as unknown as T,
    }
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

export const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100)

export const stockholmTime = (iso: string | Date | null | undefined) =>
  !iso
    ? 'Date to be announced'
    :   new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(iso))
