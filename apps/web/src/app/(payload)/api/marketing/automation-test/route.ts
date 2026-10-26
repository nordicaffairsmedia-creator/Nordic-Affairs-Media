import { NextResponse } from 'next/server'
import { hasRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { renderAbandoned, customFor } from '@/lib/abandonedEmail'
import { sendBatch, signedUnsubscribeUrl } from '@/lib/marketing'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

/** POST { to?, lang? } — `to` can hold several addresses (comma, space or new line). Sends the "left the checkout" email as a test, with the next upcoming event. Organizers only. */
export async function POST(req: Request) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !hasRole(user, 'admin')) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as { to?: string; lang?: string }
  const lang = body.lang === 'sv' ? 'sv' : 'en'
  const typed = (body.to ?? '').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
  const list = [...new Set(typed.length ? typed : [String((user as { email?: string }).email ?? '').toLowerCase()])]
  const bad = list.filter((a) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a))
  if (bad.length || !list.length) return NextResponse.json({ error: `That email address looks wrong: ${bad.join(', ') || '(empty)'}` }, { status: 400 })
  if (list.length > 10) return NextResponse.json({ error: 'Up to 10 addresses at a time.' }, { status: 400 })

  const ev = await payload.find({ collection: 'events', where: { startsAt: { greater_than: new Date().toISOString() } }, sort: 'startsAt', limit: 1, depth: 0, locale: 'en', overrideAccess: true })
  const event = ev.docs[0]
  if (!event) return NextResponse.json({ error: 'There is no upcoming event to use in the test.' }, { status: 400 })
  const auto = await payload.findGlobal({ slug: 'marketing-automations', overrideAccess: true }).catch(() => null)
  const code = (auto?.abandoned?.discountCode || '').trim().toUpperCase()
  const settings = (await payload.findGlobal({ slug: 'marketing-settings', overrideAccess: true }).catch(() => ({}))) as Record<string, string | null>

  const url = new URL(`${siteUrl}/${lang}/events/${event.slug}`)
  url.searchParams.set('utm_source', 'abandoned-checkout')
  url.searchParams.set('utm_medium', 'email')
  const first = String((user as { name?: string }).name ?? '').split(/\s+/)[0] ?? ''
  const msgs = list.map((to) => {
    const stopUrl = signedUnsubscribeUrl(to)
    const mail = renderAbandoned({ lang, eventTitle: String(event.title), firstName: first, url: url.toString(), stopUrl, code: code || undefined, test: true, custom: customFor(auto, lang) })
    return { to, subject: mail.subject, html: mail.html, text: mail.text, unsubscribeUrl: stopUrl }
  })
  const out = await sendBatch(settings, msgs)
  return out.sent ? NextResponse.json({ ok: true, message: `Test sent to ${list.join(', ')}.` }) : NextResponse.json({ error: out.reason || 'Not sent.' }, { status: 502 })
}
