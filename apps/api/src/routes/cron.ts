import { timingSafeEqual } from 'node:crypto'
import { Router, type RequestHandler } from 'express'
import { env } from '../env.js'
import { sweepExpiredHolds } from '../stock.js'
import { sweepReminders } from '../reminders.js'

/**
 * Scheduled jobs for Vercel (see vercel.json "crons"). Vercel calls these with
 * `Authorization: Bearer <CRON_SECRET>`. On Render the same work runs on timers in index.ts.
 */
export const cronRouter = Router()

const authorised: RequestHandler = (req, res, next) => {
  const secret = env.CRON_SECRET
  if (!secret) return void res.status(503).json({ error: 'cron_not_configured' })
  const given = Buffer.from(String(req.headers.authorization ?? ''))
  const want = Buffer.from(`Bearer ${secret}`)
  if (given.length !== want.length || !timingSafeEqual(given, want))
    return void res.status(401).json({ error: 'unauthorised' })
  next()
}

cronRouter.get('/cron/sweep', authorised, async (_req, res) => {
  await sweepExpiredHolds()
  res.json({ ok: true })
})

cronRouter.get('/cron/reminders', authorised, async (_req, res) => {
  res.json({ ok: true, sent: await sweepReminders() })
})
