import 'server-only'

/**
 * Website-side email (contact notifications, newsletter confirmation) through Resend's
 * HTTP API. Without RESEND_API_KEY nothing is sent and the caller is told so.
 */
export async function sendSiteEmail(mail: {
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.info(`[email:not-sent] to=${mail.to} subject="${mail.subject}"`)
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Nordic Affairs Media <onboarding@resend.dev>',
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      reply_to: mail.replyTo,
    }),
  }).catch(() => null)
  return Boolean(res?.ok)
}

export const escapeHtml = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
