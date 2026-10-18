import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getSiteChrome } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
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

/**
 * Clean & Elegant Contact Page using the exact site background,
 * normal glassmorphism styling, and emojis instead of icons.
 */
export default async function ContactPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const { settings } = await getSiteChrome(locale)

  return (
    <div className="container-wide pb-20 pt-8">
      {/* Header Section */}
      <header className="mb-10 border-b border-rule pb-8">
        <h1 className="font-serif text-5xl font-bold tracking-tight text-ink sm:text-6xl">
          {t.contactTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate sm:text-lg">
          {t.contactIntro}
        </p>
      </header>

      {/* Main Content Grid */}
      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        {/* Form Column (7 cols) */}
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

        {/* Contact Details Sidebar (5 cols) - Normal Glassmorphic Cards with Emojis */}
        <aside className="space-y-4 lg:col-span-5 lg:pl-4">
          {/* EMAIL CARD */}
          {settings.contactEmail ? (
            <div className="rounded-2xl border border-rule/80 bg-snow/35 p-5 backdrop-blur-md shadow-sm transition-colors hover:border-rule">
              <div className="flex items-start gap-3.5">
                <span className="text-2xl" role="img" aria-label="Email">
                  📧
                </span>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-slate">{t.emailLabel}</p>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="mt-1 block font-display text-h3 text-ink hover:text-fjord break-all transition-colors"
                  >
                    {settings.contactEmail}
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          {/* PHONE CARD */}
          {settings.contactPhone ? (
            <div className="rounded-2xl border border-rule/80 bg-snow/35 p-5 backdrop-blur-md shadow-sm transition-colors hover:border-rule">
              <div className="flex items-start gap-3.5">
                <span className="text-2xl" role="img" aria-label="Phone">
                  📞
                </span>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-slate">{t.phone}</p>
                  <a
                    href={`tel:${settings.contactPhone.replace(/[^+\d]/g, '')}`}
                    className="mt-1 block font-display text-h3 text-ink hover:text-fjord transition-colors"
                  >
                    {settings.contactPhone}
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          {/* WHATSAPP CARD */}
          {settings.whatsapp ? (
            <div className="rounded-2xl border border-rule/80 bg-snow/35 p-5 backdrop-blur-md shadow-sm transition-colors hover:border-rule">
              <div className="flex items-start gap-3.5">
                <span className="text-2xl" role="img" aria-label="WhatsApp">
                  💬
                </span>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-slate">{t.whatsapp}</p>
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-ui text-caption font-semibold text-fjord hover:text-ink underline transition-colors"
                  >
                    {t.whatsapp} →
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          {/* LOCATION CARD */}
          {settings.location ? (
            <div className="rounded-2xl border border-rule/80 bg-snow/35 p-5 backdrop-blur-md shadow-sm transition-colors hover:border-rule">
              <div className="flex items-start gap-3.5">
                <span className="text-2xl" role="img" aria-label="Location">
                  📍
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="eyebrow text-slate">{t.location}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-fjord hover:text-ink underline transition-colors"
                    >
                      Open Map ↗
                    </a>
                  </div>
                  <p className="mt-1 font-display text-h3 text-ink">
                    {settings.location}
                  </p>
                </div>
              </div>

              {/* Embedded Interactive Map */}
              <div className="mt-4 overflow-hidden rounded-xl border border-rule/70 shadow-inner bg-paper/60">
                <iframe
                  title="Location Map"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(settings.location)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                  className="h-48 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          ) : null}

          {/* RESPONSE TIME / OFFICE DESK */}
          <div className="rounded-2xl border border-rule/60 bg-snow/20 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3.5">
              <span className="text-xl" role="img" aria-label="Response Time">
                🕒
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">Response Time</p>
                <p className="text-[11.5px] text-slate">
                  We usually reply within a few working days
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
