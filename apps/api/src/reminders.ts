import { formatDateTime } from './messages.js'
import { orderLink } from './fulfil.js'
import { orders } from './orders.js'
import { sendSms, smsReady } from './sms.js'

/**
 * "Event reminder" service: texts the buyer once, within 24 hours before the event starts.
 * Runs every few minutes while the API is awake. Each order is claimed atomically first, so
 * it is texted at most once even if two sweeps overlap.
 */
export async function sweepReminders(now = new Date()): Promise<number> {
  if (!smsReady()) return 0
  const until = new Date(now.getTime() + 24 * 3600_000)
  let sent = 0
  for (;;) {
    const order = await orders().findOneAndUpdate(
      {
        status: { $in: ['paid', 'partially_refunded'] },
        'services.reminder': true,
        phone: { $exists: true, $ne: '' },
        reminderSentAt: { $exists: false },
        eventStartsAt: { $gt: now, $lte: until },
      },
      { $set: { reminderSentAt: now } },
    )
    if (!order || !order.phone) break
    const ok = await sendSms(
      order.phone,
      `Reminder: ${order.eventTitleEn} starts ${formatDateTime(order.eventStartsAt, 'en')}${
        order.venueName ? ` at ${order.venueName}` : ''
      }. Your tickets: ${orderLink(order)}`,
    ).catch(() => false)
    // Claimed once, never retried: a wrong phone number must not block everyone else's reminders.
    if (ok) sent++
    else console.error(`[reminders] ${order._id}: SMS not sent`)
  }
  return sent
}
