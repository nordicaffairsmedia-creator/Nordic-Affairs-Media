'use client'

import { useRef, useState } from 'react'
import { listForTranslation, translateItem } from '@/app/(staff)/staff/translate/actions'
import type { TranslateItem } from '@/lib/translate'

type Row = TranslateItem & { status: string; state: 'waiting' | 'running' | 'done' | 'error' }

/** Translates one gallery or story at a time, so the small server never gets overloaded. */
export function TranslateRunner({ disabled }: { disabled: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stop = useRef(false)

  const update = (id: string, patch: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const run = async () => {
    stop.current = false
    setRunning(true)
    setError(null)
    try {
      const list = await listForTranslation().catch((e: unknown) => ({
        ok: false as const,
        error: String(e),
      }))
      if (!list.ok) throw new Error(list.error)
      const initial = list.data.map((i) => ({ ...i, status: 'Waiting', state: 'waiting' as const }))
      setRows(initial)
      for (const item of initial) {
        if (stop.current) break
        update(item.id, { status: 'Translating…', state: 'running' })
        let r = await translateItem(item.collection, item.id).catch((e: unknown) => ({
          ok: false as const,
          error: String(e),
        }))
        if (!r.ok) {
          await new Promise((res) => setTimeout(res, 8000))
          r = await translateItem(item.collection, item.id).catch((e: unknown) => ({
            ok: false as const,
            error: String(e),
          }))
        }
        if (r.ok) update(item.id, { status: r.data, state: 'done' })
        else {
          update(item.id, { status: r.error, state: 'error' })
          if (/OPENAI_API_KEY|HTTP 401|HTTP 429/.test(r.error)) throw new Error(r.error)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const btn = 'min-h-11 px-5 font-ui text-caption font-semibold disabled:opacity-40'
  const done = rows.filter((r) => r.state === 'done').length
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <button
            type="button"
            onClick={() => (stop.current = true)}
            className={`${btn} border border-ink`}
          >
            Stop after this item
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void run()}
            className={`${btn} bg-ink text-snow hover:bg-fjord-deep`}
          >
            Translate missing languages
          </button>
        )}
        {rows.length ? (
          <p className="meta">
            {done} of {rows.length} done
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="border-l-2 border-alert pl-4 font-ui text-caption text-alert">
          {error}
        </p>
      ) : null}
      {rows.length ? (
        <table className="w-full border-collapse font-ui text-caption">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-2 pr-4">Item</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-rule">
                <td className="py-2 pr-4">{r.title}</td>
                <td className="py-2 pr-4">{r.collection === 'galleries' ? 'Gallery' : 'Story'}</td>
                <td
                  className={`py-2 ${r.state === 'error' ? 'text-alert' : r.state === 'done' ? 'text-fjord' : ''}`}
                >
                  {r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
