'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { isLocale } from '@/i18n/config'
import { getPayloadClient } from '@/lib/payload'
import { escapeHtml, sendSiteEmail } from '@/lib/mail'

const TYPES = [
  'general',
  'editorial',
  'press',
  'events',
  'artist',
  'advertising',
  'partnerships',
] as const

const schema = z.object({
  type: z.enum(TYPES),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
  consent: z.literal('on'),
  locale: z.string(),
  website: z.string().max(0), // honeypot: real people leave this hidden field empty
  startedAt: z.coerce.number(),
})

export type ContactState = { status: 'idle' | 'sent' | 'error' }

/**
 * Stores the message in the CMS (Inbox → Enquiries) and emails the team.
 * Spam protection without tracking: a hidden honeypot field, a minimum time to fill
 * the form, and at most 3 messages per email address per hour.
 */
export async function sendEnquiry(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: 'error' }
  const input = parsed.data
  if (Date.now() - input.startedAt < 3000) return { status: 'sent' } // too fast to be human; pretend success

  const payload = await getPayloadClient()
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const recent = await payload.count({
    collection: 'enquiries',
    where: { and: [{ email: { equals: input.email } }, { createdAt: { greater_than: hourAgo } }] },
    overrideAccess: true,
  })
  if (recent.totalDocs >= 3) return { status: 'sent' }

  await payload.create({
    collection: 'enquiries',
    overrideAccess: true,
    data: {
      type: input.type,
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      locale: isLocale(input.locale) ? input.locale : 'en',
      consentAt: new Date().toISOString(),
      status: 'new',
    },
  })

  const settings = await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    overrideAccess: true,
  })
  if (settings.contactEmail) {
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? ''
    await sendSiteEmail({
      to: settings.contactEmail,
      replyTo: input.email,
      subject: `[Website · ${input.type}] ${input.subject}`,
      text: `${input.name} <${input.email}>\n\n${input.message}\n\n(${ip})`,
      html: `<p><strong>${escapeHtml(input.name)}</strong> &lt;${escapeHtml(input.email)}&gt; · ${escapeHtml(input.type)}</p><p style="white-space:pre-line">${escapeHtml(input.message)}</p>`,
    })
  }
  return { status: 'sent' }
}
