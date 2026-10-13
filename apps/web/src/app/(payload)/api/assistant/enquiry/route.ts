import { z } from 'zod'
import { isLocale } from '@/i18n/config'
import { getPayloadClient } from '@/lib/payload'
import { escapeHtml, sendSiteEmail } from '@/lib/mail'
import { ENQUIRY_TYPES } from '@/lib/assistant/tools'
import { clientIp, rateLimited } from '@/lib/assistant/limits'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  type: z.enum(ENQUIRY_TYPES),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
  consent: z.literal(true),
  locale: z.string().max(5),
  website: z.string().max(0).optional(), // honeypot: people never see or fill it
})

/**
 * The enquiry Nora drafted, sent only when the visitor presses Send in the chat.
 * Same handling as the contact form: saved in Admin → Enquiries and emailed to the team;
 * at most 3 per email address per hour.
 */
export async function POST(req: Request) {
  // Only from our own pages, at most 3 an hour / 10 a day per visitor.
  const origin = req.headers.get('origin')
  if (origin && new URL(origin).host !== req.headers.get('host'))
    return Response.json({ ok: false }, { status: 403 })
  if (rateLimited(`enquiry:${clientIp(req)}`, 3, 10)) return Response.json({ ok: false }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid' }, { status: 400 })
  const input = parsed.data

  const payload = await getPayloadClient()
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const recent = await payload.count({
    collection: 'enquiries',
    where: { and: [{ email: { equals: input.email } }, { createdAt: { greater_than: hourAgo } }] },
    overrideAccess: true,
  })
  if (recent.totalDocs >= 3) return Response.json({ ok: true })

  await payload.create({
    collection: 'enquiries',
    overrideAccess: true,
    data: {
      type: input.type,
      name: input.name,
      email: input.email,
      subject: `${input.subject} (via website assistant)`,
      message: input.message,
      locale: isLocale(input.locale) ? input.locale : 'en',
      consentAt: new Date().toISOString(),
      status: 'new',
    },
  })

  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })
  if (settings.contactEmail) {
    await sendSiteEmail({
      to: settings.contactEmail,
      replyTo: input.email,
      subject: `[Website assistant · ${input.type}] ${input.subject}`,
      text: `${input.name} <${input.email}>\n\n${input.message}`,
      html: `<p><strong>${escapeHtml(input.name)}</strong> &lt;${escapeHtml(input.email)}&gt; · ${escapeHtml(input.type)} · via website assistant</p><p style="white-space:pre-line">${escapeHtml(input.message)}</p>`,
    }).catch(() => undefined)
  }
  return Response.json({ ok: true })
}
