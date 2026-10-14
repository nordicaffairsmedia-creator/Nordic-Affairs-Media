import { findPublishedEvent, getEmailTexts } from './catalog.js'
import { esc, sendEmail } from './email.js'
import { env } from './env.js'
import { formatDateTime, intlLocale, messages } from './messages.js'
import { newTicketCode, orders, tickets, type Order, type Ticket } from './orders.js'
import { formatMoney } from './pricing.js'
import { receiptPdf, ticketsPdf } from './documents.js'
import { release, releaseOrderHolds, reserve } from './stock.js'
import { getDb } from './db.js'
import { stripe } from './stripe.js'
import { sendSms, smsReady } from './sms.js'
import type { Hold } from './stock.js'

export const orderLink = (order: Order) =>
  `${order.webOrigin ?? env.WEB_URL}/${order.locale}/booking/confirmation?order=${encodeURIComponent(order._id)}&t=${order.accessToken}`

/**
 * Marks an order paid and issues its tickets. Safe to call more than once for the same
 * order (Stripe may notify twice): only the first call changes anything.
 *
 * If the buyer paid after their hold ran out, we try to take the tickets again. If they
 * have been sold to someone else meanwhile, the payment is refunded automatically.
 */
export async function fulfilOrder(
  orderId: string,
  paymentIntentId?: string,
): Promise<Order | null> {
  const before = await orders().findOneAndUpdate(
    { _id: orderId, status: { $in: ['pending', 'expired'] } },
    {
      $set: {
        status: 'paid',
        paidAt: new Date(),
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      },
    },
  )
  if (!before) return orders().findOne({ _id: orderId }) // already handled

  const holds = getDb().collection<Hold>('booking_holds')
  if (before.status === 'expired') {
    const event = await findPublishedEvent(before.eventId)
    const ok = event ? await reacquire(before, event.tiers ?? []) : false
    if (!ok) {
      await refundWhole(before, paymentIntentId)
      return orders().findOne({ _id: orderId })
    }
    // Fresh seats were taken above, so any hold the sweeper had not yet freed goes back.
    await releaseOrderHolds(orderId)
  } else {
    await holds.updateMany({ orderId, status: 'active' }, { $set: { status: 'converted' } })
  }

  const existing = await tickets().countDocuments({ orderId })
  if (existing === 0) {
    const now = new Date()
    const docs: Ticket[] = before.items.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        code: newTicketCode(),
        orderId,
        eventId: before.eventId,
        tierId: item.tierId,
        tierName: item.name,
        holderName: before.name,
        status: 'valid' as const,
        createdAt: now,
      })),
    )
    if (docs.length) await tickets().insertMany(docs)
  }

  const order = await orders().findOne({ _id: orderId })
  if (order) {
    // Tickets exist from here on; a mail outage must not make Stripe retry (the retry
    // would find the order already paid and do nothing). Staff can resend from the panel.
    await sendTicketsEmail(order).catch((e) =>
      console.error(`[booking] ${orderId}: tickets issued but email failed`, e),
    )
    // "Tickets by SMS" service: a link to the QR tickets. A failure here never undoes the sale.
    if (order.services?.smsTickets && order.phone && smsReady()) {
      const sent = await sendSms(
        order.phone,
        `${order.eventTitleEn}: your tickets are booked. Open your tickets: ${orderLink(order)}`,
      ).catch(() => false)
      if (sent) await orders().updateOne({ _id: orderId }, { $set: { smsTicketsSentAt: new Date() } })
    }
  }
  return order
}

async function reacquire(
  order: Order,
  tiers: { tierId: string; quantity: number }[],
): Promise<boolean> {
  const taken: { tierId: string; quantity: number }[] = []
  for (const item of order.items) {
    const tier = tiers.find((t) => t.tierId === item.tierId)
    if (!tier || !(await reserve(order.eventId, item.tierId, item.quantity, tier.quantity))) {
      for (const t of taken) await release(order.eventId, t.tierId, t.quantity)
      return false
    }
    taken.push({ tierId: item.tierId, quantity: item.quantity })
  }
  return true
}

async function refundWhole(order: Order, paymentIntentId?: string): Promise<void> {
  const s = stripe()
  if (s && paymentIntentId) {
    await s.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: { orderId: order._id, cause: 'sold_out_after_hold_expired' },
    })
  }
  await orders().updateOne(
    { _id: order._id },
    { $set: { status: 'refunded', refundedAmount: order.total } },
  )
  console.warn(`[booking] ${order._id}: paid after hold expired and tickets were gone — refunded`)
}

/** Sends (or re-sends) the confirmation with tickets and receipt attached. */
export async function sendTicketsEmail(order: Order): Promise<boolean> {
  const list = await tickets()
    .find({ orderId: order._id, status: { $ne: 'cancelled' } })
    .toArray()
  if (!list.length) return false
  const base = messages(order.locale)
  const custom = await getEmailTexts(order.locale)
  const t = {
    ...base,
    ticketsIntro: custom.ticketsIntro || base.ticketsIntro,
    help: custom.ticketsFooter || base.help,
  }
  const money = formatMoney(order.total, order.currency, intlLocale[order.locale])
  const when = formatDateTime(order.eventStartsAt, order.locale)
  const link = orderLink(order)

  const html = `<!doctype html><html lang="${order.locale}"><body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;color:#121414">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-size:11px;letter-spacing:3px;color:#835c20;margin:0 0 24px">NORDIC AFFAIRS MEDIA${order.demo ? ' · DEMO' : ''}</p>${order.demo ? '<p style="background:#fff3cd;padding:10px;font-size:13px">Demo order: paid through the practice payment page. No money was taken.</p>' : ''}
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:28px;margin:0 0 16px">${esc(order.eventTitle)}</h1>
<p>${esc(t.hello)} ${esc(order.name)},</p>
<p style="line-height:1.6">${esc(t.ticketsIntro)}</p>
<table style="width:100%;border-top:1px solid #dcd8cf;border-bottom:1px solid #dcd8cf;margin:20px 0;font-size:14px" cellpadding="6">
<tr><td style="color:#5c6366">${esc(t.date)}</td><td>${esc(when)}</td></tr>
${order.venueName ? `<tr><td style="color:#5c6366">${esc(t.venue)}</td><td>${esc(order.venueName)}</td></tr>` : ''}
<tr><td style="color:#5c6366">${esc(t.order)}</td><td>${esc(order._id)} · ${list.length} ×</td></tr>
<tr><td style="color:#5c6366">${esc(t.total)}</td><td><strong>${esc(money)}</strong></td></tr>
</table>
<p><a href="${esc(link)}" style="display:inline-block;background:#121414;color:#fff;text-decoration:none;padding:12px 20px">${esc(t.viewOnline)}</a></p>
<p style="color:#5c6366;font-size:13px;margin-top:32px">${esc(t.help)}</p>
</div></body></html>`
  const text = `${order.demo ? '[DEMO ORDER - no money was taken]\n\n' : ''}${t.hello} ${order.name},\n\n${t.ticketsIntro}\n\n${order.eventTitle}\n${t.date}: ${when}\n${order.venueName ? `${t.venue}: ${order.venueName}\n` : ''}${t.order}: ${order._id}\n${t.total}: ${money}\n\n${t.viewOnline}: ${link}\n\n${t.help}`

  const [ticketFile, receiptFile] = await Promise.all([
    ticketsPdf(order, list),
    order.total > 0 ? receiptPdf(order) : null,
  ])
  const sent = await sendEmail({
    to: order.email,
    subject: `${order.demo ? '[DEMO] ' : ''}${t.ticketsSubject} — ${order.eventTitle} (${order._id})`,
    html,
    text,
    attachments: [
      { filename: `tickets-${order._id}.pdf`, content: ticketFile },
      ...(receiptFile ? [{ filename: `receipt-${order._id}.pdf`, content: receiptFile }] : []),
    ],
  })
  if (sent) await orders().updateOne({ _id: order._id }, { $set: { emailSentAt: new Date() } })
  return sent
}
