import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Document } from 'mongodb'
import { z } from 'zod'
import {
  LOCALES,
  getAssistantSettings,
  getSettings,
  getVenueName,
  pick,
  richTextToPlain,
  type CatalogEvent,
  type Locale,
} from '../catalog.js'
import { getDb } from '../db.js'
import { env } from '../env.js'
import { formatDateTime } from '../messages.js'
import { orders, sha256 } from '../orders.js'
import { formatMoney, toMinor } from '../pricing.js'

export const assistantRouter = Router()

const LANGUAGE: Record<Locale, string> = {
  en: 'English',
  sv: 'Swedish',
  ta: 'Tamil',
  ml: 'Malayalam',
}
const MAX_CONTEXT = 14_000

/** Tells the website whether to show the chat bubble. */
assistantRouter.get('/config', async (_req, res) => {
  const [assistant, settings] = await Promise.all([getAssistantSettings(), getSettings()])
  res.set('Cache-Control', 'public, max-age=60').json({
    assistant: assistant.enabled && Boolean(env.OPENAI_API_KEY),
    ticketSales: settings.features.ticketSales,
  })
})

/** Upcoming events in the visitor's language, as plain facts. */
async function eventFacts(locale: Locale): Promise<string> {
  const list = await getDb()
    .collection<CatalogEvent>('events')
    .find({
      _status: 'published',
      startsAt: { $gt: new Date() },
      salesStatus: { $ne: 'cancelled' },
    })
    .sort({ startsAt: 1 })
    .limit(25)
    .toArray()
  const lines = await Promise.all(
    list.map(async (e) => {
      const prices = (e.tiers ?? [])
        .map((t) => `${pick(t.name, locale)} ${formatMoney(toMinor(t.price), e.currency)}`)
        .join('; ')
      const languages = ((e as unknown as { eventLanguage?: string[] }).eventLanguage ?? []).join(
        ', ',
      )
      return [
        `- ${pick(e.title, locale)}`,
        `  when: ${formatDateTime(new Date(e.startsAt), locale)} (Stockholm time)`,
        `  where: ${await getVenueName(e.venue)}`,
        prices ? `  tickets: ${prices}` : '',
        languages ? `  event language: ${languages}` : '',
        `  status: ${e.salesStatus ?? 'onSale'}`,
        `  page: ${env.WEB_URL}/${locale}/events/${e.slug}`,
      ]
        .filter(Boolean)
        .join('\n')
    }),
  )
  return lines.join('\n') || '(no upcoming events published)'
}

/** Published FAQ / policy pages, in the visitor's language. */
async function pageFacts(locale: Locale): Promise<string> {
  const pages = await getDb()
    .collection<Document>('pages')
    .find({
      _status: 'published',
      slug: { $in: ['faq', 'terms', 'refunds', 'refund-policy', 'privacy', 'about', 'contact'] },
    })
    .toArray()
  return pages
    .map((p) => {
      const title = pick(p.title as Record<Locale, string>, locale)
      const intro = pick(p.intro as Record<Locale, string>, locale)
      const body = p.body
        ? richTextToPlain(
            (p.body as Record<string, unknown>)[locale] ?? (p.body as Record<string, unknown>).en,
          )
        : ''
      return `## ${title}\n${intro}\n${body}`.trim()
    })
    .join('\n\n')
}

/** If the visitor is signed in to My Bookings, the assistant may talk about their own orders. */
async function bookingFacts(authHeader: string | undefined): Promise<string> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return ''
  const session = await getDb()
    .collection<{ tokenHash: string; email: string; expiresAt: Date }>('booking_sessions')
    .findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } })
  if (!session) return ''
  const list = await orders()
    .find({ email: session.email, status: { $in: ['paid', 'partially_refunded', 'refunded'] } })
    .sort({ eventStartsAt: -1 })
    .limit(10)
    .toArray()
  if (!list.length) return 'The signed-in visitor has no bookings.'
  return (
    'The signed-in visitor (verified by email code) has these bookings:\n' +
    list
      .map(
        (o) =>
          `- ${o._id}: ${o.eventTitle}, ${o.eventStartsAt.toISOString()}, status ${o.status}, ${o.items.reduce((a, i) => a + i.quantity, 0)} tickets${o.cancelRequestedAt ? ', cancellation requested' : ''}`,
      )
      .join('\n')
  )
}

const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

const body = z.object({
  locale: z.enum(LOCALES as [Locale, ...Locale[]]).default('en'),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(12),
})

/**
 * Website chat (PRD §7). The model only sees our own published facts and is told to
 * say "I don't know" and hand over to a person rather than guess.
 */
assistantRouter.post('/assistant/chat', chatLimiter, async (req, res) => {
  const parsed = body.safeParse(req.body)
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_request' })
  const settings = await getAssistantSettings()
  if (!settings.enabled || !env.OPENAI_API_KEY)
    return void res.status(503).json({ error: 'assistant_off' })
  const { locale, messages } = parsed.data

  const [events, pages, bookings] = await Promise.all([
    eventFacts(locale),
    pageFacts(locale),
    bookingFacts(req.headers.authorization),
  ])
  const handover = [
    settings.handoverEmail && `email ${settings.handoverEmail}`,
    settings.handoverWhatsapp && `WhatsApp ${settings.handoverWhatsapp}`,
  ]
    .filter(Boolean)
    .join(' or ')

  const facts = [
    `# Upcoming events\n${events}`,
    settings.knowledge ? `# Knowledge from the organisers\n${settings.knowledge}` : '',
    pages ? `# Website pages\n${pages}` : '',
    bookings ? `# Visitor's bookings\n${bookings}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_CONTEXT)

  const system = [
    'You are the visitor assistant on the Nordic Affairs Media website (Sweden): a media and cultural publication that also sells tickets to its events.',
    `Reply in ${LANGUAGE[locale]} unless the visitor clearly writes in another language; then use theirs.`,
    'Use ONLY the facts below. Never invent events, dates, prices, people, policies or availability.',
    `If the answer is not in the facts, say you are not sure and suggest contacting the team${handover ? ` (${handover})` : ''}.`,
    'To buy tickets, point to the event page link; you cannot take payments, change bookings or issue refunds.',
    'Do not ask for card details or passwords. Keep answers short and friendly (2–5 sentences), plain text.',
    settings.tone ? `Tone guidance from the organisers: ${settings.tone}` : '',
    '',
    facts,
  ]
    .filter((l) => l !== '')
    .join('\n')

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0.3,
        max_tokens: 450,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!r.ok) {
      console.error('[assistant]', r.status, await r.text().catch(() => ''))
      return void res.status(502).json({ error: 'assistant_error' })
    }
    const data = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    const reply = data.choices?.[0]?.message?.content?.trim()
    if (!reply) return void res.status(502).json({ error: 'assistant_error' })
    res.json({ reply })
  } catch (e) {
    console.error('[assistant]', e)
    res.status(502).json({ error: 'assistant_error' })
  }
})
