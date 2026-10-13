import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getHomepage, getSiteChrome } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'
import { href, siteUrl } from '@/lib/site'
import { PublicationFeature } from '@/components/editorial/PublicationFeature'
import { NewsletterPanel } from '@/components/editorial/NewsletterPanel'
import { HeroSlideshow, type HeroImage } from '@/components/editorial/HeroSlideshow'
import { getPayloadClient } from '@/lib/payload'
import { HERO_SLIDES, OLD_UPLOADS } from '@/lib/wordpress/heroSlides'
import type { Media } from '@/payload-types'
import { EmptyState, JsonLd } from '@/components/ui/primitives'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const { settings } = await getSiteChrome(locale)
  return buildMetadata({
    locale,
    path: '/',
    title: settings.tagline ? `${settings.siteName} — ${settings.tagline}` : settings.siteName,
    description: settings.description,
    image: settings.defaultShareImage,
  })
}

/**
 * Front page. Order (top → bottom):
 * lead story · featured + latest column · photo galleries · category sections (first two) ·
 * upcoming events · latest issue · remaining sections · newsletter.
 * Every block comes from the CMS "Homepage" settings; empty blocks are skipped.
 */
export default async function HomePage({ params }: Params) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const [home, { settings }] = await Promise.all([getHomepage(locale), getSiteChrome(locale)])

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: settings.siteName,
    url: siteUrl,
    ...(settings.description ? { description: settings.description } : {}),
  }

  // One page heading for screen readers and search engines; the visible blocks use h2.
  const pageHeading = (
    <h1 className="sr-only">
      {settings.tagline ? `${settings.siteName} — ${settings.tagline}` : settings.siteName}
    </h1>
  )

  // Landing slideshow, exactly as on the old website: the photos chosen in Homepage
  // settings; when none are chosen, the old site's own slideshow (same photos, same order)
  // — from our media library once imported, otherwise straight from the old site.
  const toImage = (media: Media | null): HeroImage | null => {
    if (!media?.url) return null
    const cuts = [media.sizes?.card, media.sizes?.feature].filter(
      (c): c is { url: string; width: number } =>
        Boolean(c && typeof c.url === 'string' && typeof c.width === 'number'),
    )
    return {
      id: String(media.id),
      src: cuts.find((c) => c.width >= 1200)?.url ?? media.url,
      srcSet:
        [
          ...cuts.map((c) => `${c.url} ${c.width}w`),
          ...(typeof media.width === 'number' ? [`${media.url} ${media.width}w`] : []),
        ].join(', ') || undefined,
      // A focal point set by hand wins; the default middle (50/50) would cut off heads, so
      // photos without one stay anchored to the top like on the old site.
      focal:
        typeof media.focalX === 'number' &&
        typeof media.focalY === 'number' &&
        !(media.focalX === 50 && media.focalY === 50)
          ? `${media.focalX}% ${media.focalY}%`
          : undefined,
    }
  }
  const chosen = home.hero.slides.map(toImage).filter((x): x is HeroImage => x !== null)
  const heroImages = chosen.length ? chosen : await oldSlideshow(toImage)
  const buttonLink = home.hero.buttonLink || '/gallery'
  const hero =
    heroImages.length > 0 ? (
      <HeroSlideshow
        images={heroImages}
        title={home.hero.title || t.heroTitle}
        text={home.hero.text || t.heroText}
        cta={{
          label: home.hero.buttonLabel || t.heroCta,
          href: /^https?:\/\//.test(buttonLink) ? buttonLink : href(locale, buttonLink),
        }}
      />
    ) : null

  // The landing page never lists articles: they live only under the Articles tab.
  // It shows the slideshow, then the latest issue and the newsletter when set in the CMS.
  if (!hero) {
    return (
      <div className="container-wide py-16">
        <JsonLd data={organization} />
        {pageHeading}
        <EmptyState title={t.emptyHomeTitle} body={t.emptyHomeBody} />
      </div>
    )
  }

  return (
    <>
      <JsonLd data={organization} />
      {pageHeading}
      {hero}
      {home.publication ? (
        <PublicationFeature publication={home.publication} locale={locale} t={t} />
      ) : null}
      {home.showNewsletter ? <NewsletterPanel t={t} locale={locale} /> : null}
    </>
  )
}

/** The old website's slideshow, in its order: imported copies where we have them. */
async function oldSlideshow(toImage: (m: Media | null) => HeroImage | null): Promise<HeroImage[]> {
  const urls = HERO_SLIDES.map((p) => OLD_UPLOADS + p)
  const found = await getPayloadClient()
    .then((payload) =>
      payload.find({
        collection: 'media',
        where: { sourceUrl: { in: urls } },
        limit: urls.length,
        depth: 0,
        pagination: false,
      }),
    )
    .then((r) => r.docs as Media[])
    .catch(() => [] as Media[])
  const bySource = new Map(found.map((m) => [m.sourceUrl ?? '', m] as const))
  return urls.map(
    (url, i) => toImage(bySource.get(url) ?? null) ?? { id: `old-${i}`, src: url, focal: '50% 0%' },
  )
}
