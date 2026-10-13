import Stripe from 'stripe'
import { env } from './env.js'

let client: Stripe | null = null

/** The Stripe account belongs to the client; keys come only from environment settings. */
export function stripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null
  client ??= new Stripe(env.STRIPE_SECRET_KEY, {
    appInfo: { name: 'Nordic Affairs Media booking' },
  })
  return client
}

/** Stripe's checkout pages come in many languages; Tamil/Malayalam fall back to English. */
export function stripeLocale(locale: string): Stripe.Checkout.SessionCreateParams.Locale {
  return locale === 'sv' ? 'sv' : 'en'
}
