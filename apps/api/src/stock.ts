import type { ObjectId } from 'mongodb'
import { getDb } from './db.js'
import { orders } from './orders.js'
import { releasePromoUse } from './catalog.js'
import { releaseOrderSeats } from './seating.js'

/**
 * Ticket stock, like a farm stall's tally board: one counter per tier saying how
 * many tickets are already spoken for (held in a checkout or sold). A ticket is only
 * handed out if adding it keeps the counter at or below the tier's capacity, and that
 * check-and-add happens in a single database step, so two buyers can never both get
 * the last ticket.
 */
type StockDoc = { _id: string; reserved: number }

const key = (eventId: string, tierId: string) => `${eventId}:${tierId}`

export async function reserve(
  eventId: string,
  tierId: string,
  quantity: number,
  capacity: number,
): Promise<boolean> {
  const stock = getDb().collection<StockDoc>('booking_stock')
  const _id = key(eventId, tierId)
  await stock.updateOne({ _id }, { $setOnInsert: { reserved: 0 } }, { upsert: true })
  const res = await stock.updateOne(
    { _id, reserved: { $lte: capacity - quantity } },
    { $inc: { reserved: quantity } },
  )
  return res.modifiedCount === 1
}

export async function release(eventId: string, tierId: string, quantity: number): Promise<void> {
  await getDb()
    .collection<StockDoc>('booking_stock')
    .updateOne(
      { _id: key(eventId, tierId), reserved: { $gte: quantity } },
      { $inc: { reserved: -quantity } },
    )
}

export async function remaining(eventId: string, tiers: { tierId: string; quantity: number }[]) {
  const docs = await getDb()
    .collection<StockDoc>('booking_stock')
    .find({ _id: { $in: tiers.map((t) => key(eventId, t.tierId)) } })
    .toArray()
  const used = new Map(docs.map((d) => [d._id, d.reserved]))
  return Object.fromEntries(
    tiers.map((t) => [t.tierId, Math.max(0, t.quantity - (used.get(key(eventId, t.tierId)) ?? 0))]),
  )
}

export type Hold = {
  _id?: ObjectId
  orderId: string
  eventId: string
  tierId: string
  quantity: number
  status: 'active' | 'converted' | 'released'
  expiresAt: Date
  createdAt: Date
}

/**
 * Releases holds whose time is up. Each hold is flipped from "active" to "released"
 * in one step before its tickets go back on sale, so a hold can never be released twice.
 * Runs every minute and before availability is shown.
 */
export async function sweepExpiredHolds(now = new Date()): Promise<number> {
  const holds = getDb().collection<Hold>('booking_holds')
  let released = 0
  const paidInTime: ObjectId[] = []
  for (;;) {
    const hold = await holds.findOne({
      status: 'active',
      expiresAt: { $lt: now },
      _id: { $nin: paidInTime },
    })
    if (!hold) break
    // Close the order before its seats go back on sale. A payment arriving after this
    // point sees "expired" and has to win the seats back (or is refunded) — so a late
    // payment can never keep tickets whose seats were also resold.
    const expired = await orders().findOneAndUpdate(
      { _id: hold.orderId, status: 'pending' },
      { $set: { status: 'expired' } },
    )
    if (expired?.promoCodeId) await releasePromoUse(expired.promoCodeId)
    const current = expired ?? (await orders().findOne({ _id: hold.orderId }))
    if (current && !expired && ['paid', 'partially_refunded'].includes(current.status)) {
      // Paid just in time: the payment handler converts or releases this hold itself.
      paidInTime.push(hold._id)
      continue
    }
    await releaseOrderHolds(hold.orderId)
    released++
  }
  return released
}

/** Releases every active hold of one order (checkout cancelled or session expired). */
export async function releaseOrderHolds(orderId: string, opts: { keepSeats?: boolean } = {}): Promise<void> {
  if (!opts.keepSeats) await releaseOrderSeats(orderId)
  const holds = getDb().collection<Hold>('booking_holds')
  for (;;) {
    const hold = await holds.findOneAndUpdate(
      { orderId, status: 'active' },
      { $set: { status: 'released' } },
    )
    if (!hold) break
    await release(hold.eventId, hold.tierId, hold.quantity)
  }
}
