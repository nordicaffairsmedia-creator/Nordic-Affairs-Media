import type { Payload } from 'payload'

/** Writes one row to the sign-in log. Never throws — logging must not block a sign-in. */
export async function logLogin(
  payload: Payload,
  entry: { email?: string; ok: boolean; source: 'admin' | 'staff'; headers?: { get(name: string): string | null } | null },
) {
  const ip =
    entry.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || entry.headers?.get('x-real-ip') || ''
  await payload
    .create({
      collection: 'login-events' as never,
      overrideAccess: true,
      data: { email: (entry.email ?? '').toLowerCase().slice(0, 200), ok: entry.ok, source: entry.source, ip } as never,
    })
    .catch(() => undefined)
}
