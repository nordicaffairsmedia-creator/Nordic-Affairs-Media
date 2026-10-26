import 'server-only'

/** Texts through Twilio's REST API (same account settings as the booking server). True when Twilio accepted it. */
export const smsConfigured = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID))

export async function sendSms(to: string, body: string, from?: string): Promise<boolean> {
  if (!smsConfigured()) return false
  const sid = process.env.TWILIO_ACCOUNT_SID!
  const base = (process.env.TWILIO_API_BASE || 'https://api.twilio.com').replace(/\/$/, '')
  const params = new URLSearchParams({ To: to, Body: body })
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID)
  else params.set('From', from || process.env.TWILIO_FROM!)
  const res = await fetch(`${base}/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  }).catch(() => null)
  return Boolean(res?.ok)
}
