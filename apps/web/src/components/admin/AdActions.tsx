'use client'
import { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

/** Start, pause, resume and refresh results of one event ad. */
export function AdActions() {
  const { id } = useDocumentInfo()
  const status = useFormFields(([f]) => f.status?.value) as string | undefined
  const started = useFormFields(([f]) => f.metaCampaignId?.value) as string | undefined
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action: string) {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/advertising/action', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action }) })
      const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      setMsg(j.message || j.error || 'Done.')
      if (res.ok) setTimeout(() => location.reload(), 1500)
    } catch {
      setMsg('Could not reach the server.')
    }
    setBusy(false)
  }

  if (!id) return <p style={{ opacity: 0.7 }}>Save the ad first. Then you can start it.</p>
  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 16, margin: '16px 0' }}>
      <strong>Run the ad</strong>
      <p style={{ margin: '6px 0 12px', opacity: 0.75 }}>Save your changes first. Starting sends the ad to Meta, which reviews it and bills the payment method on your ad account.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!started ? (
          <button type="button" className="btn btn--style-primary btn--size-medium" disabled={busy} onClick={() => { if (confirm('Start this ad on Facebook and Instagram? Meta will charge your ad account for the budget you set.')) run('start') }}>Start ad</button>
        ) : (
          <>
            {status === 'paused' ? (
              <button type="button" className="btn btn--style-primary btn--size-medium" disabled={busy} onClick={() => run('resume')}>Resume</button>
            ) : (
              <button type="button" className="btn btn--style-secondary btn--size-medium" disabled={busy} onClick={() => run('pause')}>Pause</button>
            )}
            <button type="button" className="btn btn--style-secondary btn--size-medium" disabled={busy} onClick={() => run('refresh')}>Update results</button>
          </>
        )}
      </div>
      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}
    </div>
  )
}
