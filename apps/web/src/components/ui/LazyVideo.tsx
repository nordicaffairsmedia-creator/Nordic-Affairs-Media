'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A video that shows its first picture without downloading the whole file.
 * - Far down the page: nothing is downloaded.
 * - Once it is about to scroll into view: only the start of the file is requested
 *   (preload="metadata" and "#t=0.1" ask the browser for the first frame), so the grid
 *   shows pictures instead of black boxes.
 * - The rest is streamed only when the visitor presses play.
 * Videos that were saved "web optimized" (fast start) show their picture within a second.
 */
export function LazyVideo({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <video
      ref={ref}
      controls
      playsInline
      poster={poster}
      preload={near ? 'metadata' : 'none'}
      src={poster ? src : `${src}#t=0.1`}
      className={className}
    />
  )
}
