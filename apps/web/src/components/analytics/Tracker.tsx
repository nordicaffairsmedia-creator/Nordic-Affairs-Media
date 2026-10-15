'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Tells the site's own counter (/api/track) which page was opened. The first page of a
 * visit is marked as an "entry" when the visitor came from another website or typed the
 * address. No cookies or storage are used.
 */
export function Tracker() {
  const path = usePathname()
  const first = useRef(true)
  useEffect(() => {
    if (!path) return
    let entry = false
    if (first.current) {
      first.current = false
      try {
        entry = !document.referrer || new URL(document.referrer).host !== location.host
      } catch {
        entry = true
      }
    }
    const body = JSON.stringify({ path, entry })
    try {
      if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) {
        void fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => undefined)
      }
    } catch {
      // ignore
    }
  }, [path])
  return null
}
