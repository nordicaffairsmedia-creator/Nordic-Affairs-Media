'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { importBasicsStep, importItemStep, planImport } from '@/app/(staff)/staff/import/actions'
import type { PlanItem } from '@/lib/wordpress/importer'

type Status = { state: 'waiting' | 'running' | 'done' | 'error'; text: string; next: number }
const STORE = 'nam-wp-import'

function loadSaved(): Record<string, Status> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, Status>
  } catch {
    return {}
  }
}
function save(state: Record<string, Status>) {
  try {
    localStorage.setItem(STORE, JSON.stringify(state))
  } catch {
    /* private window — progress just isn't remembered */
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Drives the import in small steps from the browser, so the work survives the free
 * server going to sleep and can be stopped and resumed at any time.
 */
export function ImportRunner({ disabled }: { disabled: boolean }) {
  const [plan, setPlan] = useState<PlanItem[] | null>(null)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const stop = useRef(false)

  useEffect(() => setStatus(loadSaved()), [])

  const note = (line: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${line}`, ...l].slice(0, 300))

  const set = (key: string, s: Status) =>
    setStatus((prev) => {
      const next = { ...prev, [key]: s }
      save(next)
      return next
    })

  const run = useCallback(async () => {
    stop.current = false
    setRunning(true)
    setError(null)
    // Keep the screen awake while importing, where the browser allows it.
    type Lock = { release: () => Promise<void> }
    let lock: Lock | null = null
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<Lock> } })
        .wakeLock
      if (wl) lock = await wl.request('screen')
    } catch {
      /* not supported */
    }
    try {
      let items = plan
      if (!items) {
        note('Reading the old website…')
        const p = await planImport().catch((e: unknown) => ({
          ok: false as const,
          error: `Server did not answer (${String(e)}) — press Continue again in a minute`,
        }))
        if (!p.ok) throw new Error(p.error)
        items = p.data
        setPlan(items)
        note(`Found ${items.length} items to move.`)
      }

      const saved = loadSaved()
      if (saved.basics?.state !== 'done') {
        set('basics', { state: 'running', text: 'Working…', next: 0 })
        const r = await importBasicsStep().catch((e: unknown) => ({
          ok: false as const,
          error: `Server did not answer (${String(e)}) — press Continue again in a minute`,
        }))
        if (!r.ok) throw new Error(r.error)
        r.data.failed.forEach((f) => note(`Basics: ${f}`))
        set('basics', { state: 'done', text: r.data.message, next: 0 })
        note('Contact details, About page, press logos, menu and redirects done.')
      }

      for (const item of items) {
        if (stop.current) break
        const prev = loadSaved()[item.key]
        if (prev?.state === 'done') continue
        let offset = prev?.next ?? 0
        let tries = 0
        while (!stop.current) {
          set(item.key, { state: 'running', text: 'Working…', next: offset })
          // A thrown error usually means the free server restarted mid-step (e.g. out of
          // memory) — wait for it to come back and try the same step again.
          const r = await importItemStep(item.key, offset, item.duplicateOf).catch(
            (e: unknown) => ({
              ok: false as const,
              error: `Server did not answer (${e instanceof Error ? e.message : String(e)})`,
            }),
          )
          if (!r.ok) {
            tries++
            note(`${item.title}: ${r.error}${tries < 6 ? ' — retrying shortly' : ''}`)
            if (tries >= 6) {
              set(item.key, { state: 'error', text: r.error, next: offset })
              if (/refused|reach the old website|storage/i.test(r.error)) throw new Error(r.error)
              break
            }
            await sleep(10000 * tries)
            continue
          }
          tries = 0
          r.data.failed.forEach((f) => note(`${item.title}: ${f}`))
          offset = r.data.next
          set(item.key, {
            state: r.data.done ? 'done' : 'running',
            text: r.data.message,
            next: r.data.done ? 0 : offset,
          })
          if (r.data.done) {
            note(`${item.title}: ${r.data.message}`)
            break
          }
        }
      }
      if (!stop.current) note('Finished. Check the galleries on the website.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      await lock?.release().catch(() => undefined)
      setRunning(false)
    }
  }, [plan])

  const reset = () => {
    save({})
    setStatus({})
    setPlan(null)
    setLog([])
  }

  const total = plan?.reduce((n, i) => n + (i.duplicateOf ? 0 : i.photos), 0) ?? 0
  const doneCount = plan?.filter((i) => status[i.key]?.state === 'done').length ?? 0
  const btn = 'min-h-11 px-5 font-ui text-caption font-semibold disabled:opacity-40'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <button
            type="button"
            onClick={() => (stop.current = true)}
            className={`${btn} border border-ink`}
          >
            Stop after this step
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void run()}
            className={`${btn} bg-ink text-snow hover:bg-fjord-deep`}
          >
            {Object.keys(status).length ? 'Continue import' : 'Start import'}
          </button>
        )}
        {!running && Object.keys(status).length ? (
          <button type="button" onClick={reset} className={`${btn} text-charcoal underline`}>
            Forget progress
          </button>
        ) : null}
        {plan ? (
          <p className="meta">
            {doneCount} of {plan.length} items done · {total.toLocaleString('en')} photos in total
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="border-l-2 border-alert pl-4 font-ui text-caption text-alert">
          {error}
        </p>
      ) : null}

      {plan ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse font-ui text-caption">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Photos</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((i) => {
                const s = status[i.key]
                return (
                  <tr key={i.key} className="border-b border-rule align-top">
                    <td className="py-2 pr-4">
                      {i.title}
                      <span className="block text-meta text-mist">{i.oldPath}</span>
                    </td>
                    <td className="py-2 pr-4">
                      {i.kind === 'gallery' ? 'Gallery' : i.hasVideo ? 'Video story' : 'Story'}
                    </td>
                    <td className="py-2 pr-4">{i.duplicateOf ? '—' : i.photos || '—'}</td>
                    <td
                      className={`py-2 ${s?.state === 'error' ? 'text-alert' : s?.state === 'done' ? 'text-fjord' : ''}`}
                    >
                      {s ? s.text : i.duplicateOf ? `Duplicate of ${i.duplicateOf}` : 'Waiting'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {log.length ? (
        <details open>
          <summary className="cursor-pointer font-ui text-caption font-semibold">Activity</summary>
          <ol className="mt-3 max-h-80 space-y-1 overflow-y-auto font-mono text-meta text-charcoal">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  )
}
