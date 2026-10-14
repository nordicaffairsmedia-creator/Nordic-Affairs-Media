import { tickets } from './orders.js'
import { release } from './stock.js'
import { freeSeat } from './seating.js'

/**
 * Cancels tickets and puts their places back on sale. Each ticket is flipped from
 * "valid" to "cancelled" in one step before its place is released, so a ticket can
 * never be released twice (e.g. when both the organizer and Stripe report a refund).
 * Tickets already used at the gate are left as they are.
 */
export async function cancelOrderTickets(orderId: string): Promise<number> {
  let count = 0
  for (;;) {
    const t = await tickets().findOneAndUpdate(
      { orderId, status: 'valid' },
      { $set: { status: 'cancelled' } },
    )
    if (!t) break
    await release(t.eventId, t.tierId, 1)
    if (t.seat) await freeSeat(t.eventId, t.seat)
    count++
  }
  return count
}

export async function cancelTicket(code: string): Promise<boolean> {
  const t = await tickets().findOneAndUpdate(
    { code, status: 'valid' },
    { $set: { status: 'cancelled' } },
  )
  if (!t) return false
  await release(t.eventId, t.tierId, 1)
  if (t.seat) await freeSeat(t.eventId, t.seat)
  return true
}
