import { createHmac } from 'node:crypto'
import { getDb } from './db.js'
import { env } from './env.js'
import { sendEmail, esc } from './email.js'
import { orders, type Order } from './orders.js'

/*
 * "Left the checkout" reminder (Marketing center → Marketing settings → Automations).
 *
 * One email to a buyer who picked tickets in the My Booking checkout, said yes to marketing
 * email, and did not pay. Rules (the same promises the Tickivo-style automation makes):
 *  - only people who ticked "marketing" at checkout, and not anyone who unsubscribed;
 *  - one email per order, never more; each order is claimed atomically before sending;
 *  - not sent if the buyer already bought for that event, or the event has started;
 *  - the email is only about the tickets they left, with a link to stop further email.
 */

type Doc = Record<string, unknown>

export type AbandonedSettings = { enabled: boolean; waitHours: number; discountCode: string }

export async function abandonedSettings(): Promise<AbandonedSettings> {
  const doc = await getDb().collection<Doc>('globals').findOne({ globalType: 'marketing-settings' })
  const a = (doc?.abandoned ?? {}) as Record<string, unknown>
  const wait = typeof a.waitHours === 'number' && a.waitHours >= 1 ? Math.min(a.waitHours, 72) : 1
  return {
    enabled: a.enabled === true,
    waitHours: wait,
    discountCode: typeof a.discountCode === 'string' ? a.discountCode.trim().toUpperCase() : '',
  }
}

/** Signs an email address so the website can verify an unsubscribe link without a login. */
export const unsubscribeSig = (email: string) =>
  createHmac('sha256', env.INTERNAL_API_KEY ?? 'no-key').update(email.toLowerCase()).digest('hex').slice(0, 32)

const text = {
  en: {
    subject: (t: string) => `Your tickets for ${t} are waiting`,
    hello: (n: string) => (n ? `Hi ${n},` : 'Hi,'),
    body: (t: string) => `You picked tickets for ${t} but did not finish your order. They are not held for you anymore, so come back soon to be sure of your seats.`,
    code: (c: string) => `Use the code ${c} at checkout.`,
    button: 'Back to the tickets',
    why: 'You get this one email because you said yes to news from us when you started your order.',
    stop: 'Stop these emails',
  },
  sv: {
    subject: (t: string) => `Dina biljetter till ${t} väntar`,
    hello: (n: string) => (n ? `Hej ${n},` : 'Hej,'),
    body: (t: string) => `Du valde biljetter till ${t} men slutförde inte din beställning. Biljetterna hålls inte längre åt dig, så kom tillbaka snart för att försäkra dig om dina platser.`,
    code: (c: string) => `Använd koden ${c} i kassan.`,
    button: 'Tillbaka till biljetterna',
    why: 'Du får det här enda mejlet eftersom du tackade ja till nyheter från oss när du påbörjade din beställning.',
    stop: 'Sluta få dessa mejl',
  },
} as const

export async function sweepAbandonedCheckouts(now = new Date()): Promise<number> {
  if (!env.RESEND_API_KEY) return 0
  const cfg = await abandonedSettings()
  if (!cfg.enabled) return 0
  const db = getDb()
  const notBefore = new Date(now.getTime() - 90 * 86400_000)
  const waited = new Date(now.getTime() - cfg.waitHours * 3600_000)
  let sent = 0
  for (let guard = 0; guard < 50; guard++) {
    // Claim one order at a time (so it is emailed at most once, even if two sweeps overlap).
    const order: Order | null = await orders().findOneAndUpdate(
      {
        status: { $in: ['pending', 'expired'] },
        'consent.marketing': true,
        email: { $regex: /@/ },
        abandonedReminderSentAt: { $exists: false },
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
    const intro = `${t.hello(first)}\n\n${t.body(order.eventTitle)}${cfg.discountCode ? `\n\n${t.code(cfg.discountCode)}` : ''}`

    const ok = await sendEmail({
      to: order.email,
      subject: t.subject(order.eventTitle),
      text: `${intro}\n\n${t.button}: ${url}\n\n${t.why}\n${t.stop}: ${stop}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">${intro
        .split('\n\n')
        .map((p) => `<p style="line-height:1.55">${esc(p)}</p>`)
        .join('')}<p style="margin:24px 0"><a href="${esc(url.toString())}" style="background:#0b2447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block">${esc(t.button)}</a></p><p style="font-size:12px;color:#666">${esc(t.why)}<br><a href="${esc(stop)}" style="color:#666">${esc(t.stop)}</a></p></div>`,
    }).catch(() => false)
    if (ok) sent++
    else console.error(`[abandoned] ${order._id}: email not sent`)
  }
  return sent
}
