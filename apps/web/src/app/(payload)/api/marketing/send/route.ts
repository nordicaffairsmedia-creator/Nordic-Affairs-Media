import { NextResponse } from 'next/server'
import { hasRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { signedUnsubscribeUrl, ctaTarget, renderEmail, renderSms, smsCanReply, resolveRecipients, sendBatch, sendOne, sendSmsBatch, attachmentList, type Recipient } from '@/lib/marketing'
import { smsConfigured } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** POST { id, test?: "email or phone", count?: true } — sends a campaign (or one test), or just counts who it reaches. Organizers only. */
export async function POST(req: Request) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !hasRole(user, 'admin')) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { id?: string | number; test?: string; one?: string; preview?: boolean; count?: boolean }
  if (!body.id) return NextResponse.json({ error: 'Save the campaign first.' }, { status: 400 })
  const c = await payload.findByID({ collection: 'email-campaigns', id: body.id, depth: 2, overrideAccess: true }).catch(() => null)
  if (!c) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  const sms = c.channel === 'sms'
  const settings = (await payload.findGlobal({ slug: 'marketing-settings', overrideAccess: true }).catch(() => ({}))) as Record<string, string | null>

  if (body.count) {
    const n = (await resolveRecipients(payload, c as never)).length
    return NextResponse.json({ ok: true, message: `This reaches ${n} ${sms ? 'phone numbers' : 'people'}.` })
  }
  if (!sms && !c.subject?.trim()) return NextResponse.json({ error: 'Write a subject first and save.' }, { status: 400 })
  if (sms && !smsConfigured()) return NextResponse.json({ error: 'Text messages are not set up on the website yet (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM).' }, { status: 400 })
  const cta = await ctaTarget(payload, c as never)
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  if (body.preview) {
    if (sms) return NextResponse.json({ error: 'Preview is for email.' }, { status: 400 })
    const r: Recipient = { email: 'preview', firstName: 'Friend', phone: '', unsubscribeUrl: `${site}/en/newsletter` }
    return NextResponse.json({ ok: true, html: renderEmail(c as never, settings, cta, r, true).html })
  }

  // One person, with the chosen files attached for real.
  if (body.one) {
    if (sms) return NextResponse.json({ error: 'This is for email.' }, { status: 400 })
    const email = String(body.one).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'That email address looks wrong.' }, { status: 400 })
    const blocked = await payload.find({ collection: 'subscribers', where: { and: [{ email: { equals: email } }, { status: { equals: 'unsubscribed' } }] }, limit: 1, depth: 0, overrideAccess: true })
    if (blocked.docs[0]) return NextResponse.json({ error: 'That person unsubscribed. We cannot email them.' }, { status: 400 })
    const files = attachmentList(c as never)
    const r: Recipient = { email, firstName: '', phone: '', unsubscribeUrl: signedUnsubscribeUrl(email) }
    const out = await sendOne(settings, { to: email, ...renderEmail(c as never, settings, cta, r, false, { attachmentsAsLinks: false }), unsubscribeUrl: r.unsubscribeUrl }, files)
    return out.sent
      ? NextResponse.json({ ok: true, message: `Sent to ${email}${files.length ? ` with ${files.length} file${files.length === 1 ? '' : 's'} attached` : ''}. The campaign stays a draft.` })
      : NextResponse.json({ error: out.reason || 'Not sent.' }, { status: 502 })
  }

  if (body.test) {
    const to = String(body.test).trim()
    if (sms) {
      if (!/^\+[1-9]\d{6,14}$/.test(to)) return NextResponse.json({ error: 'Type the phone number with country code, e.g. +46701234567.' }, { status: 400 })
      const r: Recipient = { email: '', firstName: 'Friend', phone: to, unsubscribeUrl: '' }
      const out = await sendSmsBatch(settings, [{ to, body: renderSms(c as never, cta, r, true, smsCanReply(settings)) }])
      return out.sent ? NextResponse.json({ ok: true, message: `Test text sent to ${to}.` }) : NextResponse.json({ error: out.reason || 'Not sent.' }, { status: 502 })
    }
    const email = to.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'That email address looks wrong.' }, { status: 400 })
    const r: Recipient = { email, firstName: 'Friend', phone: '', unsubscribeUrl: `${site}/en/newsletter` }
    const out = await sendBatch(settings, [{ to: email, ...renderEmail(c as never, settings, cta, r, true), unsubscribeUrl: r.unsubscribeUrl }])
    return out.sent ? NextResponse.json({ ok: true, message: `Test sent to ${email}.` }) : NextResponse.json({ error: out.reason || 'Not sent.' }, { status: 502 })
  }

  if (c.status !== 'draft') return NextResponse.json({ error: 'This campaign was already sent. Duplicate it to send again.' }, { status: 409 })
  const people = await resolveRecipients(payload, c as never)
  if (!people.length) return NextResponse.json({ error: 'Nobody to send to. Pick an audience with people who agreed.' }, { status: 400 })

  // Claim it first, so a double click can never send twice.
  await payload.update({ collection: 'email-campaigns', id: c.id, data: { status: 'sending', recipientCount: people.length }, overrideAccess: true })
  const out = sms
    ? await sendSmsBatch(settings, people.map((r) => ({ to: r.phone, body: renderSms(c as never, cta, r, false, smsCanReply(settings)) })))
    : await sendBatch(settings, people.map((r) => ({ to: r.email, ...renderEmail(c as never, settings, cta, r), unsubscribeUrl: r.unsubscribeUrl })))
  await payload.update({
    collection: 'email-campaigns',
    id: c.id,
    data: { status: out.sent ? 'sent' : 'draft', sentAt: new Date().toISOString(), sentCount: out.sent, failedCount: out.failed },
    overrideAccess: true,
  })
  return NextResponse.json({ ok: out.sent > 0, message: `Sent to ${out.sent} people${out.failed ? `, ${out.failed} failed (${out.reason})` : ''}.` }, { status: out.sent ? 200 : 502 })
}
