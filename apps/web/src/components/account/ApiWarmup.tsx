'use client'

import { useEffect } from 'react'
import { bookingApiUrl } from '@/lib/booking'

/**
 * Free hosting puts the booking server to sleep when nobody uses it. A silent ping as soon as a
 * visitor opens My Booking wakes it, so "Get tickets" and payment are quick when they get there.
 */
export function ApiWarmup() {
  useEffect(() => {
    if (!bookingApiUrl) return
    fetch(`${bookingApiUrl}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => undefined)
  }, [])
  return null
}
