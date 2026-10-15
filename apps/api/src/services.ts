import type { PlatformSettings, ServiceKey } from './catalog.js'
import { SERVICE_NAMES, toMinor, type ServiceSelection } from './pricing.js'
import { smsReady } from './sms.js'

export const SERVICE_KEYS: ServiceKey[] = ['smsTickets', 'refundProtection', 'reminder']

/** What step 3 of checkout may offer: switched on in the CMS, and (for SMS ones) deliverable. */
export function offeredServices(settings: PlatformSettings) {
  return SERVICE_KEYS.flatMap((key) => {
    const s = settings.services[key]
    if (!s.enabled) return []
    if ((key === 'smsTickets' || key === 'reminder') && !smsReady()) return []
    return [{ key, name: SERVICE_NAMES[key], price: toMinor(s.price) }]
  })
}

/** Prices the services the buyer picked. Anything not currently offered is silently ignored. */
export function priceServices(selected: ServiceSelection | undefined, settings: PlatformSettings) {
  const offered = offeredServices(settings)
  const lines = offered.filter((o) => selected?.[o.key])
  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.price, 0),
    chosen: {
      smsTickets: lines.some((l) => l.key === 'smsTickets'),
      refundProtection: lines.some((l) => l.key === 'refundProtection'),
      reminder: lines.some((l) => l.key === 'reminder'),
    },
  }
}
