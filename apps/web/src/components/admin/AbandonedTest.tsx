'use client'
import { useState } from 'react'

/** "Send a test email": the reminder goes to your own address (or the one you type). The email says it is a test. */
export function AbandonedTest() {
  const [to, setTo] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function send() {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/marketing/automation-test', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to }) })
      const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      setMsg(j.message || j.error || 'Done.')
    } catch {
      setMsg('Could not reach the server.')
    }
    setBusy(false)
  }
  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 16, margin: '16px 0' }}>
      <strong>Send a test email</strong>
      <p style={{ opacity: 0.75, margin: '6px 0 12px' }}>Leave empty to send it to your own address. The email says it is a test, and its button goes to the event page. Save your changes first.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="your email (optional)" style={{ minWidth: 260 }} />
        <button type="button" className="btn btn--style-secondary btn--size-medium" disabled={busy} onClick={send}>Send test</button>
      </div>
      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}
    </div>
  )
}
