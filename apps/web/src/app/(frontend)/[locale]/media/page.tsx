import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPublicDocuments, getPublicPhotos, getPublicVideos } from '@/lib/queries'
import { MediaImage } from '@/components/ui/MediaImage'
import { isDoc } from '@/lib/payload'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
import { ButtonLink, EmptyState, PageHeader } from '@/components/ui/primitives'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return buildMetadata({ locale, path: '/media', title: t.navMedia, description: t.mediaIntro })
}

/** "Media" tab: only uploaded media (videos, audio, photos, documents). Articles live under Articles. */
export default async function MediaPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const [videos, photos, documents] = await Promise.all([
    getPublicVideos(),
    getPublicPhotos(),
    getPublicDocuments(),
  ])
  const empty = !videos.length && !photos.length && !documents.length
  const h2 = 'font-display text-h3 text-ink'

  return (
    <div className="container-max pb-20">
      <PageHeader title={t.navMedia} intro={t.mediaIntro} />
      {empty ? (
        <div className="mt-12">
          <EmptyState title={t.emptyMediaTitle} body={t.emptyMediaBody}>
            <ButtonLink href={href(locale, '/gallery')}>{t.allGalleries}</ButtonLink>
          </EmptyState>
        </div>
      ) : null}

      {videos.length > 0 && (
        <section className="mt-12" aria-labelledby="media-videos">
          <h2 id="media-videos" className={h2}>{t.mediaVideos}</h2>
          <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => {
              const isAudio = (v.mimeType ?? '').startsWith('audio/')
              const poster = isDoc(v.poster) ? v.poster.url ?? undefined : undefined
              const name = v.title || v.filename || ''
              return (
                <li key={v.id}>
                  {isAudio ? (
                    <audio controls preload="none" src={v.url ?? undefined} className="w-full" />
                  ) : (
                    <video controls preload="metadata" playsInline poster={poster} src={v.url ?? undefined} className="aspect-video w-full bg-ink" />
                  )}
                  <p className="mt-2 font-ui text-caption text-ink">{name}</p>
                  {isAudio ? null : <p className="font-ui text-caption text-ink-muted">{v.format === 'long' ? t.mediaLong : t.mediaShort}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section className="mt-14" aria-labelledby="media-photos">
          <h2 id="media-photos" className={h2}>{t.mediaPhotos}</h2>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((m) => (
              <li key={m.id}>
                <MediaImage media={m} ratio="4/3" sizes="(min-width:1024px) 25vw, 50vw" />
                {m.caption ? <p className="mt-1 font-ui text-caption text-ink-muted">{m.caption}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {documents.length > 0 && (
        <section className="mt-14" aria-labelledby="media-docs">
          <h2 id="media-docs" className={h2}>{t.mediaDocuments}</h2>
          <ul className="mt-6 divide-y divide-rule border-y border-rule">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                <span className="font-ui text-body text-ink">{d.title || d.filename}</span>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" {...(d.allowDownload === false ? {} : { download: d.filename ?? true })} className="font-ui text-caption text-fjord underline">
                    {t.mediaDownload}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  )
}
