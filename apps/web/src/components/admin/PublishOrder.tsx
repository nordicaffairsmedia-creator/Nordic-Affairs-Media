'use client'

import { useEffect, useState } from 'react'

/**
 * Top of every list that can be rearranged by dragging: after moving rows, press Publish and
 * the website shows exactly this order (the page cache is cleared at once, so it takes seconds).
 */
export function PublishOrder() {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  // Media, Videos & audio and Documents open newest first; "Rearrange" switches them to drag-and-drop order.
  const [view, setView] = useState<{ files: boolean; manual: boolean }>({ files: false, manual: true })
  useEffect(() => {
    const files = /\/collections\/(media|videos|documents)\/?$/.test(window.location.pathname)
    setView({ files, manual: !files || new URLSearchParams(window.location.search).get('sort') === '_order' })
  }, [])

  function go(sort: string, limit: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('sort', sort)
    url.searchParams.set('page', '1')
    url.searchParams.set('limit', limit)
    window.location.assign(url.toString())
  }

  const pill = {
    padding: '0.55rem 1.3rem',
    borderRadius: 999,
    border: '1px solid currentColor',
    background: 'transparent',
    color: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
  } as const

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
      {view.files && !view.manual && (
        <button type="button" onClick={() => go('_order', '100')} style={pill}>
          Rearrange
        </button>
      )}
      {view.files && view.manual && (
        <button type="button" onClick={() => go('-createdAt', '25')} style={pill}>
          Newest first
        </button>
      )}
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
        {msg ||
          (view.manual
            ? 'Drag the rows (⋮⋮) into the order you want, then press Publish.'
            : 'Press Rearrange to put these files in your own order, then Publish.')}
      </span>
    </div>
  )
}
