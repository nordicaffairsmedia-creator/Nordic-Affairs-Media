'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { bebas, inter, oswald } from '@/lib/legacy-fonts'

export type HeroImage = {
  id: string
  src: string
  srcSet?: string
  focal?: string
}

const INTERVAL = 5000

/**
 * The landing screen, copied from the old website's Elementor settings: the same photos in
 * the same order, 5 seconds each with a 0.5-second fade, no zoom, photos anchored to the
 * top, a navy gradient veil, 650 px tall (350 px on phones), centred title, line and
 * "Explore More" button. Visitors who ask for reduced motion get a still picture.
 */
export function HeroSlideshow({
  images,
  title,
  text,
  cta,
}: {
  images: HeroImage[]
  title: string
  text?: string
  cta?: { label: string; href: string }
}) {
  const [index, setIndex] = useState(0)
  const [reduced, setReduced] = useState(false)
  const total = images.length

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (reduced || total < 2) return
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % total), INTERVAL)
    return () => window.clearTimeout(t)
  }, [index, reduced, total])

  // Load the next photo in the background so the fade never shows an empty frame.
  useEffect(() => {
    const next = images[(index + 1) % total]
    if (!next) return
    const img = new window.Image()
    if (next.srcSet) {
      img.sizes = '100vw'
      img.srcset = next.srcSet
    }
    img.src = next.src
  }, [index, images, total])

  return (
    <section className="relative isolate flex h-[350px] w-full items-end justify-center overflow-hidden bg-navy-deep text-white min-[768px]:h-[650px]">
      {images.map((img, i) => {
        const shown = i === index
        // Only the first photo loads with the page; the rest arrive just in time.
        const near = i === 0 || i === index || i === (index + 1) % total
        return (
          <div
            key={img.id}
            aria-hidden="true"
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              shown ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {near ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.src}
                srcSet={img.srcSet}
                sizes="100vw"
                alt=""
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
                className="h-full w-full object-cover"
                style={{ objectPosition: img.focal ?? '50% 0%' }}
              />
            ) : null}
          </div>
        )
      })}

      {/* Navy veil, as on the old site: light at the top, deep navy at the bottom. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,31,111,0.1)_0%,#0f1338_100%)] opacity-[0.76]"
      />

      {/* Text sits at the bottom of the photo, as on the old site (50 px above the edge). */}
      <div className="relative mx-auto max-w-5xl px-6 pb-[50px] text-center">
        <h2
          className={`${bebas.className} rise-in text-[24px] leading-none tracking-[2.3px] text-white min-[768px]:text-[56px] lg:text-[68px]`}
        >
          {title}
        </h2>
        {text ? (
          <p
            className={`${inter.className} rise-in mx-auto mt-5 max-w-3xl text-[13px] leading-5 text-white min-[768px]:text-base min-[768px]:leading-6 [animation-delay:150ms]`}
          >
            {text}
          </p>
        ) : null}
        {cta ? (
          <Link
            href={cta.href}
            className={`${oswald.className} rise-in mt-5 inline-flex items-center rounded-[6px] border-[0.8px] border-[rgba(83,154,230,0.37)] bg-[linear-gradient(73deg,#0f1338_0%,#539ae6_100%)] px-5 py-2.5 text-[17px] leading-5 min-[768px]:px-6 min-[768px]:py-3 min-[768px]:text-[20px] tracking-[0.5px] text-white capitalize transition-[filter,transform] hover:brightness-110 hover:-translate-y-px [animation-delay:300ms]`}
          >
            {cta.label}
          </Link>
        ) : null}
      </div>
    </section>
  )
}
