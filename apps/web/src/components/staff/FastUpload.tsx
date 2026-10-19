'use client'

/* eslint-disable @next/next/no-html-link-for-pages -- the admin is a separate app: a full page load is right */

import { useRef, useState } from 'react'

/**
 * Fast bulk upload. The browser does the heavy work in parallel:
 *   1. one request asks the server for upload addresses for every file,
 *   2. photos are shrunk to the web sizes right here (no server-side resizing),
 *   3. up to 8 files at a time go straight to the storage bucket,
 *   4. one request per 50 files records them in the library.
 * No per-file messages: one progress bar, then one summary.
 */

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const MAX_VIDEO = 500 * 1024 * 1024 * 1024 // practical ceiling; big files go up in 64 MB pieces
const CONCURRENCY = 8
/** Files above this size are sent in pieces (one upload can be 5 GB at most). */
const BIG = 100 * 1024 * 1024
const PART_CONCURRENCY = 4
const SIZES = [
  { key: 'thumb', width: 480 },
  { key: 'card', width: 960 },
  { key: 'feature', width: 1600 },
  { key: 'og', width: 1200, height: 630 },
] as const
type SizeKey = (typeof SIZES)[number]['key']

type Meta = { filename: string; width: number; height: number; mimeType: string; filesize: number }
type Item = {
  filename: string
  mimeType: string
  filesize: number
  width?: number
  height?: number
  sizes?: Partial<Record<SizeKey, Meta>>
}
type Target = { filename: string; url: string; variants: { key: SizeKey; filename: string; url: string }[] }

export type Kind = 'media' | 'videos' | 'documents'
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
]
const kindOf = (f: File): Kind | null =>
  IMAGE_TYPES.includes(f.type)
    ? 'media'
    : f.type.startsWith('video/') || f.type.startsWith('audio/')
      ? 'videos'
      : DOC_TYPES.includes(f.type)
        ? 'documents'
        : null
const ACCEPT: Record<Kind, string> = {
  media: 'image/jpeg,image/png,image/webp,image/avif,image/gif',
  videos: 'video/*,audio/*',
  documents: DOC_TYPES.join(','),
}
const WORDS: Record<Kind, string> = { media: 'photos', videos: 'videos and audio', documents: 'documents' }

async function putFile(url: string, body: Blob, type: string) {
  const res = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': type } })
  if (!res.ok) throw new Error(`Storage answered ${res.status}`)
}

async function post<T>(body: unknown): Promise<T> {
  const r = await fetch('/staff/upload/multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = (await r.json().catch(() => ({}))) as T & { error?: string }
  if (!r.ok) throw new Error(j.error ?? `The server answered ${r.status}`)
  return j
}

/** Sends a big file in 64 MB pieces, 4 at a time; each piece is retried on its own. */
async function putBig(filename: string, file: File, type: string, onPart: (done: number, total: number) => void) {
  const { uploadId, partSize, urls } = await post<{ uploadId: string; partSize: number; urls: string[] }>({
    action: 'start',
    filename,
    type,
    size: file.size,
  })
  const parts: { n: number; etag: string }[] = []
  let next = 0
  let done = 0
  try {
    const worker = async () => {
      for (;;) {
        const i = next++
        if (i >= urls.length) return
        const blob = file.slice(i * partSize, Math.min(file.size, (i + 1) * partSize))
        let etag: string | null = null
        let lastErr: unknown = null
        for (let attempt = 0; attempt < 4 && !etag; attempt++) {
          try {
            const r = await fetch(urls[i]!, { method: 'PUT', body: blob })
            if (!r.ok) throw new Error(`Storage answered ${r.status}`)
            etag = r.headers.get('ETag')
            if (!etag)
              throw new Error(
                'Storage did not return the piece receipt (ETag). Open "Upload / storage check" and press "Fix bucket settings".',
              )
          } catch (e) {
            lastErr = e
            if (String(e).includes('ETag')) break
            await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)))
          }
        }
        if (!etag) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
        parts.push({ n: i + 1, etag })
        done++
        onPart(done, urls.length)
      }
    }
    await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, urls.length) }, worker))
    await post({ action: 'complete', filename, uploadId, parts })
  } catch (e) {
    await post({ action: 'abort', filename, uploadId }).catch(() => undefined)
    throw e
  }
}

function encode(canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality),
  )
}

/** Cuts the web sizes of one photo in the browser. Returns nothing for photos it cannot read. */
async function makeVariants(file: File) {
  if (file.type === 'image/gif') return null // keep animation, no resized copies
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null
  }
  const out: { key: SizeKey; blob: Blob; width: number; height: number }[] = []
  for (const s of SIZES) {
    if (bmp.width < s.width) continue // never enlarge
    const w = s.width
    const h = 'height' in s ? s.height : Math.round((bmp.height * w) / bmp.width)
    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!ctx) continue
    ctx.imageSmoothingQuality = 'high'
    if ('height' in s) {
      // Cover-crop around the centre for the 1200 × 630 social image.
      const scale = Math.max(w / bmp.width, h / bmp.height)
      const sw = w / scale
      const sh = h / scale
      ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, w, h)
    } else {
      ctx.drawImage(bmp, 0, 0, w, h)
    }
    out.push({ key: s.key, blob: await encode(canvas, 'image/webp', 0.82), width: w, height: h })
  }
  const dims = { width: bmp.width, height: bmp.height }
  bmp.close()
  return { variants: out, ...dims }
}

export function FastUpload({
  disabled,
  allowed = ['media', 'videos', 'documents'],
  compact = false,
  listPath,
  onDone,
}: {
  disabled: boolean
  /** Which kinds of file this screen accepts. */
  allowed?: Kind[]
  /** In the Media / Videos / Documents lists: start at once and reload that list when done. */
  compact?: boolean
  listPath?: string
  /** Called with the new library IDs instead of reloading the list (used by the gallery editor). */
  onDone?: (ids: string[]) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  // Photos stay in the library and galleries by default; the public Media page shows videos only.
  const [showOnPage, setShowOnPage] = useState(!(allowed.length === 1 && allowed[0] === 'media'))
  const [credit, setCredit] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ added: number; failed: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [big, setBig] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const accept = (list: FileList | File[]) => {
    const all = [...list]
    const ok = all.filter((f) => {
      const k = kindOf(f)
      return k !== null && allowed.includes(k)
    })
    setFiles(ok)
    setResult(null)
    setError(null)
    const skipped = all.length - ok.length
    if (skipped) setError(`${skipped} file(s) skipped: this screen accepts ${allowed.map((k) => WORDS[k]).join(', ')} only.`)
    // In the lists there is nothing else to decide: go.
    if (compact && ok.length) void start(ok)
  }

  async function start(chosen: File[] = files) {
    const files = chosen
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)
    try {
      const tooBig = files.find((f) => kindOf(f) === 'videos' && f.size > MAX_VIDEO)
      if (tooBig) throw new Error(`${tooBig.name} is over 500 GB. Please compress it first, or add it as a YouTube/Vimeo link.`)

      // Photos get shrunk copies (one per web size); everything else goes up as it is.
      const plan = files.map((f) => ({
        name: f.name,
        type: f.type || 'application/octet-stream',
        variants:
          kindOf(f) === 'media' && f.type !== 'image/gif'
            ? SIZES.map((s) => ({ key: s.key, ext: 'webp' as const, type: 'image/webp' as const }))
            : [],
      }))
      const res = await fetch('/staff/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: plan }),
      })
      const data = (await res.json().catch(() => ({}))) as { targets?: Target[]; error?: string }
      if (!res.ok || !data.targets) throw new Error(data.error ?? `The server answered ${res.status}`)

      const items: (Item | null)[] = files.map(() => null)
      const failed: string[] = []
      let done = 0
      let next = 0
      const worker = async () => {
        for (;;) {
          const i = next++
          if (i >= files.length) return
          const file = files[i]!
          const target = data.targets![i]!
          try {
            const type = file.type || 'application/octet-stream'
            const item: Item = { filename: target.filename, mimeType: type, filesize: file.size }
            if (kindOf(file) === 'media') {
              const made = await makeVariants(file)
              if (made) {
                item.width = made.width
                item.height = made.height
                item.sizes = {}
                await Promise.all(
                  made.variants.map(async (v) => {
                    const t = target.variants.find((x) => x.key === v.key)
                    if (!t) return
                    await putFile(t.url, v.blob, 'image/webp')
                    item.sizes![v.key] = {
                      filename: t.filename,
                      width: v.width,
                      height: v.height,
                      mimeType: 'image/webp',
                      filesize: v.blob.size,
                    }
                  }),
                )
              }
            }
            if (file.size > BIG)
              await putBig(target.filename, file, type, (d, t) =>
                setBig(`${file.name}: ${Math.round((d / t) * 100)}% sent`),
              )
            else await putFile(target.url, file, type)
            items[i] = item
          } catch (e) {
            failed.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`)
          }
          done++
          setProgress(Math.round((done / files.length) * 90))
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker))

      // Record them in the library, in the order they were chosen (photos and videos separately).
      let added = 0
      const newIds: string[] = []
      for (const kind of ['media', 'videos', 'documents'] as const) {
        const idx = files.map((_, i) => i).filter((i) => kindOf(files[i]!) === kind && items[i])
        for (let c = 0; c < idx.length; c += 50) {
          const chunk = idx.slice(c, c + 50)
          const r = await fetch('/staff/upload/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind,
              showOnPage,
              credit: credit.trim() || undefined,
              items: chunk.map((i) => items[i]),
              offset: c,
              total: idx.length,
            }),
          })
          const out = (await r.json().catch(() => ({}))) as { added?: number; failed?: string[]; ids?: string[]; error?: string }
          if (!r.ok) throw new Error(out.error ?? `The server answered ${r.status}`)
          added += out.added ?? 0
          newIds.push(...(out.ids ?? []))
          failed.push(...(out.failed ?? []))
        }
      }
      setProgress(100)
      setResult({ added, failed })
      setFiles([])
      if (input.current) input.current.value = ''
      if (onDone) {
        onDone(newIds)
        return
      }
      // In a list: show the list again, newest first, so the new files are on page 1 at once.
      if (compact && listPath && failed.length === 0)
        window.location.assign(`${listPath}?sort=-createdAt&limit=25&page=1`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setBig(null)
    }
  }

  const btn = 'min-h-11 px-5 font-ui text-caption font-semibold disabled:opacity-40'

  if (compact) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (!busy && !disabled) accept(e.dataTransfer.files)
        }}
        style={{
          margin: '0 0 1rem',
          padding: '0.9rem 1rem',
          border: `2px dashed ${over ? 'currentColor' : 'rgba(128,128,128,.5)'}`,
          borderRadius: 10,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => input.current?.click()}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: 999,
            border: '1px solid currentColor',
            background: 'transparent',
            color: 'inherit',
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Uploading…' : 'Bulk upload'}
        </button>
        <span style={{ opacity: 0.8 }}>
          {busy
            ? big ?? 'Please wait — the list reloads by itself when everything is added.'
            : `Choose or drop ${allowed.map((k) => WORDS[k]).join(', ')} — as many as you like.`}
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept={allowed.map((k) => ACCEPT[k]).join(',')}
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && accept(e.target.files)}
        />
        {busy ? (
          <div style={{ flexBasis: '100%', height: 6, background: 'rgba(128,128,128,.35)', borderRadius: 3 }}>
            <div style={{ height: 6, width: `${progress}%`, background: 'currentColor', borderRadius: 3, transition: 'width .2s' }} />
          </div>
        ) : null}
        {error ? <span style={{ flexBasis: '100%', color: '#ff6b6b' }}>{error}</span> : null}
        {result?.failed.length ? (
          <span style={{ flexBasis: '100%', color: '#ff6b6b' }}>
            {result.failed.length} file(s) did not upload: {result.failed.slice(0, 3).join(' · ')}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (!busy) accept(e.dataTransfer.files)
        }}
        className={`flex min-h-40 flex-col items-center justify-center gap-3 border-2 border-dashed p-6 text-center ${over ? 'border-ink' : 'border-rule'}`}
      >
        <p className="font-ui text-caption">Drop files here, or</p>
        <button type="button" disabled={busy || disabled} onClick={() => input.current?.click()} className={`${btn} border border-ink`}>
          Choose files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={allowed.map((k) => ACCEPT[k]).join(',')}
          className="hidden"
          onChange={(e) => e.target.files && accept(e.target.files)}
        />
        {files.length ? <p className="meta">{files.length} file(s) ready</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 font-ui text-caption">
          <input type="checkbox" checked={showOnPage} onChange={(e) => setShowOnPage(e.target.checked)} />
          Show on the public Media page
        </label>
        <label className="block font-ui text-caption">
          Credit (optional)
          <input
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            maxLength={200}
            placeholder="Nordic Affairs Media"
            className="mt-1 h-11 w-full border border-rule bg-snow px-3 text-ink"
          />
        </label>
      </div>

      <button type="button" disabled={busy || disabled || !files.length} onClick={() => void start()} className={`${btn} bg-ink text-snow hover:bg-fjord-deep`}>
        {busy ? 'Uploading…' : 'Upload'}
      </button>

      {busy && big ? <p className="meta">{big}</p> : null}
      {busy ? (
        <div className="h-2 w-full bg-rule" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 bg-ink transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="border-l-2 border-alert pl-4 font-ui text-caption text-alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2 font-ui text-caption">
          <p className="font-semibold">Done — {result.added} file(s) added.</p>
          <p>
            <a className="underline" href="/admin/collections/media">Open Media</a> ·{' '}
            <a className="underline" href="/admin/collections/videos">Open Videos &amp; audio</a>
          </p>
          {result.failed.length ? (
            <details open>
              <summary className="cursor-pointer text-alert">{result.failed.length} file(s) did not upload</summary>
              <ul className="mt-2 list-disc pl-6 text-alert">
                {result.failed.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
