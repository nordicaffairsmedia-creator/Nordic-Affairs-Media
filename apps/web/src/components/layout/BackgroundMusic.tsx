'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Continuous Background Music Player
 * Plays the track chosen in the admin (Background music) in a continuous loop across all pages.
 * Handles modern browser autoplay policies (Chrome, Safari, iOS, Android):
 * 1. Attempts immediate unmuted playback on link entry.
 * 2. If unmuted autoplay is blocked by browser policy, immediately starts playing muted
 *    so the audio stream is pre-buffered and active.
 * 3. Uses capture-phase listeners on all real user activation gestures (click, touchend, pointerup, keydown)
 *    to instantly unmute and continue playback seamlessly with zero delay.
 * 4. Listens across route transitions and tab visibility changes.
 */
function BackgroundMusicPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isUnlockedRef = useRef<boolean>(false)
  const pathname = usePathname()
  // The visitor pressed Pause: the music stays off (even on the next page) until they press Play.
  const userPausedRef = useRef<boolean>(false)
  // Videos / audio clips on the page that are playing right now: the music waits for them.
  const mediaPlayingRef = useRef<Set<HTMLMediaElement>>(new Set())
  const [soundOn, setSoundOn] = useState(false)

  const blocked = () => userPausedRef.current || mediaPlayingRef.current.size > 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.volume = 0.55

    try {
      userPausedRef.current = window.localStorage.getItem('nam-music') === 'off'
    } catch {}

    const sync = () => setSoundOn(!audio.paused && !audio.muted)
    audio.addEventListener('play', sync)
    audio.addEventListener('pause', sync)
    audio.addEventListener('volumechange', sync)

    // Function to safely attempt playing with sound
    const startAudioWithSound = () => {
      if (!audioRef.current || blocked()) return
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
    const initialPlay = blocked() ? undefined : audio.play()

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
    const handleGesture = (e: Event) => {
      if (isUnlockedRef.current || blocked()) return
      if (e.target instanceof Element && e.target.closest('[data-music-toggle]')) return
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
      if (blocked()) return
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

    // A video or audio clip starts: the music stops. When the last one stops or ends: the music
    // comes back (unless the visitor pressed Pause). Media events do not bubble, so listen while capturing.
    const resumeIfFree = () => {
      const a = audioRef.current
      if (!a || blocked() || !isUnlockedRef.current) return
      a.play().catch(() => {})
    }
    const onMediaPlay = (e: Event) => {
      const el = e.target
      if (!(el instanceof HTMLMediaElement) || el === audioRef.current) return
      mediaPlayingRef.current.add(el)
      audioRef.current?.pause()
    }
    const onMediaStop = (e: Event) => {
      const el = e.target
      if (!(el instanceof HTMLMediaElement) || el === audioRef.current) return
      mediaPlayingRef.current.delete(el)
      resumeIfFree()
    }
    document.addEventListener('play', onMediaPlay, true)
    document.addEventListener('pause', onMediaStop, true)
    document.addEventListener('ended', onMediaStop, true)

    return () => {
      audio.removeEventListener('play', sync)
      audio.removeEventListener('pause', sync)
      audio.removeEventListener('volumechange', sync)
      document.removeEventListener('play', onMediaPlay, true)
      document.removeEventListener('pause', onMediaStop, true)
      document.removeEventListener('ended', onMediaStop, true)
      cleanupListeners()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [])

  // Keep playing on Next.js client-side route changes
  useEffect(() => {
    // Clips that left the page with the old route will never send "pause": forget them.
    mediaPlayingRef.current.forEach((el) => {
      if (!el.isConnected) mediaPlayingRef.current.delete(el)
    })
    if (audioRef.current && isUnlockedRef.current && audioRef.current.paused && !blocked()) {
      audioRef.current.play().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const toggle = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (!a.paused && !a.muted) {
      userPausedRef.current = true
      try {
        window.localStorage.setItem('nam-music', 'off')
      } catch {}
      a.pause()
    } else {
      userPausedRef.current = false
      try {
        window.localStorage.setItem('nam-music', 'on')
      } catch {}
      a.muted = false
      isUnlockedRef.current = true
      // Pressing Play while a video is playing is allowed: the visitor chose it.
      mediaPlayingRef.current.forEach((el) => el.pause())
      a.play().catch(() => {})
    }
  }, [])

  return (
    <>
    <audio
      ref={audioRef}
      src={src}
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
    <button
      type="button"
      data-music-toggle
      onClick={toggle}
      aria-label={soundOn ? 'Pause background music' : 'Play background music'}
      aria-pressed={soundOn}
      title={soundOn ? 'Pause music' : 'Play music'}
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 60,
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,.55)',
        background: 'rgba(10,25,48,.85)',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 4px 14px rgba(0,0,0,.35)',
      }}
    >
      {soundOn ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
        </svg>
      )}
    </button>
    </>
  )
}

/**
 * The 4 MB music file used to start downloading together with every page, competing with the
 * photos and text the visitor came for. It now waits until the page has finished loading
 * (plus a moment), then behaves exactly as before.
 */
export function BackgroundMusic({ src }: { src: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const start = () => {
      timer = setTimeout(() => setReady(true), 1500)
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      window.removeEventListener('load', start)
      if (timer) clearTimeout(timer)
    }
  }, [])
  // key: a different track starts a fresh player.
  return ready ? <BackgroundMusicPlayer key={src} src={src} /> : null
}
