import { NextResponse } from 'next/server'
import { hasRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { exchangeCode, graph, oauthRedirectUri } from '@/lib/meta'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

/** Facebook sends the organizer back here with a one-time code. We keep a long-lived token and list the pages and ad accounts. */
export async function GET(req: Request) {
  const u = new URL(req.url)
  const back = (q: string) => NextResponse.redirect(`${siteUrl}/admin/globals/advertising-settings?${q}`)
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !hasRole(user, 'admin')) return NextResponse.redirect(`${siteUrl}/admin/login`)

  const cookie = req.headers.get('cookie')?.match(/(?:^|; )nam_meta_state=([a-f0-9]+)/)?.[1]
  if (u.searchParams.get('error')) return back('error=denied')
  const code = u.searchParams.get('code')
  if (!code || !cookie || cookie !== u.searchParams.get('state')) return back('error=state')

  try {
    const { token, expiresIn } = await exchangeCode(code, oauthRedirectUri(siteUrl))
    const pages = await graph<{ data?: { id: string; name: string }[] }>('me/accounts', token, { params: { fields: 'id,name', limit: 50 } })
    const accounts = await graph<{ data?: { account_id: string; name: string; currency?: string; account_status?: number }[] }>('me/adaccounts', token, {
      params: { fields: 'account_id,name,currency,account_status', limit: 50 },
    })
    const p = pages.data ?? []
    const a = accounts.data ?? []
    await payload.updateGlobal({
      slug: 'advertising-settings',
      overrideAccess: true,
      data: {
        accessToken: token,
        tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
        connectedAt: new Date().toISOString(),
        pagesFound: p.map((x) => `${x.id} — ${x.name}`).join('\n'),
        adAccountsFound: a.map((x) => `${x.account_id} — ${x.name}${x.currency ? ` (${x.currency})` : ''}`).join('\n'),
        // One page / one ad account: pick it for them.
        ...(p.length === 1 ? { pageId: p[0]!.id, pageName: p[0]!.name } : {}),
        ...(a.length === 1 ? { adAccountId: a[0]!.account_id, adAccountName: a[0]!.name } : {}),
      },
    })
    const res = back('connected=1')
    res.cookies.delete('nam_meta_state')
    return res
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 120) : 'failed')}`)
  }
}
