'use client'
import { useState } from 'react'
import { useDocumentInfo, useAuth, useFormFields } from '@payloadcms/ui'

/** Preview, "Send test", "Send to one person" (real attachments) and "Send campaign" on the email campaign screen. */
export function CampaignSend() {
  const { id, savedDocumentData } = useDocumentInfo()
  const { user } = useAuth()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [html, setHtml] = useState('')
  const [to, setTo] = useState((user as { email?: string } | null)?.email ?? '')
  const [one, setOne] = useState('')
  const channel = useFormFields(([f]) => f.channel?.value) as string | undefined
  const sms = channel === 'sms'
  const target = sms && to.includes('@') ? '' : to
  const status = (savedDocumentData as { status?: string } | undefined)?.status

  async function call(payload: object) {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/marketing/send', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...payload }) })
      const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string; html?: string }
      if (j.html) setHtml(j.html)
      else setMsg(j.message || j.error || 'Done.')
      if (res.ok && !('test' in payload) && !('count' in payload) && !('one' in payload) && !('preview' in payload)) setTimeout(() => location.reload(), 1500)
    } catch {
      setMsg('Could not reach the server.')
    }
    setBusy(false)
  }

  if (!id) return <p style={{ opacity: 0.7 }}>Save the campaign first. Then you can preview it, send a test and send it.</p>
  const btn = 'btn btn--style-secondary btn--size-medium'
  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 16, margin: '16px 0' }}>
      <strong>Edit, preview and send</strong>
      <p style={{ margin: '6px 0 12px', opacity: 0.75 }}>Change the words above, press Save, then Preview. The pictures and colours are fixed. Always send a test to yourself first.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {!sms ? <button type="button" className={btn} disabled={busy} onClick={() => call({ preview: true })}>Preview email</button> : null}
        <input value={target} onChange={(e) => setTo(e.target.value)} placeholder={sms ? 'test phone, +46701234567' : 'test email'} style={{ minWidth: 240 }} />
        <button type="button" className={btn} disabled={busy || !target} onClick={() => call({ test: target })}>Send test</button>
        <button type="button" className={btn} disabled={busy} onClick={() => call({ count: true })}>Who gets it?</button>
        <button
          type="button"
          className="btn btn--style-primary btn--size-medium"
          disabled={busy || status === 'sent' || status === 'sending'}
          onClick={() => { if (confirm('Send this campaign to everyone selected? This cannot be undone.')) call({}) }}
        >
          {status === 'sent' ? 'Already sent' : 'Send campaign'}
        </button>
      </div>
      {!sms ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <input value={one} onChange={(e) => setOne(e.target.value)} placeholder="one person's email" style={{ minWidth: 240 }} />
          <button type="button" className={btn} disabled={busy || !one.includes('@')} onClick={() => { if (confirm(`Send this email to ${one} with the files attached?`)) call({ one }) }}>Send to one person (files attached)</button>
        </div>
      ) : null}
      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}
      {html ? (
        <div style={{ marginTop: 14 }}>
          <button type="button" className={btn} onClick={() => setHtml('')}>Close preview</button>
          <iframe title="Email preview" srcDoc={html} style={{ width: '100%', height: 760, border: '1px solid var(--theme-elevation-150)', borderRadius: 6, marginTop: 8, background: '#f1f5f9' }} />
        </div>
      ) : null}
    </div>
  )
}
