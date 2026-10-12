import express, { Router } from 'express'
import type Stripe from 'stripe'
import { releasePromoUse } from '../catalog.js'
import { env } from '../env.js'
import { fulfilOrder } from '../fulfil.js'
import { orders } from '../orders.js'
import { cancelOrderTickets } from '../cancellations.js'
import { releaseOrderHolds } from '../stock.js'
import { stripe } from '../stripe.js'

export const webhookRouter = Router()

const orderIdOf = (obj: {
  metadata?: Stripe.Metadata | null
  client_reference_id?: string | null
}) => obj.metadata?.orderId ?? obj.client_reference_id ?? null

const intentId = (v: string | Stripe.PaymentIntent | null) =>
  typeof v === 'string' ? v : (v?.id ?? undefined)

/**
 * Stripe → us. Every message is verified with the webhook signing secret, so nobody
 * can fake a "payment succeeded". Handlers are safe to receive twice.
 *
 * In the Stripe dashboard, send these events to https://<api>/webhooks/stripe:
 * checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.async_payment_failed, checkout.session.expired, charge.refunded
 */
webhookRouter.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    const s = stripe()
    if (!s || !env.STRIPE_WEBHOOK_SECRET) return void res.status(503).send('Stripe not configured')

    let event: Stripe.Event
    try {
      event = s.webhooks.constructEvent(
        req.body as Buffer,
        String(req.headers['stripe-signature'] ?? ''),
        env.STRIPE_WEBHOOK_SECRET,
      )
    } catch {
      return void res.status(400).send('Bad signature')
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object
        const orderId = orderIdOf(session)
        // Some methods (e.g. bank-based) confirm later; wait for async_payment_succeeded.
        if (orderId && session.payment_status === 'paid')
          await fulfilOrder(orderId, intentId(session.payment_intent))
        break
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const orderId = orderIdOf(event.data.object)
        if (orderId) {
          const order = await orders().findOneAndUpdate(
            { _id: orderId, status: { $in: ['pending', 'expired'] } },
            { $set: { status: 'cancelled' } },
          )
          await releaseOrderHolds(orderId)
          // An order the hold sweeper already expired has had its promo use returned.
          if (order?.status === 'pending' && order.promoCodeId)
            await releasePromoUse(order.promoCodeId)
        }
        break
      }
      case 'charge.refunded': {
        // Refunds made in the Stripe dashboard (or by the organizer panel) are mirrored here.
        const charge = event.data.object
        const pi = intentId(charge.payment_intent as string | Stripe.PaymentIntent | null)
        if (pi) {
          const full = charge.amount_refunded >= charge.amount
          const order = await orders().findOneAndUpdate(
            { stripePaymentIntentId: pi },
            {
              $set: {
                status: full ? 'refunded' : 'partially_refunded',
                refundedAmount: charge.amount_refunded,
              },
            },
          )
          if (order && full) await cancelOrderTickets(order._id)
        }
        break
      }
      default:
        break
    }
    res.json({ received: true })
  },
)
