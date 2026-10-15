'use server'

import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { isLocale, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPayloadClient } from '@/lib/payload'
import { escapeHtml, sendSiteEmail } from '@/lib/mail'
import { siteUrl } from '@/lib/site'

export type NewsletterState = { status: 'idle' | 'sent' | 'error' }

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  consent: z.literal('on'),
  locale: z.string(),
  website: z.string().max(0),
})

export async function newsletterEnabled(): Promise<boolean> {
  const payload = await getPayloadClient()
  const settings = await payload.findGlobal({
    slug: 'platform-settings',
    depth: 0,
    overrideAccess: true,
  })
  return Boolean(settings.features?.newsletter)
}

/**
 * Step 1 of double opt-in: store the address as "waiting" and email a confirmation
 * link. Always answers the same, so nobody can test which addresses are subscribed.
 */
export async function subscribe(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: 'error' }
  if (!(await newsletterEnabled())) return { status: 'error' }
  const locale: Locale = isLocale(parsed.data.locale) ? parsed.data.locale : 'en'
  const { email } = parsed.data

  const payload = await getPayloadClient()
  const existing = await payload.find({
    collection: 'subscribers',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  const current = existing.docs[0]
  if (current?.status === 'confirmed') return { status: 'sent' }

  const token = randomBytes(24).toString('base64url')
  const data = {
    email,
    locale,
    token,
    status: 'pending' as const,
    consentAt: new Date().toISOString(),
  }
  if (current)
    await payload.update({ collection: 'subscribers', id: current.id, data, overrideAccess: true })
  else await payload.create({ collection: 'subscribers', data, overrideAccess: true })

  const t = getDictionary(locale)
  const settings = await payload.findGlobal({
    slug: 'platform-settings',
    locale,
    depth: 0,
    overrideAccess: true,
  })
  const intro = settings.emailTexts?.newsletterConfirm || t.newsletterBody
  const link = `${siteUrl}/${locale}/newsletter?confirm=${token}`
  await sendSiteEmail({
    to: email,
    subject: t.newsletterTitle,
    text: `${intro}\n\n${link}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#121414"><p style="font-size:11px;letter-spacing:3px;color:#835c20">NORDIC AFFAIRS MEDIA</p><p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#121414;color:#fff;padding:12px 20px;text-decoration:none">${escapeHtml(t.newsletterCta)}</a></p></div>`,
  })
  return { status: 'sent' }
}
