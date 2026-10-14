import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getSiteChrome } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
import { PageHeader } from '@/components/ui/primitives'
import { ContactForm } from '@/components/forms/ContactForm'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return buildMetadata({
    locale,
    path: '/contact',
    title: t.contactTitle,
    description: t.contactIntro,
  })
}

/** Contact page with enquiry types (PRD W-08) and the agency's own contact details from Site settings. */
export default async function ContactPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const { settings } = await getSiteChrome(locale)

  return (
    <div className="container-wide pb-20">
      <PageHeader title={t.contactTitle} intro={t.contactIntro} />
      <div className="mt-10 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ContactForm
            locale={locale}
            privacyHref={href(locale, '/privacy')}
            labels={{
              enquiryType: t.enquiryType,
              types: [
                { value: 'general', label: t.typeGeneral },
                { value: 'editorial', label: t.typeEditorial },
                { value: 'press', label: t.typePress },
                { value: 'events', label: t.typeEvents },
                { value: 'artist', label: t.typeArtist },
                { value: 'advertising', label: t.typeAdvertising },
                { value: 'partnerships', label: t.typePartnerships },
              ],
              fullName: t.fullName,
              emailLabel: t.emailLabel,
              subject: t.subject,
              message: t.message,
              privacyConsent: t.privacyConsent,
              privacyPolicy: t.privacyPolicy,
              sendMessage: t.sendMessage,
              messageSent: t.messageSent,
              messageError: t.messageError,
              processing: t.processing,
            }}
          />
        </div>
        <aside className="space-y-8 lg:col-span-4 lg:col-start-9">
          {settings.contactEmail ? (
            <div>
              <p className="eyebrow text-slate">{t.emailLabel}</p>
              <a
                href={`mailto:${settings.contactEmail}`}
                className="mt-2 inline-block font-display text-h3 break-all hover:text-fjord"
              >
                {settings.contactEmail}
              </a>
            </div>
          ) : null}
          {settings.contactPhone ? (
            <div>
              <p className="eyebrow text-slate">{t.phone}</p>
              <a
                href={`tel:${settings.contactPhone.replace(/[^+\d]/g, '')}`}
                className="mt-2 inline-block font-display text-h3 hover:text-fjord"
              >
                {settings.contactPhone}
              </a>
            </div>
          ) : null}
          {settings.whatsapp ? (
            <div>
              <p className="eyebrow text-slate">{t.whatsapp}</p>
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-ui text-caption font-semibold text-fjord underline"
              >
                {t.whatsapp} →
              </a>
            </div>
          ) : null}
          {settings.location ? (
            <div>
              <p className="eyebrow text-slate">{t.location}</p>
              <p className="mt-2 font-display text-h3">{settings.location}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
