'use client'
import { useState } from 'react'
import { useDocumentInfo, useAuth, useFormFields } from '@payloadcms/ui'

/** "Send test" and "Send campaign" buttons on the email campaign screen. */
export function CampaignSend() {
  const { id, savedDocumentData } = useDocumentInfo()
  const { user } = useAuth()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [to, setTo] = useState((user as { email?: string } | null)?.email ?? '')
  const channel = useFormFields(([f]) => f.channel?.value) as string | undefined
  const sms = channel === 'sms'
  const target = sms && to.includes('@') ? '' : to
  const status = (savedDocumentData as { status?: string } | undefined)?.status

  async function call(payload: object) {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/marketing/send', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...payload }) })
      const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      setMsg(j.message || j.error || 'Done.')
      if (res.ok && !('test' in payload) && !('count' in payload)) setTimeout(() => location.reload(), 1500)
    } catch {
      setMsg('Could not reach the server.')
    }
    setBusy(false)
  }

  if (!id) return <p style={{ opacity: 0.7 }}>Save the campaign first. Then you can send a test and send it.</p>
  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 16, margin: '16px 0' }}>
      <strong>Send</strong>
      <p style={{ margin: '6px 0 12px', opacity: 0.75 }}>Save your changes first. Always send a test to yourself before sending to everyone. Text messages need Twilio set up on the website.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={target} onChange={(e) => setTo(e.target.value)} placeholder={sms ? 'test phone, +46701234567' : 'test email'} style={{ minWidth: 240 }} />
        <button type="button" className="btn btn--style-secondary btn--size-medium" disabled={busy || !target} onClick={() => call({ test: target })}>Send test</button>
        <button type="button" className="btn btn--style-secondary btn--size-medium" disabled={busy} onClick={() => call({ count: true })}>Who gets it?</button>
        <button
          type="button"
          className="btn btn--style-primary btn--size-medium"
          disabled={busy || status === 'sent' || status === 'sending'}
          onClick={() => { if (confirm('Send this campaign to everyone selected? This cannot be undone.')) call({}) }}
        >
          {status === 'sent' ? 'Already sent' : 'Send campaign'}
        </button>
      </div>
      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}
    </div>
  )
}
