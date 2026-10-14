import type { Metadata } from 'next'
import type { Media } from '@/payload-types'
import { locales, localeMeta, type Locale } from '@/i18n/config'
import { isDoc } from './payload'
import { siteUrl } from './site'

type BuildArgs = {
  locale: Locale
  /** Path without locale, e.g. "/news/my-story" or "/" */
  path: string
  title: string
  description?: string | null
  image?: string | Media | null
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  noIndex?: boolean
}

/**
 * Canonical URL, hreflang alternates for all four languages, Open Graph and X cards
 * from one call. Every page uses this so SEO stays consistent (master prompt §22).
 */
export function buildMetadata(args: BuildArgs): Metadata {
  const clean = args.path === '/' ? '' : args.path
  const url = `${siteUrl}/${args.locale}${clean}`
  const languages = Object.fromEntries(
    locales.map((l) => [localeMeta[l].htmlLang, `${siteUrl}/${l}${clean}`]),
  )
  const image =
    isDoc(args.image) && args.image.url ? new URL(args.image.url, siteUrl).toString() : undefined

  return {
    title: args.title,
    description: args.description ?? undefined,
    alternates: {
      canonical: url,
      languages: { ...languages, 'x-default': `${siteUrl}/en${clean}` },
    },
    openGraph: {
      type: args.type ?? 'website',
      url,
      title: args.title,
      description: args.description ?? undefined,
      siteName: 'Nordic Affairs Media',
      locale: localeMeta[args.locale].ogLocale,
      images: image ? [{ url: image }] : undefined,
      ...(args.type === 'article'
        ? { publishedTime: args.publishedTime, modifiedTime: args.modifiedTime }
        : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: args.title,
      description: args.description ?? undefined,
    },
    robots: args.noIndex ? { index: false, follow: true } : undefined,
  }
}
