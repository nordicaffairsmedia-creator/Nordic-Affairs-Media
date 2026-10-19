'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Continuous Background Music Player
 * Plays /music.mp3 in a continuous loop across all pages.
 * Handles modern browser autoplay policies (Chrome, Safari, iOS, Android):
 * 1. Attempts immediate unmuted playback on link entry.
 * 2. If unmuted autoplay is blocked by browser policy, immediately starts playing muted
 *    so the audio stream is pre-buffered and active.
 * 3. Uses capture-phase listeners on all real user activation gestures (click, touchend, pointerup, keydown)
 *    to instantly unmute and continue playback seamlessly with zero delay.
 * 4. Listens across route transitions and tab visibility changes.
 */
export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isUnlockedRef = useRef<boolean>(false)
  const pathname = usePathname()

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.volume = 0.55

    // Function to safely attempt playing with sound
    const startAudioWithSound = () => {
      if (!audioRef.current) return
      const a = audioRef.current

      a.muted = false
      a.volume = 0.55

      // Resume AudioContext if available (helps iOS WebKit unlock audio hardware)
      try {
        const AudioContextClass =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioContextClass) {
          const ctx = new AudioContextClass()
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {})
          }
        }
      } catch {}

      const promise = a.play()
      if (promise !== undefined) {
        promise
          .then(() => {
            isUnlockedRef.current = true
            cleanupListeners()
          })
          .catch(() => {
            // Still waiting for a valid user gesture; keep listeners active
          })
      }
    }

    // Attempt 1: Immediate unmuted autoplay (works if user has visited before or in in-app webviews)
    audio.muted = false
    const initialPlay = audio.play()

    if (initialPlay !== undefined) {
      initialPlay
        .then(() => {
          isUnlockedRef.current = true
        })
        .catch(() => {
          // Attempt 2: Start muted immediately so the audio buffers and begins playing without waiting
          if (audioRef.current && !isUnlockedRef.current) {
            audioRef.current.muted = true
            audioRef.current.play().catch(() => {})
          }
        })
    }

    // User gesture handler: fires on the very first touch, tap, click, or keypress anywhere on the screen
    const handleGesture = () => {
      if (isUnlockedRef.current) return
      startAudioWithSound()
    }

    // High-priority user activation events recognized by Chrome, Safari & mobile browsers
    const events = ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'keydown', 'wheel'] as const

    const attachListeners = () => {
      events.forEach((evt) => {
        window.addEventListener(evt, handleGesture, { capture: true, passive: true })
        document.addEventListener(evt, handleGesture, { capture: true, passive: true })
        document.body?.addEventListener(evt, handleGesture, { capture: true, passive: true })
      })
    }

    const cleanupListeners = () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleGesture, { capture: true } as EventListenerOptions)
        document.removeEventListener(evt, handleGesture, { capture: true } as EventListenerOptions)
        document.body?.removeEventListener(evt, handleGesture, { capture: true } as EventListenerOptions)
      })
    }

    attachListeners()

    // Resume when returning to the tab / unlocking screen
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && audioRef.current) {
        if (!isUnlockedRef.current) {
          startAudioWithSound()
        } else if (audioRef.current.paused) {
          audioRef.current.play().catch(() => {})
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    return () => {
      cleanupListeners()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [])

  // Keep playing on Next.js client-side route changes
  useEffect(() => {
    if (audioRef.current && isUnlockedRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {})
    }
  }, [pathname])

  return (
    <audio
      ref={audioRef}
      src="/music.mp3"
      autoPlay
      loop
      preload="auto"
      playsInline
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '1px',
        height: '1px',
        opacity: 0.001,
        pointerEvents: 'none',
        zIndex: -1,
      }}
      aria-hidden="true"
    />
  )
}
