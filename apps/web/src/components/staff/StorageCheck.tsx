'use client'

import { useState } from 'react'
import {
  browserTestTarget,
  cleanupTest,
  fixStorageCors,
  runStorageCheck,
} from '@/app/(staff)/staff/storage/actions'

type Step = { id: string; label: string; ok: boolean; detail?: string; hint?: string }
type Result = { steps: Step[]; origins: string[]; json: string; origin: string; allOk: boolean }

const btn =
  'inline-flex min-h-11 items-center justify-center rounded-pill border border-current px-5 font-ui text-caption font-semibold disabled:opacity-50'

/** Runs the storage check, fixes the bucket's CORS rule, and tries a real upload from this browser. */
export function StorageCheck() {
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [browser, setBrowser] = useState<{ ok: boolean; text: string } | null>(null)

  const check = async () => {
    setBusy('check')
    setMsg(null)
    setRes(await runStorageCheck())
    setBusy(null)
  }
  const fix = async () => {
    setBusy('fix')
    const r = await fixStorageCors()
    setMsg({ ok: r.ok, text: r.message })
    setRes(await runStorageCheck())
    setBusy(null)
  }
  const testBrowser = async () => {
    setBusy('browser')
    setBrowser(null)
    try {
      const { url, key } = await browserTestTarget()
      const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'upload test' })
      await cleanupTest(key)
      setBrowser(
        r.ok
          ? { ok: true, text: 'Upload from this browser to the bucket works. Photos and videos will save.' }
          : { ok: false, text: `The bucket answered with an error (HTTP ${r.status}). Check the keys above.` },
      )
    } catch {
      setBrowser({
        ok: false,
        text: 'The browser could not reach the bucket: this is the "Failed to fetch" problem. Press "Fix bucket settings", or paste the rule below into Cloudflare, then test again.',
      })
    }
    setBusy(null)
  }

  const corsBad = res?.steps.some((s) => s.id === 'cors' && !s.ok)

  return (
    <div className="space-y-6 font-ui text-caption">
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btn} disabled={busy !== null} onClick={() => void check()}>
          {busy === 'check' ? 'Checking…' : '1. Check storage'}
        </button>
        <button type="button" className={btn} disabled={busy !== null} onClick={() => void fix()}>
          {busy === 'fix' ? 'Fixing…' : '2. Fix bucket settings'}
        </button>
        <button type="button" className={btn} disabled={busy !== null} onClick={() => void testBrowser()}>
          {busy === 'browser' ? 'Testing…' : '3. Test upload from this browser'}
        </button>
      </div>

      {res ? (
        <ul className="space-y-3" data-testid="storage-steps">
          {res.steps.map((s) => (
            <li key={s.id} className="border-l-2 pl-4" style={{ borderColor: s.ok ? '#2e9e5b' : '#d64545' }}>
              <p className="font-semibold">
                {s.ok ? '✓' : '✗'} {s.label}
              </p>
              {s.detail ? <p className="text-charcoal break-words">{s.detail}</p> : null}
              {!s.ok && s.hint ? <p className="mt-1">{s.hint}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {msg ? (
        <p role="status" data-testid="storage-fix-msg" className="border-l-2 pl-4" style={{ borderColor: msg.ok ? '#2e9e5b' : '#d64545' }}>
          {msg.text}
        </p>
      ) : null}
      {browser ? (
        <p role="status" data-testid="storage-browser-msg" className="border-l-2 pl-4" style={{ borderColor: browser.ok ? '#2e9e5b' : '#d64545' }}>
          {browser.ok ? '✓ ' : '✗ '}
          {browser.text}
        </p>
      ) : null}

      {res && (corsBad || msg?.ok === false) ? (
        <details open className="space-y-2">
          <summary className="cursor-pointer font-semibold">Fix it by hand in Cloudflare (if the button cannot)</summary>
          <ol className="list-decimal space-y-1 pl-6">
            <li>Cloudflare → R2 → open your bucket → <strong>Settings</strong> → <strong>CORS Policy</strong> → <strong>Add CORS policy</strong>.</li>
            <li>Choose the <strong>JSON</strong> tab, delete what is there and paste this:</li>
          </ol>
          <pre className="overflow-x-auto bg-black/30 p-3 text-meta" data-testid="storage-json">{res.json}</pre>
          <p>Press Save, wait a minute, then press &ldquo;3. Test upload from this browser&rdquo;. Every website address that uses the admin must be in the list (the list above already contains this one).</p>
        </details>
      ) : null}
    </div>
  )
}
