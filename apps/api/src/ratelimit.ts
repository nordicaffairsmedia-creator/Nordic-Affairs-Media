import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit'
import { getDb } from './db.js'

type Counter = { _id: string; hits: number; expiresAt: Date }

/**
 * Rate-limit counters kept in MongoDB, for serverless hosting (Vercel), where every request
 * may run on a different instance and in-memory counters would never add up.
 * Fixed windows: one small document per visitor per window, removed automatically afterwards
 * (TTL index on `expiresAt`, created in db.ts).
 */
export class MongoRateLimitStore implements Store {
  private windowMs = 60_000
  localKeys = false

  init(options: Options) {
    this.windowMs = options.windowMs
  }

  private col() {
    return getDb().collection<Counter>('booking_ratelimits')
  }

  private slot(key: string, now = Date.now()) {
    const start = Math.floor(now / this.windowMs) * this.windowMs
    return { id: `${key}:${start}`, resetTime: new Date(start + this.windowMs) }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const { id, resetTime } = this.slot(key)
    const run = () =>
      this.col().findOneAndUpdate(
        { _id: id },
        { $inc: { hits: 1 }, $setOnInsert: { expiresAt: new Date(resetTime.getTime() + 60_000) } },
        { upsert: true, returnDocument: 'after' },
      )
    // Two first requests at the same instant can both try to create the counter; retry once.
    const doc = await run().catch(run)
    return { totalHits: doc?.hits ?? 1, resetTime }
  }

  async decrement(key: string): Promise<void> {
    await this.col().updateOne({ _id: this.slot(key).id }, { $inc: { hits: -1 } })
  }

  async resetKey(key: string): Promise<void> {
    await this.col().deleteOne({ _id: this.slot(key).id })
  }
}
