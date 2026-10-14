'use client'

import { useEffect, useRef, useState } from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import 'leaflet/dist/leaflet.css'

/*
 * Map location picker for events. The organiser searches an address or clicks the map to drop
 * the pin; the coordinates are saved on the event (location.latitude / location.longitude) and
 * show on the "My Booking" map and event page. Tiles and address search use OpenStreetMap
 * (no API key). Typing the numbers by hand in the fields above also works.
 */
const SWEDEN: [number, number] = [62, 15]

export function EventMapPicker() {
  const lat = useField<number | null>({ path: 'location.latitude' })
  const lng = useField<number | null>({ path: 'location.longitude' })
  const address = useFormFields(([f]) => f['location.address']?.value) as string | undefined
  const venueId = useFormFields(([f]) => f['venue']?.value) as string | undefined
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markerRef = useRef<import('leaflet').CircleMarker | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const setRef = useRef({ lat: lat.setValue, lng: lng.setValue })
  setRef.current = { lat: lat.setValue, lng: lng.setValue }
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const hasPoint = typeof lat.value === 'number' && typeof lng.value === 'number'

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    void import('leaflet').then((L) => {
      if (cancelled || !ref.current || mapRef.current) return
      leafletRef.current = L
      const map = L.map(ref.current, { scrollWheelZoom: true }).setView(SWEDEN, 4)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        setRef.current.lat(Number(e.latlng.lat.toFixed(6)))
        setRef.current.lng(Number(e.latlng.lng.toFixed(6)))
      })
      mapRef.current = map
      setReady(true)
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // Keep the pin in step with the coordinates (clicks, search, or typed numbers).
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!ready || !L || !map) return
    if (typeof lat.value === 'number' && typeof lng.value === 'number') {
      const pos: [number, number] = [lat.value, lng.value]
      if (markerRef.current) markerRef.current.setLatLng(pos)
      else
        markerRef.current = L.circleMarker(pos, {
          radius: 10,
          color: '#0b1c33',
          weight: 2,
          fillColor: '#c9a24b',
          fillOpacity: 0.95,
        }).addTo(map)
      map.setView(pos, Math.max(map.getZoom(), 14))
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [ready, lat.value, lng.value])

  async function search() {
    const q = (query || address || '').trim()
    if (!q) return setStatus('Type an address or place name first.')
    setStatus('Searching…')
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } },
      )
      const data = (await r.json()) as { lat: string; lon: string; display_name: string }[]
      if (!data[0]) return setStatus('Nothing found. Try a fuller address, or click the map.')
      lat.setValue(Number(Number(data[0].lat).toFixed(6)))
      lng.setValue(Number(Number(data[0].lon).toFixed(6)))
      setStatus(`Pin placed at: ${data[0].display_name}`)
    } catch {
      setStatus('Search is unavailable right now. Click the map to place the pin instead.')
    }
  }

  function clear() {
    lat.setValue(null)
    lng.setValue(null)
    setStatus('Location removed.')
  }

  const box: React.CSSProperties = { border: '1px solid var(--theme-elevation-150)', borderRadius: 4 }
  return (
    <div style={{ marginBottom: 24 }}>
      <label className="field-label" style={{ display: 'block', marginBottom: 6 }}>
        Event location on the map
      </label>
      <p style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.75 }}>
        Search an address or click the map to drop the pin. This is what buyers see on the My Booking
        map and event page.{venueId ? ' It overrides the venue’s own location.' : ''}
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={query}
          placeholder={address ? `Search "${address}" or type another place` : 'Search address or place'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void search()
            }
          }}
          style={{ ...box, flex: 1, padding: '8px 10px', background: 'var(--theme-input-bg)', color: 'inherit' }}
        />
        <button type="button" className="btn btn--style-primary btn--size-small" onClick={() => void search()}>
          Find on map
        </button>
        {hasPoint ? (
          <button type="button" className="btn btn--style-secondary btn--size-small" onClick={clear}>
            Remove pin
          </button>
        ) : null}
      </div>
      <div ref={ref} style={{ ...box, height: 340, width: '100%', zIndex: 0 }} />
      <p style={{ margin: '8px 0 0', fontSize: 13 }} role="status">
        {status ??
          (hasPoint ? `Pin at ${lat.value}, ${lng.value}` : 'No pin yet. This event will not appear on the map.')}
      </p>
    </div>
  )
}
