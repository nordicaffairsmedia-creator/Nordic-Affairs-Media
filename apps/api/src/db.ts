import { MongoClient, type Db } from 'mongodb'
import { env } from './env.js'

let db: Db | null = null
let connecting: Promise<Db> | null = null
// Small pool on Vercel: many short-lived instances each hold a few connections (Atlas limits the total).
const client = new MongoClient(env.DATABASE_URI, process.env.VERCEL ? { maxPoolSize: 3 } : {})

/**
 * Collections owned by the booking API (all prefixed `booking_`; the CMS never writes them):
 *
 * - booking_stock    one counter per event ticket tier: how many are reserved
 *                    (held in a checkout + sold). Updated atomically, so the same
 *                    ticket can never be sold twice, even in a ticket rush.
 * - booking_holds    tickets set aside during one checkout. Expire → released.
 * - booking_orders   one per checkout: items, prices, VAT, status, Stripe ids.
 * - booking_tickets  one per admission, with the unguessable code in the QR.
 * - booking_codes    one-time email login codes for "My Bookings" (hashed).
 * - booking_sessions My Bookings sign-ins (token stored hashed).
 * - booking_ratelimits request counters (only used on Vercel; expire by themselves).
 */
export function connect(): Promise<Db> {
  if (db) return Promise.resolve(db)
  // Several requests can arrive at once on a fresh instance: they all wait for the same connection.
  connecting ??= open().catch((e: unknown) => {
    connecting = null
    throw e
  })
  return connecting
}

async function open(): Promise<Db> {
  await client.connect()
  const database = client.db()

  // Phase 1 created a self-deleting (TTL) index on holds. Holds must now be released
  // through the stock counter instead, so that index is removed if it exists.
  await database
    .collection('booking_holds')
    .dropIndex('expiresAt_1')
    .catch(() => undefined)

  await Promise.all([
    database.collection('booking_holds').createIndex({ status: 1, expiresAt: 1 }),
    database.collection('booking_holds').createIndex({ orderId: 1 }),
    database.collection('booking_orders').createIndex({ email: 1, createdAt: -1 }),
    database.collection('booking_orders').createIndex({ eventId: 1, status: 1 }),
    database.collection('booking_orders').createIndex({ stripeSessionId: 1 }, { sparse: true }),
    database.collection('booking_tickets').createIndex({ code: 1 }, { unique: true }),
    database.collection('booking_tickets').createIndex({ orderId: 1 }),
    database.collection('booking_tickets').createIndex({ eventId: 1, status: 1 }),
    database.collection('booking_codes').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('booking_codes').createIndex({ email: 1 }),
    database
      .collection('booking_sessions')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('booking_sessions').createIndex({ tokenHash: 1 }, { unique: true }),
    database
      .collection('booking_ratelimits')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ])
  db = database
  return db
}

export function getDb(): Db {
  if (!db) throw new Error('Database not connected yet')
  return db
}

export async function disconnect(): Promise<void> {
  await client.close()
  db = null
  connecting = null
}
