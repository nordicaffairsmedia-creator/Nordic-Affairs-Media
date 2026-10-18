'use client'

import { useEffect, useRef } from 'react'

/**
 * Continuous Background Music Player
 * Plays /music.mp3 in a continuous loop across all pages.
 * Runs completely in the background without any visible button on screen.
 */
export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Comfortable ambient volume
    audio.volume = 0.55

    // Attempt direct autoplay
    audio.muted = false
    audio
      .play()
      .catch(() => {
        // Modern browser policy fallback: start as soon as user interacts anywhere with the page
        const unlockOnGesture = () => {
          if (audioRef.current) {
            audioRef.current.muted = false
            audioRef.current.play().catch(() => {})
          }
        }

        window.addEventListener('pointerdown', unlockOnGesture, { once: true })
        window.addEventListener('keydown', unlockOnGesture, { once: true })
        window.addEventListener('touchstart', unlockOnGesture, { once: true })
        window.addEventListener('scroll', unlockOnGesture, { once: true })

        return () => {
          window.removeEventListener('pointerdown', unlockOnGesture)
          window.removeEventListener('keydown', unlockOnGesture)
          window.removeEventListener('touchstart', unlockOnGesture)
          window.removeEventListener('scroll', unlockOnGesture)
        }
      })
  }, [])

  return (
    <audio
      ref={audioRef}
      src="/music.mp3"
      loop
      preload="auto"
      playsInline
      className="hidden"
      aria-hidden="true"
    />
  )
}
