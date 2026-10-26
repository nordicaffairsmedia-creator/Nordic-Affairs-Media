import { createHmac } from 'node:crypto'
import { getDb } from './db.js'
import { env } from './env.js'
import { sendEmail, esc } from './email.js'
import { orders, type Order } from './orders.js'

/*
 * "Left the checkout" reminder (Marketing center → Automations).
 *
 * One email to a buyer who picked tickets in the My Booking checkout, said yes to marketing
 * email, and did not pay. Rules (the same promises the Tickivo-style automation makes):
 *  - only people who ticked "marketing" at checkout, and not anyone who unsubscribed;
 *  - one email per order, never more; each order is claimed atomically before sending;
 *  - not sent if the buyer already bought for that event, or the event has started;
 *  - the email is only about the tickets they left, with a link to stop further email.
 */

type Doc = Record<string, unknown>

export type AbandonedCustom = { subject: string; message: string; button: string }
export type AbandonedSettings = { enabled: boolean; waitHours: number; discountCode: string; custom: { en: AbandonedCustom; sv: AbandonedCustom } }

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function abandonedSettings(): Promise<AbandonedSettings> {
  const doc = await getDb().collection<Doc>('globals').findOne({ globalType: 'marketing-automations' })
  const a = (doc?.abandoned ?? {}) as Record<string, unknown>
  const hours = Number(a.waitHours)
  const wait = Number.isFinite(hours) && hours >= 1 ? Math.min(hours, 72) : 1
  return {
    enabled: a.enabled === true,
    waitHours: wait,
    discountCode: typeof a.discountCode === 'string' ? a.discountCode.trim().toUpperCase() : '',
    custom: {
      en: { subject: str(a.subjectEn), message: str(a.messageEn), button: str(a.buttonEn) },
      sv: { subject: str(a.subjectSv), message: str(a.messageSv), button: str(a.buttonSv) },
    },
  }
}

/** Signs an email address so the website can verify an unsubscribe link without a login. */
export const unsubscribeSig = (email: string) =>
  createHmac('sha256', env.INTERNAL_API_KEY ?? 'no-key').update(email.toLowerCase()).digest('hex').slice(0, 32)

const text = {
  en: {
    subject: 'Your tickets for {event} are waiting',
    message: 'Hi {name},\n\nYou picked tickets for {event} but did not finish your order. They are not held for you anymore, so come back soon to be sure of your seats.',
    button: 'Back to the tickets',
    code: 'Use the code {code} at checkout.',
    why: 'You get this one email because you said yes to news from us when you started your order.',
    stop: 'Stop these emails',
  },
  sv: {
    subject: 'Dina biljetter till {event} väntar',
    message: 'Hej {name},\n\nDu valde biljetter till {event} men slutförde inte din beställning. Biljetterna hålls inte längre åt dig, så kom tillbaka snart för att försäkra dig om dina platser.',
    button: 'Tillbaka till biljetterna',
    code: 'Använd koden {code} i kassan.',
    why: 'Du får det här enda mejlet eftersom du tackade ja till nyheter från oss när du påbörjade din beställning.',
    stop: 'Sluta få dessa mejl',
  },
} as const

/** {name} = first name, {event} = event title, {code} = discount code. Same rules as the website preview (apps/web/src/lib/abandonedEmail.ts). */
const fill = (s: string, v: { name: string; event: string; code: string }) =>
  s
    .replace(v.name ? /\{name\}/g : /\s*\{name\}/g, v.name)
    .replace(/\{event\}/g, v.event)
    .replace(/\{code\}/g, v.code)

let sweeping = false
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Sends the reminder to every buyer who qualifies (up to 200 per run, one run every 5 minutes), paced to stay under
 * the email provider's rate limit. An email that fails is tried again on the next runs, up to 3 times, then given up.
 */
export async function sweepAbandonedCheckouts(now = new Date()): Promise<number> {
  if (!env.RESEND_API_KEY || sweeping) return 0
  sweeping = true
  try {
    return await sweepOnce(now)
  } finally {
    sweeping = false
  }
}

async function sweepOnce(now: Date): Promise<number> {
  const cfg = await abandonedSettings()
  if (!cfg.enabled) return 0
  const db = getDb()
  const notBefore = new Date(now.getTime() - 90 * 86400_000)
  const waited = new Date(now.getTime() - cfg.waitHours * 3600_000)
  let sent = 0
  const failedNow: Order['_id'][] = []
  for (let guard = 0; guard < 200; guard++) {
    // Claim one order at a time (so it is emailed at most once, even if two sweeps overlap).
    const order: Order | null = await orders().findOneAndUpdate(
      {
        status: { $in: ['pending', 'expired'] },
        'consent.marketing': true,
        email: { $regex: /@/ },
        abandonedReminderSentAt: { $exists: false },
        abandonedAttempts: { $not: { $gte: 3 } },
        _id: { $nin: failedNow },
        createdAt: { $gte: notBefore, $lte: waited },
        eventStartsAt: { $gt: now },
        source: { $in: ['online', undefined as never] },
      },
      { $set: { abandonedReminderSentAt: now } },
    )
    if (!order) break

    const email = order.email.toLowerCase()
    const unsubscribed = await db.collection<Doc>('subscribers').findOne({ email, status: 'unsubscribed' })
    const bought = await orders().findOne({
      email,
      eventId: order.eventId,
      status: { $in: ['paid', 'partially_refunded'] },
    })
    // Another reminder to the same person for the same event in the last 7 days: skip (one email per buyer and event).
    const again = await orders().findOne({
      _id: { $ne: order._id },
      email,
      eventId: order.eventId,
      abandonedReminderSentAt: { $exists: true },
    })
    if (unsubscribed || bought || again) continue

    const lang = order.locale === 'sv' ? 'sv' : 'en'
    const t = text[lang]
    const origin = order.webOrigin ?? env.WEB_URL
    const url = new URL(`${origin}/${order.locale}/events/${order.eventSlug}`)
    url.searchParams.set('utm_source', 'abandoned-checkout')
    url.searchParams.set('utm_medium', 'email')
    if (cfg.discountCode) url.searchParams.set('promo', cfg.discountCode)
    const stop = `${origin}/api/marketing/unsubscribe?e=${encodeURIComponent(email)}&s=${unsubscribeSig(email)}`
    const first = order.name.trim().split(/\s+/)[0] ?? ''
    const c = cfg.custom[lang]
    const vars = { name: first, event: order.eventTitle, code: cfg.discountCode }
    let paras = (c.message || t.message).replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    if (!cfg.discountCode) paras = paras.filter((p) => !p.includes('{code}'))
    else if (!paras.some((p) => p.includes('{code}'))) paras.push(t.code)
    const intro = paras.map((p) => fill(p, vars)).join('\n\n')
    const subject = fill(c.subject || t.subject, vars).replace(/\s+/g, ' ')
    const button = c.button || t.button

    const ok = await sendEmail({
      to: order.email,
      subject,
      text: `${intro}\n\n${button}: ${url}\n\n${t.why}\n${t.stop}: ${stop}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">${intro
        .split('\n\n')
        .map((p) => `<p style="line-height:1.55">${esc(p).replace(/\n/g, '<br>')}</p>`)
        .join('')}<p style="margin:24px 0"><a href="${esc(url.toString())}" style="background:#0b2447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block">${esc(button)}</a></p><p style="font-size:12px;color:#666">${esc(t.why)}<br><a href="${esc(stop)}" style="color:#666">${esc(t.stop)}</a></p></div>`,
    }).catch(() => false)
    if (ok) {
      sent++
      await pause(600)
    } else {
      // Not sent: give the order back so a later run tries again (max 3 tries).
      failedNow.push(order._id)
      await orders().updateOne({ _id: order._id }, { $unset: { abandonedReminderSentAt: '' }, $inc: { abandonedAttempts: 1 } })
      console.error(`[abandoned] ${order._id}: email not sent (try ${(order.abandonedAttempts ?? 0) + 1} of 3)`)
    }
  }
  return sent
}
