'use client'

import { useState } from 'react'

/**
 * Top of every list that can be rearranged by dragging: after moving rows, press Publish and
 * the website shows exactly this order (the page cache is cleared at once, so it takes seconds).
 */
export function PublishOrder() {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function publish() {
    setState('busy')
    try {
      const r = await fetch('/staff/publish-order', { method: 'POST' })
      const out = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(out.error ?? `The server answered ${r.status}`)
      setState('done')
      setMsg(`Published at ${new Date().toLocaleTimeString()} — the website now shows this order.`)
    } catch (e) {
      setState('error')
      setMsg(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div
      style={{
        margin: '0 0 1rem',
        padding: '0.75rem 1rem',
        border: '1px solid rgba(128,128,128,.5)',
        borderRadius: 10,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <button
        type="button"
        onClick={() => void publish()}
        disabled={state === 'busy'}
        style={{
          padding: '0.55rem 1.3rem',
          borderRadius: 999,
          border: '1px solid currentColor',
          background: 'transparent',
          color: 'inherit',
          fontWeight: 700,
          cursor: state === 'busy' ? 'wait' : 'pointer',
        }}
      >
        {state === 'busy' ? 'Publishing…' : 'Publish'}
      </button>
      <span style={{ opacity: 0.85, color: state === 'error' ? '#ff6b6b' : undefined }}>
        {msg || 'Drag the rows (⋮⋮) into the order you want, then press Publish.'}
      </span>
    </div>
  )
}
