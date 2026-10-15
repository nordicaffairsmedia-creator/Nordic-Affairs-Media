import { isDoc } from '@/lib/payload'
import type { Event } from '@/payload-types'

export type EventPlace = {
  name: string
  address: string
  lat: number
  lng: number
  city: string
} | null

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Where to pin an event: the location the organiser set on the event itself, otherwise the
 * venue's coordinates. Returns null when neither has real coordinates.
 */
export function eventPlace(event: Pick<Event, 'location' | 'venue'>): EventPlace {
  const venue = isDoc(event.venue) ? event.venue : null
  const loc = event.location
  if (loc && num(loc.latitude) && num(loc.longitude)) {
    return {
      name: loc.placeName || venue?.name || '',
      address: loc.address || venue?.address || '',
      lat: loc.latitude,
      lng: loc.longitude,
      city: venue?.city ?? '',
    }
  }
  if (venue && num(venue.latitude) && num(venue.longitude)) {
    return { name: venue.name, address: venue.address ?? '', lat: venue.latitude, lng: venue.longitude, city: venue.city }
  }
  return null
}
