'use server'

import { z } from 'zod'
import { isLocale, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPayloadClient } from '@/lib/payload'
import { escapeHtml, sendSiteEmail } from '@/lib/mail'
import { interestCategoryText, interestCategoryValues } from '@/lib/interestCategories'

export type InterestState = { status: 'idle' | 'sent' | 'error' }

const schema = z.object({
  eventId: z.string().min(1).max(100),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[+()\d\s-]{6,25}$/),
  city: z.string().trim().min(2).max(120),
  category: z.enum(interestCategoryValues),
  consent: z.literal('on'),
  locale: z.string(),
  website: z.string().max(0), // honeypot: real people leave it empty
})

/**
 * "Register My Interest": stores a free pre-registration for an event that is not on
 * sale yet and emails a thank-you. It never books or reserves a ticket. Registering
 * the same email for the same event twice updates the first entry instead of duplicating it.
 */
export async function registerInterest(
  _prev: InterestState,
  formData: FormData,
): Promise<InterestState> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: 'error' }
  const data = parsed.data
  const locale: Locale = isLocale(data.locale) ? data.locale : 'en'

  try {
    const payload = await getPayloadClient()

    // Only accept registrations for a real, published event that is still "Announced".
    const event = await payload
      .findByID({ collection: 'events', id: data.eventId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!event || event._status === 'draft' || event.salesStatus !== 'announced') {
      return { status: 'error' }
    }

    const record = {
      event: event.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      category: data.category,
      locale,
      consentAt: new Date().toISOString(),
    }
    const existing = await payload.find({
      collection: 'interest-registrations',
      where: { and: [{ event: { equals: event.id } }, { email: { equals: data.email } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const current = existing.docs[0]
    let id: string | number
    if (current) {
      await payload.update({
        collection: 'interest-registrations',
        id: current.id,
        data: record,
        overrideAccess: true,
      })
      id = current.id
    } else {
      const created = await payload.create({
        collection: 'interest-registrations',
        data: record,
        overrideAccess: true,
      })
      id = created.id
    }

    // Thank-you email. A failed email must never lose the registration.
    const t = getDictionary(locale)
    const title = typeof event.title === 'string' ? event.title : 'Nordic Affairs Media'
    const body = `${t.interestThanks}`
    const sent = await sendSiteEmail({
      to: data.email,
      subject: `${t.interestEmailSubject}: ${title}`,
      text: `${body}\n\n${title}\n${interestCategoryText(data.category)}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#121414"><p style="font-size:11px;letter-spacing:3px;color:#835c20">NORDIC AFFAIRS MEDIA</p><h2 style="margin:0 0 12px">${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p><p style="color:#555;font-size:13px">${escapeHtml(interestCategoryText(data.category))}</p></div>`,
    }).catch(() => false)
    if (sent) {
      await payload
        .update({
          collection: 'interest-registrations',
          id,
          data: { emailSent: true },
          overrideAccess: true,
        })
        .catch(() => null)
    }
    return { status: 'sent' }
  } catch (err) {
    console.error('[interest] registration failed', err)
    return { status: 'error' }
  }
}
