'use client'
import { useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type Row = { kind: 'rating' | 'tag'; score?: number | null; tag?: string | null; email: string }

/** Shows the stars and tags readers clicked in this campaign's email. */
export function FeedbackResults() {
  const { id } = useDocumentInfo()
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/email-feedback?where[campaign][equals]=${id}&limit=2000&depth=0`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { docs?: Row[] }) => setRows(j.docs ?? []))
      .catch(() => setRows([]))
  }, [id])

  if (!id) return null
  const ratings = (rows ?? []).filter((r) => r.kind === 'rating' && r.score)
  const avg = ratings.length ? ratings.reduce((n, r) => n + (r.score ?? 0), 0) / ratings.length : 0
  const tags = new Map<string, number>()
  for (const r of rows ?? []) if (r.kind === 'tag' && r.tag) tags.set(r.tag, (tags.get(r.tag) ?? 0) + 1)
  const box = { border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 16, margin: '16px 0' } as const

  return (
    <div style={box}>
      <strong>Feedback results</strong>
      {rows === null ? <p style={{ opacity: 0.7 }}>Loading...</p> : !rows.length ? <p style={{ opacity: 0.7 }}>No stars or tags clicked yet.</p> : (
        <>
          <p style={{ margin: '8px 0' }}>{ratings.length ? <>Average <strong>{avg.toFixed(1)} / 5</strong> from {ratings.length} rating{ratings.length === 1 ? '' : 's'}</> : 'No ratings yet.'}</p>
          {[5, 4, 3, 2, 1].map((n) => {
            const count = ratings.filter((r) => r.score === n).length
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0' }}>
                <span style={{ width: 28 }}>{n} &#9733;</span>
                <div style={{ flex: 1, background: 'var(--theme-elevation-100)', height: 8, borderRadius: 4 }}>
                  <div style={{ width: ratings.length ? `${(count / ratings.length) * 100}%` : 0, background: '#005293', height: 8, borderRadius: 4 }} />
                </div>
                <span style={{ width: 28, textAlign: 'right' }}>{count}</span>
              </div>
            )
          })}
          {tags.size ? (
            <p style={{ margin: '12px 0 0' }}>
              {[...tags.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <span key={t} style={{ display: 'inline-block', border: '1px solid var(--theme-elevation-200)', borderRadius: 999, padding: '3px 12px', margin: '0 6px 6px 0' }}>{t}: <strong>{n}</strong></span>
              ))}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
