import { randomBytes } from 'node:crypto'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPayloadClient } from '@/lib/payload'
import { textParam } from '@/lib/listings'
import { href } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Step 2 of double opt-in (?confirm=…) and one-click unsubscribe (?unsubscribe=…).
 * The token is replaced after use, so a link works once.
 */
export default async function NewsletterPage({ params, searchParams }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const sp = await searchParams
  const confirm = textParam(sp.confirm, 64)
  const unsubscribe = textParam(sp.unsubscribe, 64)
  const token = confirm || unsubscribe

  let message = t.newsletterInvalid
  if (token.length >= 20) {
    const payload = await getPayloadClient()
    const found = await payload.find({
      collection: 'subscribers',
      where: { token: { equals: token } },
      limit: 1,
      overrideAccess: true,
    })
    const sub = found.docs[0]
    if (sub) {
      const next = randomBytes(24).toString('base64url')
      if (confirm) {
        await payload.update({
          collection: 'subscribers',
          id: sub.id,
          overrideAccess: true,
          // New token = the unsubscribe key for future newsletters.
          data: { status: 'confirmed', confirmedAt: new Date().toISOString(), token: next },
        })
        message = t.newsletterConfirmed
      } else {
        await payload.update({
          collection: 'subscribers',
          id: sub.id,
          overrideAccess: true,
          data: { status: 'unsubscribed', token: next },
        })
        message = t.newsletterUnsubscribed
      }
    }
  }

  return (
    <div className="container-measure py-20 text-center">
      <p className="eyebrow text-brass-text">{t.newsletterTitle}</p>
      <h1 className="mt-4 text-h2">{message}</h1>
      <Link
        href={href(locale, '/')}
        className="mt-8 inline-block font-ui text-caption font-semibold text-fjord hover:underline"
      >
        {t.backHome} →
      </Link>
    </div>
  )
}
