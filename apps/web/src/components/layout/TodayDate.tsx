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
  const dayNumber = new Date().getDate()
  const [hours, minutes] = time ? time.split(':') : ['12', '00']

  return (
    <div className="flex items-center space-x-3.5 text-[12px]">
      {/* Luxury Miniature Calendar Item */}
      <div className="inline-flex items-center space-x-2 group cursor-pointer transition-transform duration-200 hover:scale-105">
        <div className="relative flex flex-col items-center justify-between w-5 h-5 bg-[#0d1c2d] border border-[#c6a258]/35 rounded overflow-hidden shadow-sm group-hover:border-[#e3be75] transition-colors">
          <div className="w-full h-1.5 bg-[#c6a258] flex items-center justify-center">
            <div className="flex space-x-1">
              <span className="w-0.5 h-0.5 bg-[#08121d] rounded-full"></span>
              <span className="w-0.5 h-0.5 bg-[#08121d] rounded-full"></span>
            </div>
          </div>
          <span className="text-[8px] font-bold text-white leading-none mb-0.5">{dayNumber}</span>
        </div>
        <span className="text-slate-300 font-medium tracking-wide text-[11.5px] group-hover:text-white transition-colors" suppressHydrationWarning>
          {text}
        </span>
      </div>

      <span className="text-slate-700 select-none">•</span>

      {/* Segmented Dual Timezone Switcher */}
      <div className="inline-flex items-center rounded border border-slate-700/80 bg-[#0d1c2d] overflow-hidden text-[11.5px] shadow-sm">
        <button
          type="button"
          onClick={() => choose('india')}
          className={`px-2.5 py-0.5 transition-colors flex items-center gap-1.5 ${
            zone === 'india'
              ? 'bg-[#e2f0fd]/90 text-[#091524] font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          {zone === 'india' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
          <span>{labels.india}</span>
        </button>
        <div className="w-[1px] h-3 bg-slate-700/80"></div>
        <button
          type="button"
          onClick={() => choose('sweden')}
          className={`px-2.5 py-0.5 transition-colors flex items-center gap-1.5 ${
            zone === 'sweden'
              ? 'bg-[#e2f0fd]/90 text-[#091524] font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          {zone === 'sweden' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
          <span>{labels.sweden}</span>
        </button>
      </div>

      {/* Animated Clock Miniature Pill */}
      <div className="inline-flex items-center space-x-2 px-2 py-0.5 rounded border border-[#c6a258]/30 bg-[#0d1c2d]/90 shadow-sm backdrop-blur-sm group hover:border-[#e3be75] transition-all">
        <div className="relative w-3.5 h-3.5 rounded-full border border-[#c6a258] flex items-center justify-center shrink-0">
          <div className="w-0.5 h-0.5 bg-[#c6a258] rounded-full z-10"></div>
          <div className="absolute w-[1px] h-1 bg-slate-200 origin-bottom bottom-1.5" style={{ transform: 'rotate(40deg)' }}></div>
          <div className="absolute w-[1px] h-1.5 bg-[#e3be75] origin-bottom bottom-1.5 animate-spin" style={{ animationDuration: '8s' }}></div>
        </div>
        <div className="font-mono text-[11.5px] font-semibold text-slate-200 tracking-wider flex items-center" suppressHydrationWarning>
          <span>{hours}</span>
          <span className="animate-pulse text-[#c6a258] mx-[1px]">:</span>
          <span>{minutes}</span>
          <span className="text-[9px] text-[#c6a258] ml-1 font-sans uppercase font-bold tracking-normal">
            {zone === 'sweden' ? 'CET' : 'IST'}
          </span>
        </div>
      </div>
    </div>
  )
}
