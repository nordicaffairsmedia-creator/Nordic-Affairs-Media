import type { Media } from '@/payload-types'
import { isDoc } from '@/lib/payload'
import { PlaceholderBadge } from './PlaceholderBadge'

type Props = {
  media: string | Media | null | undefined
  /** Width:height ratio of the frame, e.g. "3/2". The image is cropped around its focal point. */
  ratio?: '16/9' | '3/2' | '4/3' | '4/5' | '1/1' | '2/3'
  sizes: string
  priority?: boolean
  className?: string
  /** Shown when there is no image, so layouts never collapse (master prompt §46). */
  fallbackLabel?: string
  /** "contain" = show the whole picture, never cropped (posters); empty space gets a soft blurred fill. */
  fit?: 'cover' | 'contain'
}

const ratioClass: Record<NonNullable<Props['ratio']>, string> = {
  '16/9': 'aspect-[16/9]',
  '3/2': 'aspect-[3/2]',
  '4/3': 'aspect-[4/3]',
  '4/5': 'aspect-[4/5]',
  '1/1': 'aspect-square',
  '2/3': 'aspect-[2/3]',
}

export function MediaImage({
  media,
  ratio = '3/2',
  sizes,
  priority,
  className = '',
  fallbackLabel,
  fit = 'cover',
}: Props) {
  const frame = `story-media relative overflow-hidden bg-rule/50 ${ratioClass[ratio]} ${className}`

  if (!isDoc(media) || !media.url) {
    return (
      <div className={`${frame} flex items-center justify-center`} aria-hidden="true">
        {fallbackLabel ? <span className="eyebrow text-slate">{fallbackLabel}</span> : null}
      </div>
    )
  }

  const focalX = typeof media.focalX === 'number' ? media.focalX : 50
  const focalY = typeof media.focalY === 'number' ? media.focalY : 50

  // Serve the sizes Payload already cut at upload (480/960/1600 px) instead of asking
  // the server to resize on every visit — on the small Render plan that on-the-fly
  // resizing timed out and left grey boxes in big galleries.
  const cuts = media.sizes
    ? [media.sizes.thumb, media.sizes.card, media.sizes.feature].filter(
        (c): c is { url: string; width: number } =>
          Boolean(c && typeof c.url === 'string' && typeof c.width === 'number'),
      )
    : []
  const srcSet = [
    ...cuts.map((c) => `${c.url} ${c.width}w`),
    ...(typeof media.width === 'number' ? [`${media.url} ${media.width}w`] : []),
  ].join(', ')
  const src = cuts.find((c) => c.width >= 960)?.url ?? media.url

  return (
    <div className={frame}>
      {fit === 'contain' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cuts[0]?.url ?? media.url}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={srcSet || undefined}
        sizes={sizes}
        alt={media.alt ?? ''}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        className={`absolute inset-0 size-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        style={fit === 'contain' ? undefined : { objectPosition: `${focalX}% ${focalY}%` }}
      />
      {media.isPlaceholder ? <PlaceholderBadge className="absolute top-2 left-2" /> : null}
    </div>
  )
}
