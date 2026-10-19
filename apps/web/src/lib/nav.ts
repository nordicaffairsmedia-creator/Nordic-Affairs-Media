import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * The main menu, in the order the client uses on nordicaffairsmedia.com:
 * Home · About Us · Gallery ▾ · Media · Concerts & Events · Articles · Contact Us.
 * Fixed in code (not editable in the CMS) so every tab always leads to a real page.
 */
export type MainLink = { key: string; label: string; href: string; dropdown?: boolean }

export function mainLinks(locale: Locale, t: Dictionary): MainLink[] {
  const p = `/${locale}`
  return [
    { key: 'home', label: t.navHome, href: p },
    { key: 'about', label: t.navAbout, href: `${p}/about-us` },
    { key: 'gallery', label: t.navGallery, href: `${p}/gallery`, dropdown: true },
    { key: 'media', label: t.navMedia, href: `${p}/media` },
    { key: 'events', label: t.navEvents, href: `${p}/events` },
    { key: 'articles', label: t.navArticles, href: `${p}/articles` },
    { key: 'contact', label: t.navContact, href: `${p}/contact` },
  ]
}

/** Which tab is "current" for a given address (stories count as Media). */
export function activeKey(pathname: string, locale: Locale): string | null {
  const rest = pathname.replace(new RegExp(`^/${locale}`), '') || '/'
  if (rest === '/') return 'home'
  const first = rest.split('/')[1]
  const map: Record<string, string> = {
    'about-us': 'about',
    gallery: 'gallery',
    media: 'media',
    articles: 'articles',
    news: 'articles',
    events: 'events',
    booking: 'events',
    contact: 'contact',
  }
  return (first && map[first]) || null
}

const FALLBACK_WHATSAPP = '46733002665'

/** "Enquire Now" opens a WhatsApp chat with the agency, with a short greeting filled in. */
export function whatsappUrl(number: string | null | undefined, message: string) {
  const digits = (number || FALLBACK_WHATSAPP).replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
