import { createHash, randomBytes, randomInt } from 'node:crypto'
import type { ObjectId } from 'mongodb'
import { getDb } from './db.js'
import type { Locale } from './catalog.js'

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'expired'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled'

export type OrderItem = {
  tierId: string
  name: string
  unitPrice: number // minor units (öre / cents), incl. VAT
  quantity: number
}

export type SeatItem = { seatId: string; label: string; tierId: string; tierName: string }

export type Order = {
  _id: string // human-friendly reference, e.g. NAM-7K3QX9
  accessToken: string // unguessable, lets the buyer open confirmation, tickets and receipt
  eventId: string
  eventSlug: string
  eventTitle: string // in the buyer's language
  eventTitleEn: string // for PDFs (Latin fonts)
  eventStartsAt: Date
  venueName: string
  locale: Locale
  email: string // for paid online orders this is filled from the payment page (Stripe)
  name: string
  phone?: string
  country?: string
  postalCode?: string
  companyName?: string
  consent?: { marketing: boolean; promoter: boolean }
  /** Extras bought in step 3 of checkout. */
  services?: { smsTickets: boolean; refundProtection: boolean; reminder: boolean }
  smsTicketsSentAt?: Date
  /** Tracking link (Marketing center) the buyer came from, e.g. "instagram-bio". */
  trackingSource?: string
  /** Set when the "left the checkout" reminder email was sent (once per order). */
  abandonedReminderSentAt?: Date
  reminderSentAt?: Date
  currency: string
  items: OrderItem[]
  /** Reserved seating: the exact seats of this order (one ticket each). */
  seatItems?: SeatItem[]
  subtotal: number
  discount: number
  fees: number
  servicesTotal?: number
  total: number
  ticketVatRate: number
  feeVatRate: number
  vatAmount: number
  promoCodeId?: ObjectId
  promoCode?: string
  status: OrderStatus
  /** online = Stripe checkout; comp = free guest-list ticket; boxoffice = paid at the door/desk */
  source?: 'online' | 'comp' | 'boxoffice'
  note?: string
  createdBy?: string
  /** Website address the buyer ordered from (so links go back to the site they used). */
  webOrigin?: string
  /** Paid through the dummy payment page (PAYMENT_MODE=demo). No money moved. */
  demo?: boolean
  stripeSessionId?: string
  stripePaymentIntentId?: string
  refundedAmount?: number
  createdAt: Date
  paidAt?: Date
  emailSentAt?: Date
  cancelRequestedAt?: Date
}

export type Ticket = {
  _id?: ObjectId
  code: string
  orderId: string
  eventId: string
  tierId: string
  tierName: string
  holderName: string
  /** Reserved seating: seat id ("A:C:12") and the text shown on the ticket. */
  seat?: string
  seatLabel?: string
  status: 'valid' | 'checked_in' | 'cancelled'
  checkedInAt?: Date
  checkedInBy?: string
  createdAt: Date
}

export const orders = () => getDb().collection<Order>('booking_orders')
export const tickets = () => getDb().collection<Ticket>('booking_tickets')

// No 0/O/1/I/L — readable over the phone and on a printed ticket.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

function randomCode(length: number): string {
  let s = ''
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

export const newOrderRef = () => `NAM-${randomCode(6)}`
export const newTicketCode = () => randomCode(20) // ~98 bits: cannot be guessed
export const newToken = () => randomBytes(24).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** What the website is allowed to see about an order (never Stripe ids or tokens of others). */
export function publicOrder(order: Order, orderTickets: Ticket[]) {
  return {
    ref: order._id,
    status: order.status,
    event: {
      id: order.eventId,
      slug: order.eventSlug,
      title: order.eventTitle,
      startsAt: order.eventStartsAt,
      venue: order.venueName,
    },
    name: order.name,
    email: order.email,
    currency: order.currency,
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    fees: order.fees,
    servicesTotal: order.servicesTotal ?? 0,
    services: order.services ?? { smsTickets: false, refundProtection: false, reminder: false },
    total: order.total,
    vatAmount: order.vatAmount,
    promoCode: order.promoCode ?? null,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? null,
    cancelRequested: Boolean(order.cancelRequestedAt),
    source: order.source ?? 'online',
    demo: Boolean(order.demo),
    tickets: orderTickets.map((t) => ({
      code: t.code,
      tier: t.tierName,
      holder: t.holderName,
      status: t.status,
      seat: t.seatLabel ?? null,
    })),
  }
}
