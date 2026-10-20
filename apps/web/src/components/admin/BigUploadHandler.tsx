'use client'

import { useConfig, useUploadHandlers } from '@payloadcms/ui'
import { useEffect } from 'react'

/**
 * "Create New" in Videos & audio, Documents and Media: no size limit.
 * Small files go as one piece (as Payload does). Files over 100 MB go to Cloudflare in pieces, 12 at a
 * time, to the exact storage name Payload approved, so they can be any size up to Cloudflare's 5 TB.
 */
const BIG = 100 * 1024 * 1024
const PART_CONCURRENCY = 12
const SLUGS = ['videos', 'documents', 'media'] as const

const NO_STORAGE =
  'Cloudflare storage exceeded. Please add more GB: in Cloudflare open R2 > Billing and add a payment method or a bigger plan, then upload again.'

function explain(e: unknown): Error {
  const m = e instanceof Error ? e.message : String(e)
  return new Error(
    /\b(402|403|507)\b|quota|exceed|insufficient|billing|payment|no space|storage limit|StorageLimit|AccessDenied/i.test(m) &&
      !/Exceeded file size limit/i.test(m)
      ? `${NO_STORAGE} (Details: ${m})`
      : m,
  )
}

async function post<T>(body: unknown): Promise<T> {
  const r = await fetch('/staff/upload/multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const j = (await r.json().catch(() => ({}))) as T & { error?: string }
  if (!r.ok) throw new Error(j.error ?? `The server answered ${r.status}`)
  return j
}

async function putPieces(signedUrl: string, file: File, type: string) {
  const { key, uploadId, partSize, urls } = await post<{ key: string; uploadId: string; partSize: number; urls: string[] }>({
    action: 'start',
    signedUrl,
    type,
    size: file.size,
  })
  const parts: { n: number; etag: string }[] = []
  let next = 0
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
            if (!etag) throw new Error('Storage did not return the piece receipt (ETag). Press "Fix bucket settings" in Upload / storage check.')
          } catch (e) {
            lastErr = e
            if (String(e).includes('ETag')) break
            await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)))
          }
        }
        if (!etag) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
        parts.push({ n: i + 1, etag })
      }
    }
    await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, urls.length) }, worker))
    await post({ action: 'complete', filename: key, uploadId, parts })
  } catch (e) {
    await post({ action: 'abort', filename: key, uploadId }).catch(() => undefined)
    throw e
  }
}

export function BigUploadHandler({ children }: { children?: React.ReactNode }) {
  const { setUploadHandler } = useUploadHandlers()
  const {
    config: {
      routes: { api },
      serverURL,
    },
  } = useConfig()

  useEffect(() => {
    const register = () => {
      for (const collectionSlug of SLUGS) {
        setUploadHandler({
          collectionSlug,
          handler: async ({ docPrefix, file, updateFilename }) => {
            try {
              const res = await fetch(`${serverURL || ''}${api}/storage-s3-generate-signed-url`, {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({
                  collectionSlug,
                  docPrefix,
                  filename: file.name,
                  filesize: file.size,
                  mimeType: file.type,
                }),
              })
              if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { errors?: { message: string }[] }
                throw new Error(j.errors?.map((x) => x.message).join(', ') || `The server answered ${res.status}`)
              }
              const { clientUploadContext, filename, headers, url } = (await res.json()) as {
                clientUploadContext: { prefix: string; signedReceipt: string }
                filename?: string
                headers?: Record<string, string>
                url: string
              }
              if (filename && filename !== file.name) updateFilename(filename)
              const type = file.type || 'application/octet-stream'
              if (file.size > BIG) await putPieces(url, file, type)
              else {
                const up = await fetch(url, { method: 'PUT', body: file, headers })
                if (!up.ok) throw new Error(`Storage answered ${up.status}`)
              }
              return { prefix: clientUploadContext.prefix, signedReceipt: clientUploadContext.signedReceipt }
            } catch (e) {
              throw explain(e)
            }
          },
        })
      }
    }
    register()
    // Payload's own handler registers at about the same moment; register again so this one is the last.
    const t = setTimeout(register, 800)
    return () => clearTimeout(t)
  }, [setUploadHandler, api, serverURL])

  return <>{children}</>
}
