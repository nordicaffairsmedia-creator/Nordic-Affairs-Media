'use client'

import { useEffect, useState } from 'react'
import type { Locale } from '@/i18n/config'
import { intlLocales } from '@/lib/format'

type Zone = 'sweden' | 'india'
const ZONES: Record<Zone, string> = { sweden: 'Europe/Stockholm', india: 'Asia/Kolkata' }

/**
 * Today's date plus the current time in the top bar, with an India / Sweden switch.
 * Pages are cached on the server, so the browser replaces the printed date with the real
 * one and keeps both date and time ticking.
 */
export function TodayDate({
  locale,
  initial,
  labels,
}: {
  locale: Locale
  initial: string
  labels: { india: string; sweden: string; choose: string }
}) {
  const [text, setText] = useState(initial)
  const [time, setTime] = useState('')
  const [zone, setZone] = useState<Zone>('sweden')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('nam-time-zone')
      if (saved === 'india' || saved === 'sweden') setZone(saved)
    } catch {
      /* storage unavailable: keep the default */
    }
  }, [])

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setText(
        new Intl.DateTimeFormat(intlLocales[locale], {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: ZONES[zone],
        }).format(now),
      )
      setTime(
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: ZONES[zone],
        }).format(now),
      )
    }
    update()
    const timer = window.setInterval(update, 15_000)
    return () => window.clearInterval(timer)
  }, [locale, zone])

  const choose = (z: Zone) => {
    setZone(z)
    try {
      window.localStorage.setItem('nam-time-zone', z)
    } catch {
      /* ignore */
    }
  }
  const btn = (z: Zone, label: string) => (
    <button
      type="button"
      onClick={() => choose(z)}
      aria-pressed={zone === z}
      className={`px-2 py-0.5 font-ui text-caption ${
        zone === z ? 'bg-ink text-snow' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex items-center gap-3">
      <p className="meta" suppressHydrationWarning>
        {text}
      </p>
      <div role="group" aria-label={labels.choose} className="flex items-center border border-rule">
        {btn('india', labels.india)}
        {btn('sweden', labels.sweden)}
      </div>
      <p className="meta tabular-nums" suppressHydrationWarning aria-live="off">
        {time}
      </p>
    </div>
  )
}
