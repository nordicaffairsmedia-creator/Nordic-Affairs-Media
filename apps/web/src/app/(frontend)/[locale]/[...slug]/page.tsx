import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { isLocale } from '@/i18n/config'
import { findRedirect, getPageBySlug, getSiteChrome } from '@/lib/queries'
import { getDictionary } from '@/i18n/getDictionary'
import { isDoc } from '@/lib/payload'
import Image from 'next/image'
import { SectionHeading } from '@/components/ui/primitives'
import { buildMetadata } from '@/lib/seo'

type Params = { params: Promise<{ locale: string; slug: string[] }> }

// Rendered on request. (An empty generateStaticParams here made Next.js answer every
// CMS page and old address with a bare 404 — "NoFallbackError" in the logs.)
export const dynamic = 'force-dynamic'

/**
 * Catch-all for:
 * 1. Simple CMS pages (About, Terms, Privacy…) — one path segment, e.g. /en/about
 * 2. Old WordPress addresses — looked up in Redirects and article `legacyUrl`,
 *    then sent to the new page with a 301 so search rankings carry over.
 * 3. Anything else → the editorial 404.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale) || slug.length !== 1 || !slug[0]) return {}
  const page = await getPageBySlug(locale, slug[0])
  if (!page) {
    // Built-in stand-ins for the privacy and terms pages (see below).
    if (slug[0] === 'privacy' || slug[0] === 'terms') {
      const t = getDictionary(locale)
      return buildMetadata({
        locale,
        path: `/${slug[0]}`,
        title: slug[0] === 'terms' ? t.terms : t.privacy,
        noIndex: true, // placeholder text until the client's own policy is published
      })
    }
    return {}
  }
  return buildMetadata({
    locale,
    path: `/${page.slug}`,
    title: page.seo?.title || page.title,
    description: page.seo?.description || page.intro,
    image: page.seo?.image,
    noIndex: Boolean(page.seo?.noIndex),
  })
}

export default async function CatchAllPage({ params }: Params) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  if (slug.length === 1 && slug[0]) {
    const page = await getPageBySlug(locale, slug[0])
    if (page) {
      return (
        <article className="container-measure py-14 md:py-20">
          <h1 className="text-h1">{page.title}</h1>
          {page.intro ? (
            <p className="mt-5 font-text text-deck text-charcoal">{page.intro}</p>
          ) : null}
          {page.body ? <RichText data={page.body} className="prose-article mt-10" /> : null}
          {page.showStats || page.showPress ? <PageExtras locale={locale} page={page} /> : null}
        </article>
      )
    }
  }

  // Forms and the footer link to /privacy, and checkout links to /terms; until the client's
  // texts are added as pages with those slugs, show a short notice instead of a dead link.
  if (slug.length === 1 && (slug[0] === 'privacy' || slug[0] === 'terms')) {
    const { settings } = await getSiteChrome(locale)
    const t = getDictionary(locale)
    const isTerms = slug[0] === 'terms'
    return (
      <article className="container-measure py-14 md:py-20">
        <h1 className="text-h1">{isTerms ? t.terms : t.privacy}</h1>
        <p className="mt-6 font-text text-body text-charcoal">
          {settings.siteName} {isTerms ? t.termsNotice : t.privacyNotice}{' '}
          {settings.contactEmail ? (
            <a href={`mailto:${settings.contactEmail}`} className="text-fjord underline">
              {settings.contactEmail}
            </a>
          ) : null}
          .
        </p>
      </article>
    )
  }

  // The middleware prefixes unknown paths with a locale, so check the path both with and without it.
  const withoutLocale = `/${slug.join('/')}`
  const target =
    (await findRedirect(withoutLocale, locale)) ??
    (await findRedirect(`/${locale}${withoutLocale}`, locale))
  if (target) {
    if (target.permanent) permanentRedirect(target.to)
    redirect(target.to)
  }

  notFound()
}

/** Key figures and press logos from Site settings, for pages that ask for them (e.g. About). */
async function PageExtras({
  locale,
  page,
}: {
  locale: Parameters<typeof getSiteChrome>[0]
  page: { showStats?: boolean | null; showPress?: boolean | null }
}) {
  const { settings } = await getSiteChrome(locale)
  const t = getDictionary(locale)
  const stats = page.showStats ? (settings.stats ?? []) : []
  const press = page.showPress ? (settings.pressMentions ?? []) : []
  return (
    <>
      {stats.length > 0 ? (
        <section className="mt-16">
          <SectionHeading title={t.keyFigures} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.id ?? s.label} className="flex flex-col-reverse gap-2">
                <dt className="meta">{s.label}</dt>
                <dd className="font-display text-display leading-none text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {press.length > 0 ? (
        <section className="mt-16">
          <SectionHeading title={t.pressCoverage} />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {press.map((p) => {
              const logo = isDoc(p.logo) ? p.logo : null
              return (
                <li key={p.id ?? p.url}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col justify-between gap-3 border border-rule bg-snow p-4 hover:border-ink"
                  >
                    {logo?.url ? (
                      <Image
                        src={logo.url}
                        alt=""
                        width={logo.width ?? 300}
                        height={logo.height ?? 200}
                        sizes="200px"
                        unoptimized
                        className="h-16 w-full object-contain"
                      />
                    ) : null}
                    <span className="font-ui text-meta font-semibold">{p.outlet} ↗</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </>
  )
}
