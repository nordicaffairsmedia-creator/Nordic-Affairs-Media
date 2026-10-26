import { escapeHtml } from '@/lib/mail'

/** The "left the checkout" email, as the buyer gets it. Same words as the booking server sends (apps/api/src/abandoned.ts). */
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

export function renderAbandoned(o: { lang: 'en' | 'sv'; eventTitle: string; firstName: string; url: string; stopUrl: string; code?: string; test?: boolean }) {
  const t = text[o.lang]
  const intro = `${t.hello(o.firstName)}\n\n${t.body(o.eventTitle)}${o.code ? `\n\n${t.code(o.code)}` : ''}`
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;padding:16px">${o.test ? '<p style="color:#b45309;font-size:12px">This is a test email.</p>' : ''}${intro
    .split('\n\n')
    .map((p) => `<p style="line-height:1.55">${escapeHtml(p)}</p>`)
    .join('')}<p style="margin:24px 0"><a href="${escapeHtml(o.url)}" style="background:#0b2447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block">${escapeHtml(t.button)}</a></p><p style="font-size:12px;color:#666">${escapeHtml(t.why)}<br><a href="${escapeHtml(o.stopUrl)}" style="color:#666">${escapeHtml(t.stop)}</a></p></div>`
  return {
    subject: `${o.test ? '[Test] ' : ''}${t.subject(o.eventTitle)}`,
    html,
    text: `${intro}\n\n${t.button}: ${o.url}\n\n${t.why}\n${t.stop}: ${o.stopUrl}`,
  }
}
