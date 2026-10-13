import 'server-only'

/** Simple per-address limits for one server instance. */
const seen = new Map<string, number[]>()

/** The visitor's address as Render's proxy saw it (the last hop; earlier entries can be forged). */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'
}

export function rateLimited(key: string, perMinute = 20, perDay = 200): boolean {
  const now = Date.now()
  const times = (seen.get(key) ?? []).filter((t) => now - t < 86_400_000)
  if (times.filter((t) => now - t < 60_000).length >= perMinute || times.length >= perDay) {
    seen.set(key, times)
    return true
  }
  times.push(now)
  seen.delete(key) // re-insert so the Map stays ordered oldest → newest
  seen.set(key, times)
  if (seen.size > 5000) {
    // Forget the longest-idle addresses, never everyone at once.
    let drop = seen.size - 4000
    for (const k of seen.keys()) {
      if (drop-- <= 0) break
      seen.delete(k)
    }
  }
  return false
}
