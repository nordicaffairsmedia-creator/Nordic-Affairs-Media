import type { Locale } from '@/i18n/config'

/**
 * Public address of the site. Set NEXT_PUBLIC_SITE_URL for a custom domain; otherwise the
 * host's own address is used (Vercel's production domain, or Render's ….onrender.com).
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
  process.env.RENDER_EXTERNAL_URL ||
  'http://localhost:3000'
).replace(/\/$/, '')

/** Build a locale-prefixed internal path. External URLs pass through untouched. */
export function href(locale: Locale, path: string): string {
  if (/^(https?:|mailto:|tel:)/.test(path)) return path
  const clean = path.startsWith('/') ? path : `/${path}`
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`
}

export const routes = {
  article: (slug: string) => `/news/${slug}`,
  category: (slug: string) => `/category/${slug}`,
  author: (slug: string) => `/authors/${slug}`,
  event: (slug: string) => `/events/${slug}`,
  events: () => '/events',
  publication: (slug: string) => `/publications/${slug}`,
  publications: () => '/publications',
  search: () => '/search',
  artist: () => '/artist',
} as const
