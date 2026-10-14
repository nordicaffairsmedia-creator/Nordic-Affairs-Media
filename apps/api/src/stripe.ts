import Stripe from 'stripe'
import { env } from './env.js'

let client: Stripe | null = null

/** The Stripe account belongs to the client; keys come only from environment settings. */
export function stripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null
  const [host, port] = (env.STRIPE_API_HOST ?? '').split(':')
  client ??= new Stripe(env.STRIPE_SECRET_KEY, {
    appInfo: { name: 'Nordic Affairs Media booking' },
    maxNetworkRetries: 2,
    ...(host ? { host, port: port ?? '80', protocol: 'http' as const } : {}),
  })
  return client
}

/** Stripe's checkout pages come in many languages; Tamil/Malayalam fall back to English. */
export function stripeLocale(locale: string): Stripe.Checkout.SessionCreateParams.Locale {
  return locale === 'sv' ? 'sv' : 'en'
}
