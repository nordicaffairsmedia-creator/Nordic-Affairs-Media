'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export type MapPoint = { id: string; slug: string; title: string; when: string; where: string; lat: number; lng: number }

/**
 * Map of events at REAL venue coordinates only (set by the organiser in the CMS). Tiles come
 * from OpenStreetMap (no key needed). Clicking a marker opens a small preview with a link
 * to the event page inside My Booking.
 */
export function HubMap({ points, locale, viewLabel }: { points: MapPoint[]; locale: string; viewLabel: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || points.length === 0) return
    let map: import('leaflet').Map | undefined
    let cancelled = false
    void import('leaflet').then((L) => {
      if (cancelled || !ref.current) return
      map = L.map(ref.current, { scrollWheelZoom: false })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)
      const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
      const bounds = L.latLngBounds([])
      for (const p of points) {
        const m = L.circleMarker([p.lat, p.lng], { radius: 9, color: '#0b1c33', weight: 2, fillColor: '#c9a24b', fillOpacity: 0.95 }).addTo(map)
        m.bindPopup(
          `<strong>${esc(p.title)}</strong><br>${esc(p.when)}${p.where ? `<br>${esc(p.where)}` : ''}<br><a href="/${encodeURIComponent(locale)}/events/${encodeURIComponent(p.slug)}">${esc(viewLabel)}</a>`,
        )
        bounds.extend([p.lat, p.lng])
      }
      if (points.length === 1) map.setView([points[0]!.lat, points[0]!.lng], 14)
      else map.fitBounds(bounds, { padding: [30, 30] })
    })
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [points, locale, viewLabel])

  return <div ref={ref} data-testid="hub-map" className="h-[28rem] w-full border border-rule" role="region" aria-label="Map" />
}
