import Image from 'next/image'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { TodayDate } from './TodayDate'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { SiteSettingsData } from '@/payload-types'
import { formatDate } from '@/lib/format'
import { href, routes } from '@/lib/site'
import { mainLinks, whatsappUrl } from '@/lib/nav'
import { bookingApiUrl } from '@/lib/booking'
import { LanguageSwitcher } from './LanguageSwitcher'
import { MobileNav } from './MobileNav'
import { PrimaryNav } from './PrimaryNav'
import { EnquireButton } from './EnquireButton'
import { ThemeToggle } from './ThemeToggle'

type Props = {
  locale: Locale
  t: Dictionary
  settings: SiteSettingsData
  galleries: { title: string; slug: string }[]
}

/**
 * Navy header in the agency's style: gold logo left, the fixed main menu in the
 * middle (Home · About Us · Gallery ▾ · Media · Concerts & Events · Contact Us) and
 * "Enquire Now" (WhatsApp) on the right. Languages sit in the thin row above.
 */
export function SiteHeader({ locale, t, settings, galleries }: Props) {
  const links = mainLinks(locale, t)
  const today = formatDate(new Date().toISOString(), locale)
  const enquire = whatsappUrl(settings.whatsapp, t.whatsappMessage)
  const galleryLinks = galleries.map((g) => ({
    title: g.title,
    href: href(locale, `/gallery/${g.slug}`),
  }))

  return (
    <header className="border-b border-rule bg-paper">
      {/* Utility row: date + languages (desktop) */}
      <div className="hidden border-b border-rule lg:block">
        <div className="container-max flex h-10 items-center justify-between">
          <TodayDate locale={locale} initial={today} labels={{ india: t.timeIndia, sweden: t.timeSweden, choose: t.timeZoneLabel }} />
          <div className="flex items-center gap-4">
            {bookingApiUrl ? (
              <Link href={href(locale, '/account')} className="meta hover:text-ink">
                {t.myBookings}
              </Link>
            ) : null}
            <LanguageSwitcher current={locale} label={t.language} />
            <ThemeToggle
              labels={{ light: t.themeLight, dark: t.themeDark }}
              compact
              className="-mr-2"
            />
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="container-max flex items-center justify-between gap-6 py-3 lg:py-4">
        <Link href={href(locale, '/')} className="shrink-0" aria-label={settings.siteName}>
          {/* The agency's own gold logo (from the old website, transparent PNG). */}
          <Image
            src="/brand/nam-logo-gold-480.png"
            alt=""
            width={480}
            height={327}
            unoptimized
            priority
            sizes="(min-width: 1024px) 120px, 90px"
            className="h-14 w-auto lg:h-20"
          />
        </Link>

        <div className="hidden flex-1 lg:block">
          <PrimaryNav
            locale={locale}
            links={links}
            galleries={galleryLinks}
            allGalleriesLabel={t.allGalleriesNav}
            menuLabel={t.menu}
          />
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Link
            href={href(locale, routes.search())}
            className="inline-flex size-10 items-center justify-center text-charcoal hover:text-fjord"
          >
            <Search aria-hidden="true" className="size-4.5" />
            <span className="sr-only">{t.search}</span>
          </Link>
          <EnquireButton href={enquire} label={t.enquireNow} />
        </div>

        <ThemeToggle
          labels={{ light: t.themeLight, dark: t.themeDark }}
          className="ml-auto lg:hidden"
        />
        <MobileNav
          links={links.map((l) => ({ label: l.label, href: l.href }))}
          searchHref={href(locale, routes.search())}
          locale={locale}
          enquireHref={enquire}
          labels={{
            menu: t.menu,
            close: t.closeMenu,
            search: t.search,
            language: t.language,
            enquire: t.enquireNow,
          }}
        />
      </div>
    </header>
  )
}
