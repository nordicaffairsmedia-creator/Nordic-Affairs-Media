import { env } from './env.js'

export type Attachment = { filename: string; content: Buffer }

type Mail = { to: string; subject: string; html: string; text: string; attachments?: Attachment[] }

/**
 * Sends through Resend's HTTP API (no extra library). Without RESEND_API_KEY the email
 * is written to the server log instead, so development never fails on email.
 * Returns true when the provider accepted the message.
 */
export async function sendEmail(mail: Mail): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.info(
      `[email:not-sent] to=${mail.to} (set RESEND_API_KEY to send; subject not logged, it may hold a sign-in code)`,
    )
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      reply_to: env.SUPPORT_EMAIL,
      attachments: mail.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      })),
    }),
  })
  if (!res.ok) {
    console.error(`[email:failed] ${res.status} ${await res.text().catch(() => '')}`)
    return false
  }
  return true
}

/** Minimal HTML escaping for values placed into email templates. */
export function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}
