import 'server-only'
import { createHmac } from 'node:crypto'
import type { Payload } from 'payload'
import { escapeHtml } from '@/lib/mail'
import { sendSmsDetailed } from '@/lib/sms'
import { siteUrl } from '@/lib/site'

/*
 * Marketing messages: who a campaign reaches, what it looks like, and sending it.
 * Email goes through Resend's batch API, text messages through Twilio.
 * Every email has a one-click unsubscribe; every text ends with "Reply STOP to unsubscribe".
 * Nobody who unsubscribed (newsletter list, any recipient list or a signed link) is ever sent to.
 */

export type Recipient = { email: string; firstName: string; phone: string; unsubscribeUrl: string }

type Campaign = {
  id: string | number
  channel?: 'email' | 'sms' | null
  subject?: string | null
  preheader?: string | null
  body: string
  ctaLabel?: string | null
  ctaUrl?: string | null
  trackingLink?: { slug?: string } | string | number | null
  sendToSubscribers?: boolean | null
  sendToCustomers?: boolean | null
  sendToAbandoned?: boolean | null
  lists?: ({ id: string | number } | string | number)[] | null
}

type Settings = { senderName?: string | null; senderEmail?: string | null; replyTo?: string | null; footerText?: string | null; smsSender?: string | null }

const idOf = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: string | number }).id : (v as string | number))

/** Signs an email address, so an unsubscribe link needs no login. Same recipe as the booking server. */
export const unsubscribeSig = (email: string) =>
  createHmac('sha256', process.env.INTERNAL_API_KEY ?? 'no-key').update(email.toLowerCase()).digest('hex').slice(0, 32)
export const signedUnsubscribeUrl = (email: string) => `${siteUrl}/api/marketing/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&s=${unsubscribeSig(email)}`

type Orders = { find: (f: object, o?: object) => { toArray: () => Promise<Record<string, unknown>[]> } }
const ordersOf = (payload: Payload): Orders | null => {
  try {
    return (payload.db as unknown as { connection: { db: { collection: (n: string) => Orders } } }).connection.db.collection('booking_orders')
  } catch {
    return null
  }
}

/** Everyone the campaign reaches, one row per person, nobody who unsubscribed. SMS needs a phone number. */
export async function resolveRecipients(payload: Payload, c: Campaign): Promise<Recipient[]> {
  const sms = c.channel === 'sms'
  const out = new Map<string, Recipient>()
  const blocked = new Set<string>()
  const key = (r: { email: string; phone: string }) => (sms ? r.phone : r.email)

  const unsub = await payload.find({ collection: 'subscribers', where: { status: { equals: 'unsubscribed' } }, limit: 5000, pagination: false, overrideAccess: true })
  for (const s of unsub.docs) blocked.add(String(s.email).toLowerCase())

  const add = (r: Recipient) => {
    const k = key(r)
    if (k && !out.has(k)) out.set(k, r)
  }

  if (c.sendToSubscribers && !sms) {
    const subs = await payload.find({ collection: 'subscribers', where: { status: { equals: 'confirmed' } }, limit: 5000, pagination: false, overrideAccess: true })
    for (const s of subs.docs) {
      const email = String(s.email).toLowerCase()
      add({ email, firstName: '', phone: '', unsubscribeUrl: `${siteUrl}/${s.locale || 'en'}/newsletter?unsubscribe=${s.token}` })
    }
  }
  for (const l of c.lists ?? []) {
    const list = await payload.findByID({ collection: 'recipient-lists', id: idOf(l), depth: 0, overrideAccess: true }).catch(() => null)
    if (!list || !list.consentConfirmed) continue
    for (const p of list.contacts ?? []) {
      const email = String(p.email).toLowerCase()
      if (p.unsubscribed) {
        blocked.add(email)
        continue
      }
      add({ email, firstName: p.firstName || '', phone: p.phone || '', unsubscribeUrl: `${siteUrl}/api/marketing/unsubscribe?l=${list.id}&t=${p.token}` })
    }
  }

  // Ticket buyers and checkout leavers come from the booking orders; only people who ticked the marketing box.
  const orders = ordersOf(payload)
  if (orders && (c.sendToCustomers || c.sendToAbandoned)) {
    const since = new Date(Date.now() - 90 * 86400_000)
    const paid = ['paid', 'partially_refunded']
    const queries: object[] = []
    if (c.sendToCustomers) queries.push({ 'consent.marketing': true, status: { $in: paid } })
    if (c.sendToAbandoned) queries.push({ 'consent.marketing': true, status: { $in: ['pending', 'expired'] }, createdAt: { $gte: since } })
    const rows = await orders.find({ $or: queries }, { projection: { email: 1, name: 1, phone: 1, status: 1, eventId: 1 } }).toArray()
    const boughtFor = new Set(rows.filter((o) => paid.includes(String(o.status))).map((o) => `${String(o.email).toLowerCase()}|${o.eventId}`))
    for (const o of rows) {
      const email = String(o.email ?? '').toLowerCase()
      if (!email.includes('@')) continue
      const isPaid = paid.includes(String(o.status))
      if (!isPaid && boughtFor.has(`${email}|${o.eventId}`)) continue
      add({ email, firstName: String(o.name ?? '').trim().split(/\s+/)[0] ?? '', phone: String(o.phone ?? ''), unsubscribeUrl: signedUnsubscribeUrl(email) })
    }
  }
  return [...out.values()].filter((r) => !blocked.has(r.email))
}

export async function ctaTarget(payload: Payload, c: Campaign): Promise<string> {
  const t = c.trackingLink
  if (t) {
    const link = typeof t === 'object' ? t : await payload.findByID({ collection: 'tracking-links', id: t, depth: 0, overrideAccess: true }).catch(() => null)
    if (link?.slug) return `${siteUrl}/api/go/${link.slug}?c=${c.id}`
  }
  return c.ctaUrl?.trim() || ''
}

const fillName = (t: string, first: string) => t.replace(/\{\{\s*firstName\s*\}\}/g, first)

export function renderEmail(c: Campaign, s: Settings, cta: string, r: Recipient, test = false) {
  const first = r.firstName || ''
  const paragraphs = fillName(c.body, first).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const footer = (s.footerText || 'Nordic Affairs Media, Sweden').trim()
  const button =
    cta && c.ctaLabel
      ? `<p style="margin:28px 0"><a href="${escapeHtml(cta)}" style="background:#0b2447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block">${escapeHtml(c.ctaLabel)}</a></p>`
      : ''
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
${c.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(fillName(c.preheader, first))}</div>` : ''}
<div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:8px;padding:28px">
${test ? '<p style="color:#b45309;font-size:12px;margin:0 0 12px">This is a test email.</p>' : ''}
${paragraphs.map((p) => `<p style="line-height:1.55;margin:0 0 16px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')}
${button}</div>
<p style="font-size:12px;color:#666;text-align:center;line-height:1.5;margin:16px 0 0">${escapeHtml(footer).replace(/\n/g, '<br>')}<br><a href="${escapeHtml(r.unsubscribeUrl)}" style="color:#666">Unsubscribe</a></p></div></body></html>`
  const text = `${paragraphs.join('\n\n')}${cta && c.ctaLabel ? `\n\n${c.ctaLabel}: ${cta}` : ''}\n\n--\n${footer}\nUnsubscribe: ${r.unsubscribeUrl}`
  return { subject: `${test ? '[Test] ' : ''}${fillName(c.subject || '', first)}`, html, text }
}

/** People can reply STOP only when the text comes from a real phone number (or a Twilio messaging service). A sender name cannot receive replies. */
export const smsCanReply = (s: Settings) => {
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) return true
  const from = (s.smsSender || process.env.TWILIO_FROM || '').trim()
  return from.startsWith('+') || /^\d{6,}$/.test(from)
}

export function renderSms(c: Campaign, cta: string, r: Recipient, test = false, canReply = true) {
  const body = fillName(c.body, r.firstName || '').replace(/\s*\n\s*/g, ' ').trim()
  const optOut = canReply ? 'Reply STOP to unsubscribe.' : `Unsubscribe: ${r.unsubscribeUrl}`
  return `${test ? '[Test] ' : ''}${body}${cta ? ` ${cta}` : ''} ${optOut}`
}

/** Sends texts one by one (Twilio has no batch call). Returns how many were accepted. */
export async function sendSmsBatch(s: Settings, items: { to: string; body: string }[]) {
  let sent = 0
  let failed = 0
  let firstError: string | undefined
  for (let i = 0; i < items.length; i += 10) {
    const results = await Promise.all(items.slice(i, i + 10).map((m) => sendSmsDetailed(m.to, m.body, s.smsSender || undefined)))
    for (const r of results) {
      if (r.ok) sent++
      else {
        failed++
        firstError ||= r.error
      }
    }
  }
  return { sent, failed, reason: failed ? firstError || 'Twilio did not accept some messages (check TWILIO_* settings and the phone numbers).' : '' }
}

const sender = (s: Settings) => {
  const email = s.senderEmail?.trim()
  const name = (s.senderName || 'Nordic Affairs Media').replace(/[<>"]/g, '')
  if (email) return `${name} <${email}>`
  return process.env.EMAIL_FROM || `${name} <onboarding@resend.dev>`
}

/** Sends the prepared emails, 100 per call. Returns how many were accepted and how many failed. */
export async function sendBatch(
  s: Settings,
  mails: { to: string; subject: string; html: string; text: string; unsubscribeUrl: string }[],
) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: 0, failed: mails.length, reason: 'RESEND_API_KEY is not set on the website.' }
  let sent = 0
  let failed = 0
  let reason = ''
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100)
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        chunk.map((m) => ({
          from: sender(s),
          to: [m.to],
          subject: m.subject,
          html: m.html,
          text: m.text,
          reply_to: s.replyTo || undefined,
          headers: { 'List-Unsubscribe': `<${m.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        })),
      ),
    }).catch(() => null)
    if (res?.ok) sent += chunk.length
    else {
      failed += chunk.length
      reason = res ? `Resend said ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` : 'Could not reach Resend.'
    }
  }
  return { sent, failed, reason }
}
