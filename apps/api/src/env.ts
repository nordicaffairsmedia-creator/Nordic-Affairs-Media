import { z } from 'zod'

const origins = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    // Render's dashboard and `fromService` sometimes give a bare host name; treat it as https.
    .map((s) => (/^https?:\/\//.test(s) ? s : `https://${s}`))
    .map((s) => s.replace(/\/$/, ''))

/** Blank values in .env files or dashboards count as "not set". */
const blank = (v: unknown) => (v === '' ? undefined : v)

/** API keys / secrets: strip spaces, line breaks, quotes and hidden characters pasted by accident. */
const secret = (v: unknown) => {
  const t = typeof v === 'string' ? v.replace(/[\s"'\u200B-\u200D\uFEFF]/g, '') : v
  return t === '' ? undefined : t
}

/** Fail fast on start-up if configuration is missing or malformed. */
const schema = z.object({
  DATABASE_URI: z.string().startsWith('mongodb'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Website address(es). The first one is used to build links in emails and Stripe redirects. */
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000').transform(origins),
  /** This API's own public address, used for receipt/ticket PDF links in emails. */
  PUBLIC_API_URL: z.preprocess(
    blank,
    z
      .string()
      .optional()
      .transform((v) => (v ? origins(v)[0] : undefined)),
  ),
  RENDER_EXTERNAL_URL: z.preprocess(blank, z.string().optional()),

  // Payments (phase 3). Without these, checkout answers "payments not configured".
  STRIPE_SECRET_KEY: z.preprocess(secret, z.string().startsWith('sk_').optional()),
  // Test-only: point the Stripe client at a local stand-in (host:port). Never set in production.
  STRIPE_API_HOST: z.preprocess(blank, z.string().optional()),
  // Optional comma list (e.g. card,klarna,swish). Leave empty to use the methods switched on in the Stripe Dashboard.
  STRIPE_PAYMENT_METHODS: z.preprocess(blank, z.string().optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(secret, z.string().startsWith('whsec_').optional()),
  // Publishable key (pk_...): lets the website show the Google Pay / Apple Pay sheet. Safe to expose.
  // Without it, the Google Pay and Apple Pay buttons simply use Stripe's card page.
  STRIPE_PUBLISHABLE_KEY: z.preprocess(secret, z.string().startsWith('pk_').optional()),

  // "demo" = a dummy payment page (no money moves) used while Stripe keys are not set yet.
  // Ignored as soon as STRIPE_SECRET_KEY exists. Leave unset in real production.
  PAYMENT_MODE: z.preprocess(blank, z.enum(['stripe', 'demo']).default('stripe')),

  // Email. Without a key, emails are written to the log instead of sent (development).
  RESEND_API_KEY: z.preprocess(secret, z.string().optional()),
  EMAIL_FROM: z.preprocess(
    blank,
    z.string().default('Nordic Affairs Media <onboarding@resend.dev>'),
  ),
  SUPPORT_EMAIL: z.preprocess(blank, z.string().optional()),

  // SMS (Twilio) for the "tickets by SMS" and "event reminder" services. Without all three,
  // those two services are not offered to buyers (so nobody pays for something we cannot send).
  TWILIO_ACCOUNT_SID: z.preprocess(blank, z.string().optional()),
  TWILIO_AUTH_TOKEN: z.preprocess(secret, z.string().optional()),
  TWILIO_FROM: z.preprocess(blank, z.string().optional()),
  TWILIO_API_BASE: z.preprocess(blank, z.string().default('https://api.twilio.com')),

  // Shared secret between the website server and this API for staff-only endpoints.
  INTERNAL_API_KEY: z.preprocess(secret, z.string().min(24).optional()),

  // AI assistant (ChatGPT). Off unless a key is set and the owner switches it on.
  OPENAI_API_KEY: z.preprocess(secret, z.string().optional()),
  OPENAI_MODEL: z.preprocess(blank, z.string().default('gpt-4.1-mini')),

  // Entraiot commission on ticket sales (payment option B): a percentage of net ticket revenue,
  // optionally plus a fixed amount per paid ticket. Set only here on the server, never in the CMS.
  // Option A (fixed price, no commission): set ENTRAIOT_COMMISSION_PERCENT=0.
  ENTRAIOT_COMMISSION_PERCENT: z.coerce.number().min(0).max(20).default(3),
  /** Optional fixed part per paid ticket, per currency, e.g. "SEK:5,EUR:0.45". Empty = none. */
  ENTRAIOT_COMMISSION_FIXED: z.preprocess(blank, z.string().default('')),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = schema.parse(process.env)

export const env = {
  ...parsed,
  WEB_URL: parsed.ALLOWED_ORIGINS[0] ?? 'http://localhost:3000',
  API_URL: (
    parsed.PUBLIC_API_URL ??
    parsed.RENDER_EXTERNAL_URL ??
    `http://localhost:${parsed.PORT}`
  ).replace(/\/$/, ''),
}
