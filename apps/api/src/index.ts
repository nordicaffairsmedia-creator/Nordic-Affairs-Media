import { env } from './env.js'
import { connect, disconnect } from './db.js'
import { sweepExpiredHolds } from './stock.js'
import { sweepReminders } from './reminders.js'
import app from './app.js'

/**
 * Long-running server (Render, or `npm run dev` on your computer).
 * On Vercel this file is not used: api/index.js serves ./app.js per request, and the two
 * timers below become the scheduled jobs in routes/cron.ts (see vercel.json).
 */
await connect()

// Give expired ticket holds back to the stock every minute.
const sweeper = setInterval(() => {
  sweepExpiredHolds().catch((e: unknown) => console.error('[sweeper]', e))
}, 60_000)

// Text event reminders (a paid extra) every 5 minutes. Does nothing unless Twilio is set up.
const reminders = setInterval(() => {
  sweepReminders().catch((e: unknown) => console.error('[reminders]', e))
}, 5 * 60_000)

const server = app.listen(env.PORT, () => {
  console.log(`Booking API listening on :${env.PORT} (web: ${env.WEB_URL})`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(sweeper)
    clearInterval(reminders)
    server.close(() => {
      void disconnect().then(() => process.exit(0))
    })
  })
}
