import { getPayloadClient } from '@/lib/payload'

/** How the "left the checkout" reminder is doing: sent, and how many of those people bought afterwards. */
export async function AbandonedStats() {
  let sent = 0
  let recovered = 0
  let amount = 0
  try {
    const payload = await getPayloadClient()
    const db = (payload.db as unknown as { connection: { db: { collection: (n: string) => { find: (f: object, o?: object) => { toArray: () => Promise<Record<string, unknown>[]> } } } } }).connection.db
    const col = db.collection('booking_orders')
    const reminded = await col.find({ abandonedReminderSentAt: { $exists: true } }, { projection: { email: 1, eventId: 1, abandonedReminderSentAt: 1 } }).toArray()
    sent = reminded.length
    const seen = new Set<string>()
    for (const o of reminded.slice(0, 500)) {
      const k = `${o.email}|${o.eventId}`
      if (seen.has(k)) continue
      const [buy] = await col.find({ email: o.email, eventId: o.eventId, status: { $in: ['paid', 'partially_refunded'] }, createdAt: { $gte: o.abandonedReminderSentAt } }, { projection: { total: 1 } }).toArray()
      if (buy) {
        seen.add(k)
        recovered++
        amount += Math.round(Number(buy.total ?? 0) / 100)
      }
    }
  } catch {
    /* numbers stay 0 */
  }
  return (
    <div style={{ display: 'flex', gap: 24, padding: '12px 0' }}>
      <div><strong style={{ fontSize: 22 }}>{sent}</strong><div style={{ opacity: 0.7 }}>Sent</div></div>
      <div><strong style={{ fontSize: 22 }}>{recovered}</strong><div style={{ opacity: 0.7 }}>Recovered orders</div></div>
      <div><strong style={{ fontSize: 22 }}>{amount} kr</strong><div style={{ opacity: 0.7 }}>Recovered</div></div>
    </div>
  )
}
