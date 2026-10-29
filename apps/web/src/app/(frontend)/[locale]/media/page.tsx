import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPublicVideos } from '@/lib/queries'
import { isDoc } from '@/lib/payload'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
import { LazyVideo } from '@/components/ui/LazyVideo'
import { ButtonLink, EmptyState, PageHeader } from '@/components/ui/primitives'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return buildMetadata({ locale, path: '/media', title: t.navMedia, description: t.mediaIntro })
}

/** "Media" tab: videos and audio only (client request). Photos live in Galleries, articles under Articles. */
export default async function MediaPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const videos = await getPublicVideos()
  const empty = !videos.length
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
                    v.url ? <LazyVideo src={v.url} poster={poster} className="aspect-video w-full bg-ink" /> : null
                  )}
                  <p className="mt-2 font-ui text-caption text-ink">{name}</p>
                  {isAudio ? null : <p className="font-ui text-caption text-ink-muted">{v.format === 'long' ? t.mediaLong : t.mediaShort}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

    </div>
  )
}
