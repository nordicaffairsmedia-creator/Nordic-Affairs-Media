import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { siteUrl, routes } from '@/lib/site'

export const dynamic = 'force-dynamic'

const BOTS = /bot|crawl|spider|slurp|preview|monitor|lighthouse|headless|curl|wget|python|axios/i

/** A tracking link: counts the click, then sends the visitor on to the event or address. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const payload = await getPayloadClient()
  const found = await payload.find({ collection: 'tracking-links', where: { slug: { equals: slug } }, limit: 1, depth: 1, overrideAccess: true })
  const link = found.docs[0]
  if (!link) return NextResponse.redirect(siteUrl, 302)

  const ev = link.event && typeof link.event === 'object' ? (link.event as { slug?: string }) : null
  const base = ev?.slug ? `${siteUrl}/en${routes.event(ev.slug)}` : link.destination?.trim() || siteUrl
  let target: URL
  try {
    target = new URL(base)
  } catch {
    target = new URL(siteUrl)
  }
  target.searchParams.set('utm_source', link.slug)
  target.searchParams.set('utm_medium', 'tracking-link')

  if (!BOTS.test(req.headers.get('user-agent') ?? '')) {
    const now = new Date().toISOString()
    await payload.update({ collection: 'tracking-links', id: link.id, data: { clicks: (link.clicks ?? 0) + 1, lastClickAt: now }, overrideAccess: true }).catch(() => null)
    const c = new URL(req.url).searchParams.get('c')
    if (c) {
      const camp = await payload.findByID({ collection: 'email-campaigns', id: c, depth: 0, overrideAccess: true }).catch(() => null)
      if (camp) await payload.update({ collection: 'email-campaigns', id: camp.id, data: { clicks: (camp.clicks ?? 0) + 1 }, overrideAccess: true }).catch(() => null)
    }
  }
  const res = NextResponse.redirect(target, 302)
  // Remember the link for 30 days, so a ticket order made later can be traced back to it.
  res.cookies.set('nam_src', link.slug, { path: '/', maxAge: 30 * 86400, sameSite: 'lax', secure: true })
  return res
}
