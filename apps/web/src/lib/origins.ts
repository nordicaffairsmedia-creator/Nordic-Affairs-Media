/**
 * Addresses the browser may sign in from. Payload only accepts the sign-in cookie on
 * requests (every save, upload and button press in the admin and /staff is one) whose
 * Origin is on this list; anything else is treated as signed out, so the person is sent
 * back to the login page again and again. Hosts differ per platform (Vercel serves one
 * site on several addresses: production, per-deployment and branch URLs), so all the
 * known ones are listed. Add a custom domain with ALLOWED_ORIGINS=https://a.com,https://www.a.com
 */
export function allowedOrigins(): string[] {
  const list = new Set<string>()
  const add = (raw?: string | null) => {
    const v = raw?.trim()
    if (!v) return
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
      list.add(u.origin)
      // The same site with and without "www."
      if (u.hostname.startsWith('www.')) list.add(`${u.protocol}//${u.hostname.slice(4)}${u.port ? `:${u.port}` : ''}`)
      else if (u.hostname.split('.').length === 2) list.add(`${u.protocol}//www.${u.hostname}${u.port ? `:${u.port}` : ''}`)
    } catch {
      // ignore anything that is not an address
    }
  }
  add(process.env.NEXT_PUBLIC_SITE_URL)
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  add(process.env.VERCEL_URL)
  add(process.env.VERCEL_BRANCH_URL)
  add(process.env.RENDER_EXTERNAL_URL)
  for (const o of (process.env.ALLOWED_ORIGINS ?? '').split(',')) add(o)
  if (process.env.NODE_ENV !== 'production') add('http://localhost:3000')
  return [...list]
}
