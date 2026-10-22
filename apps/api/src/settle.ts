import type Stripe from 'stripe'
import { fulfilOrder } from './fulfil.js'
import { orders } from './orders.js'

export const orderIdOf = (obj: {
  metadata?: Stripe.Metadata | null
  client_reference_id?: string | null
}) => obj.metadata?.orderId ?? obj.client_reference_id ?? null

export const intentId = (v: string | Stripe.PaymentIntent | null) =>
  typeof v === 'string' ? v : (v?.id ?? undefined)

/**
 * Turns a paid Stripe Checkout Session into tickets. Used by the Stripe webhook AND by the
 * confirmation page, whichever arrives first; fulfilOrder is safe to run twice.
 * Returns true when the order is (now) paid.
 */
export async function settleSession(session: Stripe.Checkout.Session): Promise<boolean> {
  const orderId = orderIdOf(session)
  if (!orderId) return false
  const order = await orders().findOne({ _id: orderId })
  if (!order) return false
  // The charged amount must match what we priced; anything else is left for a human to look at.
  if (session.amount_total != null && session.amount_total !== order.total) {
    console.error(`[stripe] ${orderId}: Stripe amount ${session.amount_total} != order ${order.total}`)
    return false
  }
  // The buyer's details come from Stripe's payment page; copy them onto the order first,
  // so the tickets, the email and "My bookings" use them.
  const cd = session.customer_details
  if (cd?.email) {
    await orders().updateOne(
      { _id: orderId, email: '' },
      {
        $set: {
          email: cd.email.trim().toLowerCase(),
          name: (cd.name ?? '').trim().slice(0, 80),
          ...(cd.phone ? { phone: cd.phone.slice(0, 30) } : {}),
        },
      },
    )
  }
  // Some methods (e.g. bank-based) confirm later; wait for async_payment_succeeded.
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return false
  await fulfilOrder(orderId, intentId(session.payment_intent))
  return true
}

/**
 * Turns a paid PaymentIntent (Google Pay / Apple Pay on our own page) into tickets. Orders paid through
 * Stripe's hosted Checkout page are skipped here: they are settled from the Checkout Session, which
 * also carries the buyer's details.
 */
export async function settleIntent(pi: Stripe.PaymentIntent): Promise<boolean> {
  const orderId = pi.metadata?.orderId
  if (!orderId) return false
  const order = await orders().findOne({ _id: orderId })
  if (!order || order.stripeSessionId) return false
  if (order.stripePaymentIntentId && order.stripePaymentIntentId !== pi.id) return false
  if (pi.status !== 'succeeded') return false
  if (pi.amount_received !== order.total) {
    console.error(`[stripe] ${orderId}: Stripe amount ${pi.amount_received} != order ${order.total}`)
    return false
  }
  await fulfilOrder(orderId, pi.id)
  return true
}
