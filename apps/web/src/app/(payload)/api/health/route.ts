/**
 * Lightweight liveness check for Render (`healthCheckPath`). It touches no database and
 * no cached page, so a slow database or a freshly purged page cache can never make the
 * host think the site is down and restart it.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export const HEAD = GET
