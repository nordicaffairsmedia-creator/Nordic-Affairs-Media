import { escapeHtml } from '@/lib/mail'

/**
 * The "left the checkout" email, as the buyer gets it. The booking server (apps/api/src/abandoned.ts) uses the same rules.
 * The subject, message and button can be changed in Marketing center → Automations; empty = the standard text below.
 * In your own text: {name} = the buyer's first name, {event} = the event, {code} = the discount code.
 */
export const defaults = {
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

export type AbandonedCustom = { subject?: string | null; message?: string | null; button?: string | null }

const fill = (s: string, v: { name: string; event: string; code: string }) =>
  s
    .replace(v.name ? /\{name\}/g : /\s*\{name\}/g, v.name)
    .replace(/\{event\}/g, v.event)
    .replace(/\{code\}/g, v.code)

export function renderAbandoned(o: { lang: 'en' | 'sv'; eventTitle: string; firstName: string; url: string; stopUrl: string; code?: string; test?: boolean; custom?: AbandonedCustom }) {
  const d = defaults[o.lang]
  const pick = (v: string | null | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback)
  const vars = { name: o.firstName, event: o.eventTitle, code: o.code ?? '' }
  const subject = fill(pick(o.custom?.subject, d.subject), vars).replace(/\s+/g, ' ')
  const button = pick(o.custom?.button, d.button)
  let paras = pick(o.custom?.message, d.message).replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const usesCode = paras.some((p) => p.includes('{code}'))
  // No discount set: drop any paragraph that talks about the code. Discount set but not mentioned: add the standard line.
  if (!o.code) paras = paras.filter((p) => !p.includes('{code}'))
  else if (!usesCode) paras.push(d.code)
  const intro = paras.map((p) => fill(p, vars)).join('\n\n')
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;padding:16px">${o.test ? '<p style="color:#b45309;font-size:12px">This is a test email.</p>' : ''}${intro
    .split('\n\n')
    .map((p) => `<p style="line-height:1.55">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')}<p style="margin:24px 0"><a href="${escapeHtml(o.url)}" style="background:#0b2447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block">${escapeHtml(button)}</a></p><p style="font-size:12px;color:#666">${escapeHtml(d.why)}<br><a href="${escapeHtml(o.stopUrl)}" style="color:#666">${escapeHtml(d.stop)}</a></p></div>`
  return {
    subject: `${o.test ? '[Test] ' : ''}${subject}`,
    html,
    text: `${intro}\n\n${button}: ${o.url}\n\n${d.why}\n${d.stop}: ${o.stopUrl}`,
  }
}

/** Picks the saved custom text for one language out of the Automations global. */
export function customFor(auto: unknown, lang: 'en' | 'sv'): AbandonedCustom {
  const a = ((auto as { abandoned?: Record<string, string | null> } | null)?.abandoned ?? {}) as Record<string, string | null>
  const L = lang === 'en' ? 'En' : 'Sv'
  return { subject: a['subject' + L], message: a['message' + L], button: a['button' + L] }
}
