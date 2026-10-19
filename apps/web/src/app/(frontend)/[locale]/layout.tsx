import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import {
  Hanken_Grotesk,
  Newsreader,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
  Noto_Serif_Malayalam,
  Noto_Serif_Tamil,
} from 'next/font/google'
import { isLocale, localeMeta, locales, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getSiteChrome, getGalleryMenu } from '@/lib/queries'
import { href, siteUrl } from '@/lib/site'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { themeBootScript } from '@/lib/theme'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { FOOTER_BG } from '@/lib/wordpress/heroSlides'
import { legacyAssetUrl } from '@/lib/wordpress/legacyAsset'
import { whatsappUrl } from '@/lib/nav'
import { ChatWidget, type ChatLabels } from '@/components/assistant/ChatWidget'
import { CookieConsent } from '@/components/privacy/CookieConsent'
import { BackgroundMusic } from '@/components/layout/BackgroundMusic'
import { Tracker } from '@/components/analytics/Tracker'
import '@/styles/globals.css'

/* Latin faces load everywhere; Indic faces only on Tamil/Malayalam pages (no wasted bytes). */
const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-newsreader-src',
  display: 'swap',
})
const hanken = Hanken_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-hanken-src',
  display: 'swap',
})
const serifTamil = Noto_Serif_Tamil({
  subsets: ['tamil'],
  variable: '--font-noto-serif-tamil-src',
  display: 'swap',
  preload: false,
})
const sansTamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  variable: '--font-noto-sans-tamil-src',
  display: 'swap',
  preload: false,
})
const serifMalayalam = Noto_Serif_Malayalam({
  subsets: ['malayalam'],
  variable: '--font-noto-serif-malayalam-src',
  display: 'swap',
  preload: false,
})
const sansMalayalam = Noto_Sans_Malayalam({
  subsets: ['malayalam'],
  variable: '--font-noto-sans-malayalam-src',
  display: 'swap',
  preload: false,
})

const scriptFonts: Record<Locale, string> = {
  en: '',
  sv: '',
  ta: `${serifTamil.variable} ${sansTamil.variable}`,
  ml: `${serifMalayalam.variable} ${sansMalayalam.variable}`,
}

/** Pages are pre-rendered and refreshed at most every 5 minutes; publishing purges instantly. */
export const revalidate = 300
// Do NOT set `dynamicParams = false` here. Saving anything in the admin purges the page
// cache (see lib/revalidate.ts); with `dynamicParams = false` Next.js then refuses to
// re-render the purged pages ("NoFallbackError") and every page 404s/500s until the next
// deploy, which also fails Render's health check and shows a 502. Unknown language codes
// are already rejected by `isLocale()` in the layout and each page (notFound()).

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = { themeColor: '#0e2440', width: 'device-width', initialScale: 1 }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const { settings } = await getSiteChrome(locale)
  return {
    metadataBase: new URL(siteUrl),
    title: { default: settings.siteName, template: `%s — ${settings.siteName}` },
    description: settings.description ?? undefined,
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/icons/favicon-48.png', sizes: '48x48' },
        { url: '/icons/icon-192.png', sizes: '192x192' },
      ],
      apple: '/icons/apple-touch-icon.png',
    },
    appleWebApp: { capable: true, title: 'Nordic Affairs', statusBarStyle: 'default' },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const [{ navigation, settings }, galleries] = await Promise.all([
    getSiteChrome(locale),
    getGalleryMenu(locale).catch(() => []),
  ])

  return (
    <html
      suppressHydrationWarning
      lang={localeMeta[locale].htmlLang}
      className={`${newsreader.variable} ${hanken.variable} ${scriptFonts[locale]}`}
    >
      <head>
        {/* Applies the saved light/navy choice before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-ink focus:px-4 focus:py-3 focus:text-snow"
        >
          {t.skipToContent}
        </a>
        <SiteHeader locale={locale} t={t} settings={settings} galleries={galleries} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter
          locale={locale}
          t={t}
          navigation={navigation}
          settings={settings}
          background={await legacyAssetUrl(FOOTER_BG)}
        />
        <CookieConsent
          privacyHref={href(locale, '/privacy')}
          labels={{
            cookieTitle: t.cookieTitle,
            cookieBody: t.cookieBody,
            cookieAccept: t.cookieAccept,
            cookieReject: t.cookieReject,
            privacyPolicy: t.privacyPolicy,
          }}
        />
        <ChatWidget locale={locale} labels={chatLabels(t)} whatsappHref={whatsappUrl(settings.whatsapp, t.whatsappMessage)} />
        <BackgroundMusic />
        <Tracker />
      </body>
    </html>
  )
}

const CHAT_KEYS = [
  'chatOpen', 'chatTitle', 'chatSubtitle', 'chatPlaceholder', 'chatSend', 'chatError', 'chatClose',
  'chatDisclaimer', 'chatForget', 'chatGreeting', 'chatWelcomeBack', 'chatNoted', 'chatWhatsapp',
  'chatEnquiryTitle', 'chatName', 'chatEmail', 'chatSubject', 'chatMessage', 'chatConsent',
  'chatEnquirySend', 'chatEnquirySent', 'chatSuggest1', 'chatSuggest2', 'chatSuggest3', 'teaserHome',
  'teaserGallery', 'teaserGalleryOne', 'teaserEvents', 'teaserAbout', 'teaserContact', 'teaserMedia',
  'chatWaking', 'chatOnline', 'chatHello',
] as const satisfies readonly (keyof ChatLabels)[]

/** Nora's wording in the page's language. */
function chatLabels(t: ReturnType<typeof getDictionary>): ChatLabels {
  return Object.fromEntries(CHAT_KEYS.map((k) => [k, t[k]])) as ChatLabels
}
