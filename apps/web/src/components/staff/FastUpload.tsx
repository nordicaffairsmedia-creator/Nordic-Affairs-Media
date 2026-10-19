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
const MAX_VIDEO = 200 * 1024 * 1024
const CONCURRENCY = 8
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

const kindOf = (f: File): 'media' | 'videos' | null =>
  IMAGE_TYPES.includes(f.type) ? 'media' : f.type.startsWith('video/') || f.type.startsWith('audio/') ? 'videos' : null

async function putFile(url: string, body: Blob, type: string) {
  const res = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': type } })
  if (!res.ok) throw new Error(`Storage answered ${res.status}`)
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

export function FastUpload({ disabled }: { disabled: boolean }) {
  const [files, setFiles] = useState<File[]>([])
  const [showOnPage, setShowOnPage] = useState(true)
  const [credit, setCredit] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ added: number; failed: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const accept = (list: FileList | File[]) => {
    const all = [...list]
    setFiles(all.filter((f) => kindOf(f)))
    setResult(null)
    setError(null)
    const skipped = all.length - all.filter((f) => kindOf(f)).length
    if (skipped) setError(`${skipped} file(s) skipped: only photos (JPG, PNG, WebP, AVIF, GIF), videos and audio can be added here.`)
  }

  async function start() {
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(0)
    try {
      const tooBig = files.find((f) => kindOf(f) === 'videos' && f.size > MAX_VIDEO)
      if (tooBig) throw new Error(`${tooBig.name} is over 200 MB. Please compress it first.`)

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
            await putFile(target.url, file, type)
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
      for (const kind of ['media', 'videos'] as const) {
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
          const out = (await r.json().catch(() => ({}))) as { added?: number; failed?: string[]; error?: string }
          if (!r.ok) throw new Error(out.error ?? `The server answered ${r.status}`)
          added += out.added ?? 0
          failed.push(...(out.failed ?? []))
        }
      }
      setProgress(100)
      setResult({ added, failed })
      setFiles([])
      if (input.current) input.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const btn = 'min-h-11 px-5 font-ui text-caption font-semibold disabled:opacity-40'
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
        <p className="font-ui text-caption">Drop photos and videos here, or</p>
        <button type="button" disabled={busy || disabled} onClick={() => input.current?.click()} className={`${btn} border border-ink`}>
          Choose files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/*,audio/*"
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
