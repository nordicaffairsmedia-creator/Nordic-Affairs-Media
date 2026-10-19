import { MongoClient, type Db } from 'mongodb'
import { env } from './env.js'

let db: Db | null = null
const client = new MongoClient(env.DATABASE_URI)

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
 */
export async function connect(): Promise<Db> {
  if (db) return db
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
}
