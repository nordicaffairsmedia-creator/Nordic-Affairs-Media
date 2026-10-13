'use client'

import { useEffect, useRef } from 'react'

/**
 * Scroll-driven motion for a page, with no animation library:
 * - [data-reveal="up|left|right|zoom"]  fades/slides in when it enters the screen
 *   (style="--d: n" staggers it by n × 90 ms)
 * - [data-count]                        counts its number up ("500+") when shown
 * - [data-parallax="0.12"]              drifts at a different speed while scrolling
 * - a thin gold progress line at the top of the screen
 * Content is never hidden without JavaScript, and nothing moves for visitors who
 * ask their device for reduced motion.
 */
export function ScrollEffects() {
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Only hide what is still below the fold, so nothing visible flickers away.
    const reveal = [...document.querySelectorAll<HTMLElement>('[data-reveal]')]
    const counters = [...document.querySelectorAll<HTMLElement>('[data-count]')]
    for (const el of reveal) {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.92) el.dataset.pending = ''
    }

    const countUp = (el: HTMLElement) => {
      const original = el.dataset.count || el.textContent || ''
      const m = original.match(/^(\D*)(\d+)(.*)$/)
      if (!m) return
      const [, pre, num, post] = m
      const target = Number(num)
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1400)
        const eased = 1 - Math.pow(1 - p, 3)
        el.textContent = `${pre}${Math.round(target * eased)}${post}`
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const el = e.target as HTMLElement
          delete el.dataset.pending
          if (el.hasAttribute('data-count')) countUp(el)
          io.unobserve(el)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    reveal.forEach((el) => io.observe(el))
    counters.forEach((el) => {
      el.dataset.count = el.textContent ?? ''
      io.observe(el)
    })

    // Parallax + progress line, at most once per frame.
    const drifting = [...document.querySelectorAll<HTMLElement>('[data-parallax]')]
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const vh = window.innerHeight
        for (const el of drifting) {
          const r = el.getBoundingClientRect()
          if (r.bottom < -200 || r.top > vh + 200) continue
          const factor = Number(el.dataset.parallax) || 0.1
          const offset = (r.top + r.height / 2 - vh / 2) * -factor
          el.style.setProperty('--py', `${offset.toFixed(1)}px`)
        }
        const max = document.documentElement.scrollHeight - vh
        if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
      reveal.forEach((el) => delete el.dataset.pending)
    }
  }, [])

  return (
    <div
      ref={bar}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-50 h-[3px] w-full origin-left bg-brass"
      style={{ transform: 'scaleX(0)' }}
    />
  )
}
