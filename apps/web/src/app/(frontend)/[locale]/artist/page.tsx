import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getArtistProfile } from '@/lib/listings'
import { isDoc } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { buildMetadata } from '@/lib/seo'
import { routes, siteUrl } from '@/lib/site'
import { MediaImage } from '@/components/ui/MediaImage'
import { JsonLd, SectionHeading } from '@/components/ui/primitives'
import { platformLabel } from '@/components/layout/SiteFooter'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const artist = await getArtistProfile(locale)
  if (!artist.enabled) return {}
  return buildMetadata({
    locale,
    path: routes.artist(),
    title: artist.name,
    description: artist.intro,
    image: artist.portrait,
  })
}

/**
 * Editorial profile of the founder as an artist (master prompt §14) — written like a
 * magazine profile, not a fan page. Hidden (404) until the CMS switch is turned on.
 */
export default async function ArtistPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const artist = await getArtistProfile(locale)
  if (!artist.enabled) notFound()

  const t = getDictionary(locale)
  const pressKit = isDoc(artist.pressKit) ? artist.pressKit : null
  const linkCls = 'font-ui text-meta font-semibold text-fjord hover:underline'

  return (
    <article className="pb-20">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: artist.name,
          url: `${siteUrl}/${locale}${routes.artist()}`,
          ...(artist.role ? { jobTitle: artist.role } : {}),
          ...(artist.links?.length ? { sameAs: artist.links.map((l) => l.url) } : {}),
        }}
      />

      <header className="container-max grid gap-10 pt-10 md:pt-16 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <MediaImage
            media={artist.portrait}
            ratio="4/5"
            sizes="(min-width: 1024px) 40vw, 100vw"
            priority
          />
        </div>
        <div className="lg:col-span-6 lg:col-start-7 lg:self-end">
          {artist.role ? <span className="eyebrow text-brass-text">{artist.role}</span> : null}
          <h1 className="mt-3 text-display">{artist.name}</h1>
          {artist.intro ? (
            <p className="mt-6 font-text text-deck text-charcoal">{artist.intro}</p>
          ) : null}
          {artist.links?.length ? (
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {artist.links.map((l) => (
                <li key={l.id ?? l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer me" className={linkCls}>
                    {platformLabel[l.platform] ?? l.platform}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <div className="container-max mt-16 grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {artist.biography ? (
            <section aria-label={t.biography}>
              <SectionHeading title={t.biography} />
              <RichText data={artist.biography} className="prose-article" />
            </section>
          ) : null}
        </div>

        <aside className="space-y-12 lg:col-span-4 lg:col-start-9">
          {artist.music?.length ? (
            <section aria-label={t.music}>
              <SectionHeading title={t.music} as="h2" />
              <ul className="divide-y divide-rule">
                {artist.music.map((m) => (
                  <li
                    key={m.id ?? m.title}
                    className="flex items-baseline justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-ui text-body font-semibold">{m.title}</p>
                      <p className="meta">{[m.year, m.note].filter(Boolean).join(' · ')}</p>
                    </div>
                    {m.url ? (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className={linkCls}>
                        {t.listen}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {artist.performances?.length ? (
            <section aria-label={t.performances}>
              <SectionHeading title={t.performances} as="h2" />
              <ul className="space-y-3">
                {artist.performances.map((p) => (
                  <li key={p.id ?? p.title}>
                    <p className="font-ui text-body font-semibold">
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-fjord"
                        >
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </p>
                    <p className="meta">
                      {[p.date ? formatDate(p.date, locale) : null, p.place]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {artist.videos?.length ? (
            <section aria-label={t.videos}>
              <SectionHeading title={t.videos} as="h2" />
              <ul className="space-y-2">
                {artist.videos.map((v) => (
                  <li key={v.id ?? v.url}>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className={linkCls}>
                      ▶ {v.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {artist.press?.length || pressKit?.url ? (
            <section aria-label={t.press}>
              <SectionHeading title={t.press} as="h2" />
              <ul className="space-y-3">
                {(artist.press ?? []).map((p) => (
                  <li key={p.id ?? p.url}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-ui text-body hover:text-fjord"
                    >
                      <span className="eyebrow block text-slate">{p.outlet}</span>
                      {p.headline}
                    </a>
                    {p.date ? <p className="meta">{formatDate(p.date, locale)}</p> : null}
                  </li>
                ))}
              </ul>
              {pressKit?.url ? (
                <a href={pressKit.url} download className={`mt-6 inline-block ${linkCls}`}>
                  {t.downloadPdf} — Press kit
                </a>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </article>
  )
}
