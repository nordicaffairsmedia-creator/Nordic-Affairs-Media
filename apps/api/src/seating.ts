import { ObjectId, type Document } from 'mongodb'
import { getDb } from './db.js'
import type { CatalogEvent, Tier } from './catalog.js'

/**
 * Reserved seating. A venue can carry a seating plan (CMS → Venues → Seating plan): sections made of
 * rows × seats. An event set to "Reserved seats" sells exactly those seats. The price of a seat comes
 * from the ticket tier that lists its section.
 *
 * Seat ids look like "A:C:12" (section A, row C, seat 12). Who holds or owns a seat lives in one
 * collection, `booking_seats`, one document per taken seat, keyed by "<eventId>|<seatId>". Because the
 * key is unique, two buyers can never both get the same seat: whoever inserts first wins.
 */
export type PlanSection = {
  code: string
  name: string
  rows: number
  seatsPerRow: number
  firstRow: string
  unavailable: Set<string> // "C12" = row C seat 12 (removed seats, pillars, wheelchair bays …)
  aisleAfter: number[] // seat numbers after which a walkway is drawn
}
export type Plan = { stageLabel: string; sections: PlanSection[] }

export type Seat = {
  id: string
  section: string
  row: string
  number: number
  label: string // "Section A · Row C · Seat 12"
}

const MAX_SEATS = 5000

/** 0 → A, 25 → Z, 26 → AA … starting from the section's first row letter. */
export function rowLabel(index: number, first: string): string {
  const base = (first.trim().toUpperCase().charCodeAt(0) || 65) - 65
  let n = base + index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

const clean = (v: unknown, max = 40) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const codeOf = (v: unknown) => clean(v, 12).replace(/[^A-Za-z0-9]/g, '').toUpperCase()

export function parsePlan(venue: Document | null | undefined): Plan | null {
  const raw = (venue?.seatingPlan ?? null) as Document | null
  const sections = Array.isArray(raw?.sections) ? (raw!.sections as Document[]) : []
  const out: PlanSection[] = []
  let total = 0
  for (const s of sections) {
    const code = codeOf(s.code)
    const rows = Math.floor(Number(s.rows))
    const seatsPerRow = Math.floor(Number(s.seatsPerRow))
    if (!code || out.some((o) => o.code === code)) continue
    if (!(rows >= 1 && rows <= 60 && seatsPerRow >= 1 && seatsPerRow <= 100)) continue
    total += rows * seatsPerRow
    if (total > MAX_SEATS) break
    out.push({
      code,
      name: clean(s.name, 60) || `Section ${code}`,
      rows,
      seatsPerRow,
      firstRow: clean(s.firstRow, 2).toUpperCase() || 'A',
      unavailable: new Set(
        clean(s.unavailable, 2000)
          .toUpperCase()
          .split(/[\s,;]+/)
          .filter(Boolean),
      ),
      aisleAfter: clean(s.aisleAfter, 200)
        .split(/[\s,;]+/)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    })
  }
  return out.length ? { stageLabel: clean(raw?.stageLabel, 40) || 'Stage', sections: out } : null
}

export const seatId = (section: string, row: string, n: number) => `${section}:${row}:${n}`
const labelOf = (sec: PlanSection, row: string, n: number) => `${sec.name} · Row ${row} · Seat ${n}`

/** Every sellable seat of the plan, keyed by id. */
export function planSeats(plan: Plan): Map<string, Seat> {
  const map = new Map<string, Seat>()
  for (const sec of plan.sections)
    for (let r = 0; r < sec.rows; r++) {
      const row = rowLabel(r, sec.firstRow)
      for (let n = 1; n <= sec.seatsPerRow; n++) {
        if (sec.unavailable.has(`${row}${n}`)) continue
        const id = seatId(sec.code, row, n)
        map.set(id, { id, section: sec.code, row, number: n, label: labelOf(sec, row, n) })
      }
    }
  return map
}

/** The tier that sells a section ("Sections" field of the tier: "A, B"). First match wins. */
export function tierForSection(tiers: Tier[], code: string): Tier | null {
  for (const t of tiers) {
    const list = clean((t as Tier & { sections?: string }).sections, 200)
      .toUpperCase()
      .split(/[\s,;]+/)
      .filter(Boolean)
    if (list.includes(code)) return t
  }
  return null
}

export type SeatedEvent = { plan: Plan; seats: Map<string, Seat> }

export async function seatedSetup(event: CatalogEvent): Promise<SeatedEvent | null> {
  if ((event as CatalogEvent & { seating?: string }).seating !== 'reserved' || !event.venue) return null
  const id = typeof event.venue === 'string' ? (ObjectId.isValid(event.venue) ? new ObjectId(event.venue) : null) : event.venue
  if (!id) return null
  const venue = await getDb().collection<Document>('venues').findOne({ _id: id })
  const plan = parsePlan(venue)
  if (!plan) return null
  return { plan, seats: planSeats(plan) }
}

// ---- who holds / owns seats ----

type SeatDoc = {
  _id: string
  eventId: string
  seatId: string
  status: 'held' | 'sold'
  claim?: string
  orderId?: string
  expiresAt?: Date
  code?: string
}
const col = () => getDb().collection<SeatDoc>('booking_seats')
const key = (eventId: string, id: string) => `${eventId}|${id}`

/** Ids of seats nobody else can take right now (sold, or held and the hold has not run out). */
export async function takenSeatIds(eventId: string, now = new Date()): Promise<Set<string>> {
  const docs = await col()
    .find({ eventId, $or: [{ status: 'sold' }, { expiresAt: { $gt: now } }] })
    .toArray()
  return new Set(docs.map((d) => d.seatId))
}

/**
 * Tries to hold all the seats for one checkout, all or none. Returns the seats that were already
 * taken (empty = success).
 */
export async function holdSeats(
  eventId: string,
  ids: string[],
  claim: string,
  expiresAt: Date,
): Promise<string[]> {
  const got: string[] = []
  const lost: string[] = []
  const now = new Date()
  for (const id of ids) {
    try {
      await col().insertOne({ _id: key(eventId, id), eventId, seatId: id, status: 'held', claim, expiresAt })
      got.push(id)
    } catch {
      // Already there: it is ours to take only if it is an expired hold.
      const r = await col().updateOne(
        { _id: key(eventId, id), status: 'held', expiresAt: { $lt: now } },
        { $set: { claim, expiresAt }, $unset: { orderId: '' } },
      )
      if (r.modifiedCount === 1) got.push(id)
      else lost.push(id)
    }
  }
  if (lost.length) {
    await releaseSeatsByClaim(claim)
    return lost
  }
  return []
}

export async function releaseSeatsByClaim(claim: string): Promise<void> {
  await col().deleteMany({ claim, status: 'held' })
}

/** Ties the seats of a checkout to the order that was just created. */
export async function attachSeats(claim: string, orderId: string, expiresAt: Date): Promise<void> {
  await col().updateMany({ claim, status: 'held' }, { $set: { orderId, expiresAt } })
}

/** Checkout cancelled / expired: seats go back on sale. */
export async function releaseOrderSeats(orderId: string): Promise<void> {
  await col().deleteMany({ orderId, status: 'held' })
}

/** Payment confirmed: the held seats become sold (no more expiry). */
export async function sellOrderSeats(orderId: string): Promise<void> {
  await col().updateMany({ orderId, status: 'held' }, { $set: { status: 'sold' }, $unset: { expiresAt: '' } })
}

/** A cancelled / refunded ticket frees its seat again. */
export async function freeSeat(eventId: string, id: string): Promise<void> {
  await col().deleteOne({ _id: key(eventId, id), status: 'sold' })
}

/** A buyer who paid after the hold ran out wins their seats back only if nobody took them meanwhile. */
export async function reclaimSeats(eventId: string, orderId: string, ids: string[]): Promise<boolean> {
  const claimed: string[] = []
  for (const id of ids) {
    try {
      await col().insertOne({ _id: key(eventId, id), eventId, seatId: id, status: 'held', orderId, claim: orderId, expiresAt: new Date(Date.now() + 60_000) })
      claimed.push(id)
    } catch {
      const mine = await col().findOne({ _id: key(eventId, id) })
      if (mine && mine.orderId === orderId) claimed.push(id)
      else {
        for (const c of claimed) await col().deleteOne({ _id: key(eventId, c), orderId, status: 'held' })
        return false
      }
    }
  }
  return true
}

/** The plan as the website needs it: every seat with its state and price. */
export function publicSeating(
  setup: SeatedEvent,
  tiers: Tier[],
  taken: Set<string>,
  nameOf: (t: Tier) => string,
  toMinor: (n: number) => number,
) {
  return {
    stageLabel: setup.plan.stageLabel,
    sections: setup.plan.sections.map((sec) => {
      const tier = tierForSection(tiers, sec.code)
      return {
        code: sec.code,
        name: sec.name,
        tierId: tier?.tierId ?? null,
        tierName: tier ? nameOf(tier) : '',
        price: tier ? toMinor(tier.price) : 0,
        aisleAfter: sec.aisleAfter,
        rows: Array.from({ length: sec.rows }, (_, r) => {
          const row = rowLabel(r, sec.firstRow)
          return {
            label: row,
            seats: Array.from({ length: sec.seatsPerRow }, (_, i) => {
              const n = i + 1
              const id = seatId(sec.code, row, n)
              // state: 0 = free, 1 = taken, 2 = not a seat (gap / removed)
              const state = sec.unavailable.has(`${row}${n}`) ? 2 : taken.has(id) ? 1 : tier ? 0 : 1
              return { n, id, s: state }
            }),
          }
        }),
      }
    }),
  }
}
