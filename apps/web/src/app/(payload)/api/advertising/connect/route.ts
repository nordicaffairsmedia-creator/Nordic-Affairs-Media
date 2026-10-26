import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { hasRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { oauthRedirectUri, metaReady, SCOPES, GRAPH } from '@/lib/meta'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

/** Starts "Continue with Facebook": sends the organizer to Facebook's sign-in and permission dialog. */
export async function GET(req: Request) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  const back = (q: string) => NextResponse.redirect(`${siteUrl}/admin/globals/advertising-settings?${q}`)
  if (!user || !hasRole(user, 'admin')) return NextResponse.redirect(`${siteUrl}/admin/login`)
  if (!metaReady()) return back('error=not-configured')
  const state = randomBytes(16).toString('hex')
  const url = new URL(GRAPH.replace('graph.', 'www.') + '/dialog/oauth')
  url.searchParams.set('client_id', process.env.META_APP_ID!)
  url.searchParams.set('redirect_uri', oauthRedirectUri(siteUrl))
  url.searchParams.set('state', state)
  // "Facebook Login for Business" apps sign in with a saved configuration (META_LOGIN_CONFIG_ID) instead of a list of permissions.
  const config = (process.env.META_LOGIN_CONFIG_ID ?? '').trim()
  if (config) {
    url.searchParams.set('config_id', config)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('override_default_response_type', 'true')
  } else url.searchParams.set('scope', SCOPES)
  const res = NextResponse.redirect(url)
  res.cookies.set('nam_meta_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 })
  return res
}
