'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useViewMode, ViewToggle, type ViewLabels } from './ViewToggle'

export type Photo = {
  id: string
  /** Mid-size cut for the grid/list. */
  src: string
  srcSet?: string
  /** Largest sensible cut for the pop-up viewer. */
  full: string
  fullSrcSet?: string
  width?: number
  height?: number
  alt: string
  caption?: string
  credit?: string
  focal?: string
}

export type ViewerLabels = ViewLabels & {
  viewer: string
  close: string
  previous: string
  next: string
}

/**
 * A gallery's photos as a grid or a list. Clicking a photo opens it large in a pop-up
 * on the same page (arrow keys, swipe, Esc) — no new tab.
 */
export function GalleryPhotos({ photos, labels }: { photos: Photo[]; labels: ViewerLabels }) {
  const [view, setView] = useViewMode()
  const [open, setOpen] = useState<number | null>(null)
  const lastTrigger = useRef<HTMLElement | null>(null)
  const closeBtn = useRef<HTMLButtonElement | null>(null)
  const touchX = useRef<number | null>(null)
  const total = photos.length
  const show = (i: number, trigger: HTMLElement) => {
    lastTrigger.current = trigger
    setOpen(i)
  }
  const close = useCallback(() => {
    setOpen(null)
    lastTrigger.current?.focus()
  }, [])
  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + total) % total)),
    [total],
  )

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, close, step])

  // Focus the close button when the viewer opens; warm up the neighbours.
  useEffect(() => {
    if (open === null) return
    closeBtn.current?.focus()
    for (const d of [1, -1]) {
      const p = photos[(open + d + total) % total]
      if (p) new window.Image().src = p.full
    }
  }, [open, photos, total])

  const current = open === null ? null : photos[open]

  return (
    <>
      <div className="mt-8 flex justify-end">
        <ViewToggle view={view} onChange={setView} labels={labels} />
      </div>

      {view === 'grid' ? (
        // Justified rows (like Google Photos): every photo keeps its own shape — nothing is
        // cropped — and each row is stretched to the full width, in the order the photos were
        // added. Row height: about 130 px on phones, 170 px tablets, 220 px computers.
        <ul className="mt-6 flex flex-wrap gap-1.5 [--row:130px] sm:gap-2 sm:[--row:170px] lg:[--row:220px]">
          {photos.map((p, i) => {
            const r = p.width && p.height ? p.width / p.height : 1.5
            return (
              <li
                key={p.id}
                className="relative overflow-hidden bg-rule/50"
                style={{ flexGrow: r * 100, flexBasis: `calc(var(--row) * ${r.toFixed(4)})`, aspectRatio: `${r}` }}
              >
                <a
                  href={p.full}
                  onClick={(e) => {
                    e.preventDefault()
                    show(i, e.currentTarget)
                  }}
                  className="group block size-full"
                  aria-label={p.alt || `${i + 1} / ${total}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.src}
                    srcSet={p.srcSet}
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 40vw, 60vw"
                    alt={p.alt}
                    loading={i < 10 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="block size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </a>
              </li>
            )
          })}
          {/* Keeps the last row from stretching a lone photo across the page. */}
          <li aria-hidden="true" className="h-0" style={{ flexGrow: 1000 }} />
        </ul>
      ) : (
        <ol className="mx-auto mt-6 max-w-4xl space-y-12">
          {photos.map((p, i) => (
            <li key={p.id}>
              <figure>
                <a
                  href={p.full}
                  onClick={(e) => {
                    e.preventDefault()
                    show(i, e.currentTarget)
                  }}
                  className="block bg-rule/50"
                  aria-label={p.alt || `${i + 1} / ${total}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.src}
                    srcSet={p.fullSrcSet || p.srcSet}
                    sizes="(min-width: 960px) 896px, 100vw"
                    width={p.width}
                    height={p.height}
                    alt={p.alt}
                    loading={i < 2 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="h-auto w-full"
                  />
                </a>
                <figcaption className="meta mt-3 flex justify-between gap-4">
                  <span>
                    {p.caption}
                    {p.credit ? <span className="ml-1 text-mist">{p.credit}</span> : null}
                  </span>
                  <span className="shrink-0 text-mist">
                    {i + 1} / {total}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
      )}

      {current && open !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={labels.viewer}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(e) => {
            const start = touchX.current
            const end = e.changedTouches[0]?.clientX
            touchX.current = null
            if (start === null || end === undefined) return
            if (end - start > 50) step(-1)
            else if (start - end > 50) step(1)
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <p className="font-ui text-caption tabular-nums text-white/80" aria-live="polite">
              {open + 1} / {total}
            </p>
            <button
              ref={closeBtn}
              type="button"
              onClick={close}
              aria-label={labels.close}
              className="inline-flex size-11 items-center justify-center text-white/85 hover:text-white"
            >
              <X aria-hidden="true" className="size-6" />
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
            onClick={(e) => {
              if (e.target === e.currentTarget) close()
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.id}
              src={current.full}
              srcSet={current.fullSrcSet}
              sizes="100vw"
              alt={current.alt}
              className="max-h-full max-w-full select-none object-contain"
              draggable={false}
            />
            {total > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={labels.previous}
                  className="absolute top-1/2 left-1 hidden size-12 -translate-y-1/2 items-center justify-center bg-black/40 text-white/85 hover:text-white sm:inline-flex"
                >
                  <ChevronLeft aria-hidden="true" className="size-7" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={labels.next}
                  className="absolute top-1/2 right-1 hidden size-12 -translate-y-1/2 items-center justify-center bg-black/40 text-white/85 hover:text-white sm:inline-flex"
                >
                  <ChevronRight aria-hidden="true" className="size-7" />
                </button>
              </>
            ) : null}
          </div>

          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="font-ui text-caption text-white/80">
              {current.caption}
              {current.credit ? <span className="ml-1 text-white/55">{current.credit}</span> : null}
            </p>
            {total > 1 ? (
              <div className="flex gap-2 sm:hidden">
                <button type="button" onClick={() => step(-1)} aria-label={labels.previous} className="inline-flex size-11 items-center justify-center border border-white/25">
                  <ChevronLeft aria-hidden="true" className="size-6" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label={labels.next} className="inline-flex size-11 items-center justify-center border border-white/25">
                  <ChevronRight aria-hidden="true" className="size-6" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
