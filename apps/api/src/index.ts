import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { env } from './env.js'
import { connect, disconnect } from './db.js'
import { sweepExpiredHolds } from './stock.js'
import { checkoutRouter } from './routes/checkout.js'
import { ordersRouter } from './routes/orders.js'
import { webhookRouter } from './routes/webhooks.js'
import { hasInternalKey, internalRouter } from './routes/internal.js'
import { assistantRouter } from './routes/assistant.js'
import { promoRouter } from './routes/promo.js'
import { demoRouter } from './demo.js'
import { sweepReminders } from './reminders.js'
import { sweepAbandonedCheckouts } from './abandoned.js'

/**
 * Booking API (PRD v1.1).
 *   GET  /events/:id/availability   tickets left per tier (ticket picker)
 *   POST /checkout                  hold tickets + Stripe Checkout (B-02..B-05)
 *   POST /webhooks/stripe           payment confirmed → QR tickets + email (B-06, B-07)
 *   GET  /orders/:ref               confirmation / tickets (link token or My Bookings sign-in)
 *   GET  /orders/:ref/tickets.pdf   tickets PDF
 *   GET  /orders/:ref/receipt.pdf   receipt with VAT
 *   POST /orders/:ref/resend        email tickets again
 *   POST /orders/:ref/cancel-request
 *   POST /auth/code, /auth/verify, /auth/signout, GET /me/orders   My Bookings (B-01, B-08)
 *   POST /promo/preview             server-calculated promo discount for the ticket picker
 *   POST /quote                     live order summary for the My Booking checkout
 *   GET  /config, POST /assistant/chat   AI assistant (PRD §7)
 *   /internal/*                     staff only: dashboard, refunds, comps, announcements,
 *                                   gate check-in, reports (needs INTERNAL_API_KEY)
 */
const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1) // behind Render's proxy
app.use(helmet())

// Stripe needs the untouched request body to verify its signature, so this comes before JSON parsing.
app.use(webhookRouter)

app.use(express.json({ limit: '100kb' }))

// CORS: only the website may call the API from a browser.
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && env.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '600')
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // The website's server (staff dashboard, gate scanner, confirmation page) shares one
    // address for every visitor, so it must not count against the per-visitor limit.
    skip: (req) => hasInternalKey(req),
  }),
)

app.get('/health', async (_req, res) => {
  const db = await connect()
  await db.command({ ping: 1 })
  res.json({
    ok: true,
    service: 'nam-booking-api',
    payments: Boolean(env.STRIPE_SECRET_KEY),
    demoPayments: !env.STRIPE_SECRET_KEY && env.PAYMENT_MODE === 'demo',
    email: Boolean(env.RESEND_API_KEY),
  })
})

app.use(checkoutRouter)
app.use(ordersRouter)
app.use(promoRouter)
app.use(demoRouter)
app.use(assistantRouter)
app.use(internalRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' })
})

const onError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'server_error' })
}
app.use(onError)

await connect()

// Give expired ticket holds back to the stock every minute.
const sweeper = setInterval(() => {
  sweepExpiredHolds().catch((e: unknown) => console.error('[sweeper]', e))
}, 60_000)

// Text event reminders (a paid extra) every 5 minutes. Does nothing unless Twilio is set up.
const reminders = setInterval(() => {
  sweepReminders().catch((e: unknown) => console.error('[reminders]', e))
}, 5 * 60_000)

// "Left the checkout" reminder emails (Marketing center → Marketing settings). Off until switched on there.
const abandoned = setInterval(() => {
  sweepAbandonedCheckouts().catch((e: unknown) => console.error('[abandoned]', e))
}, 5 * 60_000)

const server = app.listen(env.PORT, () => {
  console.log(`Booking API listening on :${env.PORT} (web: ${env.WEB_URL})`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(sweeper)
    clearInterval(reminders)
    clearInterval(abandoned)
    server.close(() => {
      void disconnect().then(() => process.exit(0))
    })
  })
}
