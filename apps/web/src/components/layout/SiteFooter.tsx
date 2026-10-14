import Image from 'next/image'
import Link from 'next/link'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { NavigationData, SiteSettingsData } from '@/payload-types'
import { href } from '@/lib/site'
import { CookieSettingsLink } from '@/components/privacy/CookieConsent'
import { Mail, MapPin, Phone } from 'lucide-react'
import { SocialLinks } from './SocialLinks'

export const platformLabel: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
  whatsapp: 'WhatsApp',
  spotify: 'Spotify',
  website: 'Website',
}

type Props = {
  locale: Locale
  t: Dictionary
  navigation: NavigationData
  settings: SiteSettingsData
  /** The old site's night-time city skyline behind the footer. */
  background?: string
}

export function SiteFooter({ locale, t, navigation, settings, background }: Props) {
  const year = new Date().getFullYear()

  // No menu links here on purpose: the header already carries them, and pages end with
  // their own "Enquire" call to action. The footer holds what the header does not.
  return (
    <footer
      className="mt-auto bg-navy-deep bg-cover bg-center bg-no-repeat text-ink"
      style={background ? { backgroundImage: `url("${background}")` } : undefined}
    >
      <div className="container-max grid gap-12 py-14 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-5">
          <Image
            src="/brand/nam-logo-gold-480.png"
            alt={settings.siteName}
            width={480}
            height={327}
            unoptimized
            sizes="160px"
            className="h-24 w-auto"
          />
          {settings.description ? (
            <p className="mt-5 max-w-sm text-caption leading-relaxed text-mist">
              {settings.description}
            </p>
          ) : null}
        </div>

        <div className="md:col-span-4">
          <p className="eyebrow text-mist">{t.contactTitle}</p>
          <ul className="mt-4 space-y-3 text-caption">
            {settings.contactEmail ? (
              <li className="flex items-center gap-3">
                <Mail aria-hidden="true" className="size-4 shrink-0 text-fjord" />
                <a href={`mailto:${settings.contactEmail}`} className="hover:underline">
                  {settings.contactEmail}
                </a>
              </li>
            ) : null}
            {settings.contactPhone ? (
              <li className="flex items-center gap-3">
                <Phone aria-hidden="true" className="size-4 shrink-0 text-fjord" />
                <a
                  href={`tel:${settings.contactPhone.replace(/[^+\d]/g, '')}`}
                  className="hover:underline"
                >
                  {settings.contactPhone}
                </a>
              </li>
            ) : null}
            {settings.location ? (
              <li className="flex items-center gap-3 text-mist">
                <MapPin aria-hidden="true" className="size-4 shrink-0 text-fjord" />
                {settings.location}
              </li>
            ) : null}
          </ul>
          <p className="eyebrow mt-8 text-mist">{t.followUs}</p>
          <div className="mt-4">
            <SocialLinks locale={locale} cms={navigation.social} />
          </div>
        </div>

        {settings.accreditation ? (
          <div className="md:col-span-3">
            <div className="flex items-center gap-4 md:flex-col md:items-start">
              <Image
                src="/brand/nam-crest-gold-144.png"
                alt=""
                width={144}
                height={147}
                unoptimized
                sizes="80px"
                className="size-16 md:size-20"
              />
              <p className="eyebrow leading-relaxed text-brass">{settings.accreditation}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-ink/15">
        <div className="container-max flex flex-wrap items-center gap-x-5 gap-y-2 py-6">
          <p className="meta text-mist">
            © {year} {settings.siteName}. {t.allRightsReserved}
          </p>
          <Link href={href(locale, '/privacy')} className="meta text-ink/80 hover:text-ink">
            {t.privacy}
          </Link>
          <CookieSettingsLink label={t.cookieSettings} />
        </div>
      </div>
    </footer>
  )
}
