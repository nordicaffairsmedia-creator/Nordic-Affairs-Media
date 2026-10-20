'use client'

import { useState } from 'react'
import { cleanUnfinishedUploads, listUnfinishedUploads } from '@/app/(staff)/staff/storage/actions'

/** Shows half-finished uploads (they appear in Cloudflare as "Ongoing Multipart Upload") and removes them. */
export function CleanupUploads() {
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')

  async function check() {
    setBusy(true)
    try {
      const l = await listUnfinishedUploads()
      setText(l.length ? `${l.length} unfinished upload(s) found in storage.` : 'No unfinished uploads. Storage is clean.')
    } catch (e) {
      setText(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  async function clean() {
    setBusy(true)
    try {
      const r = await cleanUnfinishedUploads()
      setText(`Removed ${r.aborted} unfinished upload(s).${r.kept ? ` ${r.kept} started in the last 30 minutes were kept (they may still be running).` : ''}`)
    } catch (e) {
      setText(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  return (
    <div className="mt-10 max-w-3xl space-y-3 font-text text-body">
      <h2 className="font-semibold">Clean up unfinished uploads</h2>
      <p>
        A video that failed or was cancelled can leave its pieces in Cloudflare (shown there as
        &quot;Ongoing Multipart Upload&quot;) and they use storage. This removes them. Finished files are never touched, and uploads
        started in the last 30 minutes are kept.
      </p>
      <div className="flex gap-3">
        <button type="button" disabled={busy} onClick={check} className="rounded border px-4 py-2">
          Check
        </button>
        <button type="button" disabled={busy} onClick={clean} className="rounded border px-4 py-2 font-semibold">
          Remove unfinished uploads
        </button>
      </div>
      {text && <p role="status">{text}</p>}
    </div>
  )
}
