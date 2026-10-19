import type { PublicOrder } from './bookingTypes'

export type TierStats = {
  tierId: string
  name: string
  price: number
  capacity: number
  sold: number
  checkedIn: number
  cancelled: number
  held: number
  remaining: number
}

export type EventStats = {
  event: { id: string; title: string; startsAt: string; currency: string }
  tiers: TierStats[]
  sources: { _id: string; orders: number; gross: number; refunded: number }[]
  gross: number
  refunded: number
  orders: number
  cancelRequests: number
}

export type StaffOrder = PublicOrder & {
  source: 'online' | 'comp' | 'boxoffice'
  refundedAmount: number
  refundable: boolean
  note: string | null
}

export type Attendee = {
  name: string
  email: string
  tier: string
  seat?: string | null
  status: 'valid' | 'checked_in' | 'cancelled'
  checkedInAt: string | null
  order: string
  source: string
  code: string
}

export type CheckinResult = {
  result: 'ok' | 'already' | 'cancelled' | 'wrong_event' | 'not_found' | 'error'
  holder?: string
  tier?: string
  seat?: string | null
  order?: string
  event?: string
  checkedInAt?: string | null
  code?: string
  demo?: boolean
}

type ReportRow = { orders: number; tickets: number; gross: number; refunded: number; vat: number }
export type Reports = {
  from: string
  to: string
  byEvent: (ReportRow & { _id: { event: string; currency: string } })[]
  byMonth: (ReportRow & { _id: { month: string; currency: string } })[]
  bySource: (ReportRow & { _id: { source: string; currency: string } })[]
  byOrganizer: {
    organizer: string
    currency: string
    commissionPercent: number
    events: number
    net: number
    commission: number
    payout: number
  }[]
  /** Entraiot's platform fee on ticket sales (older booking servers leave it out). */
  platformFee?: {
    percent: number
    fixed: Record<string, number>
    byMonth: {
      month: string
      currency: string
      orders: number
      tickets: number
      net: number
      commission: number
    }[]
  }
}
