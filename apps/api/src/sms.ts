import { env } from './env.js'

/** True when Twilio is fully configured. The two SMS services are only offered when this is true. */
export const smsReady = () =>
  Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)

/**
 * Sends one SMS through Twilio's REST API (no extra library).
 * Returns true when Twilio accepted the message.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!smsReady()) {
    console.info('[sms:not-sent] Twilio is not configured')
    return false
  }
  const sid = env.TWILIO_ACCOUNT_SID!
  const res = await fetch(
    `${env.TWILIO_API_BASE.replace(/\/$/, '')}/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: env.TWILIO_FROM!, Body: body }).toString(),
    },
  )
  if (!res.ok) {
    console.error(`[sms:failed] ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
    return false
  }
  return true
}
