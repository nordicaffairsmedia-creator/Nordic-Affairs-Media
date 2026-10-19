import 'server-only'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetBucketCorsCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type CORSRule,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { allowedOrigins } from './origins'

/**
 * Health check and repair for the photo / video storage bucket (Cloudflare R2 or any S3 bucket).
 *
 * Why this exists: on Vercel the admin sends photos and videos straight from the browser to the
 * bucket (Vercel refuses request bodies over 4.5 MB). Browsers only allow that when the bucket has
 * a CORS rule naming this website's address. Without it every upload ends with "Failed to fetch".
 * This module reads the bucket's CORS rules, can write the right ones, and issues a test upload.
 */

export type Step = { id: string; label: string; ok: boolean; detail?: string; hint?: string }

export function storageEnabled() {
  return Boolean(process.env.S3_BUCKET)
}

export function directUploads() {
  return storageEnabled() && (Boolean(process.env.VERCEL) || process.env.S3_CLIENT_UPLOADS === 'true')
}

function client() {
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  })
}

const bucket = () => process.env.S3_BUCKET ?? ''

/** True when a file with this name is in the bucket. Any error other than "not found" is thrown. */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return true
  } catch (e) {
    const x = e as { name?: string; $metadata?: { httpStatusCode?: number } }
    if (x.name === 'NotFound' || x.name === 'NoSuchKey' || x.$metadata?.httpStatusCode === 404)
      return false
    throw e
  }
}

const errText = (e: unknown) => {
  const x = e as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return `${x.name ?? 'Error'}${x.$metadata?.httpStatusCode ? ` (HTTP ${x.$metadata.httpStatusCode})` : ''}: ${x.message ?? String(e)}`
}

/** Every web address that should be allowed to upload: this site's known addresses + the one in use now. */
export function corsOrigins(current: string) {
  const set = new Set<string>(allowedOrigins().filter((o) => /^https?:\/\//.test(o)))
  if (current) set.add(current)
  return [...set]
}

/** Origins already allowed by the bucket's rules, so a fix on one site never removes another site's access. */
async function existingOrigins(): Promise<string[]> {
  try {
    const out = await client().send(new GetBucketCorsCommand({ Bucket: bucket() }))
    return (out.CORSRules ?? []).flatMap((r) => r.AllowedOrigins ?? []).filter((o) => o && o !== '*')
  } catch {
    return []
  }
}

export function corsRules(origins: string[]): CORSRule[] {
  return [
    {
      AllowedOrigins: origins,
      AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    },
  ]
}

/** The same rule as JSON for pasting into the Cloudflare R2 dashboard (Bucket → Settings → CORS Policy). */
export function corsJson(origins: string[]) {
  return JSON.stringify(
    [
      {
        AllowedOrigins: origins,
        AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      },
    ],
    null,
    2,
  )
}

const matches = (pattern: string, origin: string) => {
  if (pattern === '*') return true
  if (!pattern.includes('*')) return pattern.toLowerCase() === origin.toLowerCase()
  const [a = '', b = ''] = pattern.split('*')
  return origin.toLowerCase().startsWith(a.toLowerCase()) && origin.toLowerCase().endsWith(b.toLowerCase())
}

export async function checkStorage(current: string): Promise<{
  steps: Step[]
  origins: string[]
  json: string
  allOk: boolean
}> {
  const origins = corsOrigins(current)
  const steps: Step[] = []
  const push = (s: Step) => steps.push(s)
  let jsonOrigins = origins
  const done = () => ({ steps, origins, json: corsJson(jsonOrigins), allOk: steps.every((s) => s.ok) })

  if (!storageEnabled()) {
    push({
      id: 'config',
      label: 'Storage is set up (S3_BUCKET)',
      ok: false,
      detail: 'S3_BUCKET is empty on this website, so files would be saved on the server itself.',
      hint: 'On Vercel and Render the server disk is temporary or read-only, so uploads fail or disappear. Add the S3_* settings (Cloudflare R2) under Environment Variables, then redeploy. They must be on every website that uses the admin.',
    })
    return done()
  }
  push({
    id: 'config',
    label: 'Storage is set up',
    ok: true,
    detail: `Bucket "${bucket()}"${process.env.S3_ENDPOINT ? ` at ${new URL(process.env.S3_ENDPOINT).host}` : ''}. Uploads go ${directUploads() ? 'straight from the browser to the bucket' : 'through the website server'}.`,
  })

  const s3 = client()
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket() }))
    push({ id: 'bucket', label: 'Website can reach the bucket', ok: true })
  } catch (e) {
    push({
      id: 'bucket',
      label: 'Website can reach the bucket',
      ok: false,
      detail: errText(e),
      hint: 'Check S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY on this website (Vercel → Settings → Environment Variables). They must be the same values as on the website that works. Redeploy after changing them.',
    })
    return done()
  }

  const key = `_check/${Date.now()}.txt`
  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: 'ok', ContentType: 'text/plain' }))
    await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
    push({ id: 'write', label: 'Website can save and delete files in the bucket', ok: true })
  } catch (e) {
    push({
      id: 'write',
      label: 'Website can save and delete files in the bucket',
      ok: false,
      detail: errText(e),
      hint: 'The access key is read-only. In Cloudflare: R2 → Manage API tokens → create a token with "Object Read & Write" for this bucket and put its keys in S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY.',
    })
  }

  if (directUploads()) {
    try {
      const out = await s3.send(new GetBucketCorsCommand({ Bucket: bucket() }))
      const rules = out.CORSRules ?? []
      jsonOrigins = [...new Set([...origins, ...rules.flatMap((r) => r.AllowedOrigins ?? []).filter((o) => o && o !== '*')])]
      const missing = origins.filter(
        (o) =>
          !rules.some(
            (r) =>
              (r.AllowedOrigins ?? []).some((p) => matches(p, o)) &&
              (r.AllowedMethods ?? []).map((m) => m.toUpperCase()).includes('PUT'),
          ),
      )
      push({
        id: 'cors',
        label: 'Bucket allows uploads from this website (CORS)',
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? `Allowed: ${origins.join(', ')}`
            : `Not allowed yet: ${missing.join(', ')}`,
        hint:
          missing.length === 0
            ? undefined
            : 'This is what causes "Failed to fetch" when saving a photo or video. Press "Fix bucket settings" below.',
      })
    } catch (e) {
      const name = (e as { name?: string }).name
      push({
        id: 'cors',
        label: 'Bucket allows uploads from this website (CORS)',
        ok: false,
        detail:
          name === 'NoSuchCORSConfiguration'
            ? 'The bucket has no CORS rule at all.'
            : errText(e),
        hint: 'This is what causes "Failed to fetch" when saving a photo or video. Press "Fix bucket settings" below.',
      })
    }
  } else {
    push({
      id: 'cors',
      label: 'Browser uploads (CORS)',
      ok: true,
      detail: 'Not needed: files pass through the website server here.',
    })
  }
  return done()
}

/** Writes the CORS rule that lets this site's browsers upload to the bucket. */
export async function fixCors(current: string): Promise<{ ok: boolean; message: string; json: string }> {
  // Keep addresses that are already allowed (e.g. the other website sharing this bucket).
  const origins = [...new Set([...corsOrigins(current), ...(storageEnabled() ? await existingOrigins() : [])])]
  const json = corsJson(origins)
  if (!storageEnabled()) return { ok: false, message: 'Storage is not set up (S3_BUCKET is empty).', json }
  try {
    await client().send(
      new PutBucketCorsCommand({ Bucket: bucket(), CORSConfiguration: { CORSRules: corsRules(origins) } }),
    )
    return { ok: true, message: `Done. The bucket now accepts uploads from: ${origins.join(', ')}`, json }
  } catch (e) {
    return {
      ok: false,
      message: `The bucket did not accept the change from here (${errText(e)}). The access key probably may not change bucket settings. Paste the rule below into Cloudflare yourself (steps shown below).`,
      json,
    }
  }
}

/** A short-lived upload address, so the browser can try a real upload to the bucket. */
export async function testUploadUrl(): Promise<{ url: string; key: string }> {
  const key = `_check/browser-${Date.now()}.txt`
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: 'text/plain' }),
    { expiresIn: 300 },
  )
  return { url, key }
}

export async function removeTestObject(key: string) {
  if (!key.startsWith('_check/')) return
  await client()
    .send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
    .catch(() => undefined)
}

/** File names that are safe in a web address and in the bucket. */
export function safeFilename(name: string) {
  const clean = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+/, '')
  return (clean || `file-${Date.now()}`).slice(-120)
}

/**
 * Gives every file in a batch a name that is not yet in the bucket (adds -1, -2 ... when it is),
 * and a short-lived address the browser can upload it to directly.
 */
export async function prepareUploadTargets(
  files: { name: string; type: string; variants: { key: string; ext: string; type: string }[] }[],
) {
  const taken = new Set<string>()
  const free = async (filename: string) => {
    const dot = filename.lastIndexOf('.')
    const base = dot > 0 ? filename.slice(0, dot) : filename
    const ext = dot > 0 ? filename.slice(dot) : ''
    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? filename : `${base}-${n}${ext}`
      if (taken.has(candidate)) continue
      if (await objectExists(candidate)) continue
      taken.add(candidate)
      return candidate
    }
    throw new Error(`Could not find a free name for ${filename}`)
  }
  const put = (key: string, type: string) =>
    getSignedUrl(client(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: type }), {
      expiresIn: 3600,
    })
  // Names are claimed one after another (so two files with the same name in one batch differ);
  // the web addresses are then made all at once.
  const names: string[] = []
  for (const f of files) names.push(await free(safeFilename(f.name)))
  return Promise.all(
    files.map(async (f, i) => {
      const filename = names[i]!
      const dot = filename.lastIndexOf('.')
      const base = dot > 0 ? filename.slice(0, dot) : filename
      const variants = await Promise.all(
        f.variants.map(async (v) => {
          const vName = `${base}-${v.key}.${v.ext}`
          taken.add(vName)
          return { key: v.key, filename: vName, url: await put(vName, v.type) }
        }),
      )
      return { filename, url: await put(filename, f.type), variants }
    }),
  )
}

/*
 * Big files (long videos, master edits of many GB) are sent in pieces ("multipart upload"):
 * one piece of 64 MB at a time, several in parallel, each retried on its own if the connection
 * drops. A single upload can only be 5 GB; in pieces a file can be up to about 600 GB.
 */
export const PART_SIZE = 64 * 1024 * 1024
export const MAX_PARTS = 10_000

/** Starts a multipart upload for a name prepareUploadTargets gave out, and signs every piece. */
export async function startMultipart(key: string, type: string, size: number) {
  const parts = Math.max(1, Math.ceil(size / PART_SIZE))
  if (parts > MAX_PARTS) throw new Error('This file is too large to upload.')
  const s3 = client()
  const out = await s3.send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: type }))
  const uploadId = out.UploadId
  if (!uploadId) throw new Error('Storage did not start the upload.')
  const urls = await Promise.all(
    Array.from({ length: parts }, (_, i) =>
      getSignedUrl(s3, new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: i + 1 }), {
        expiresIn: 60 * 60 * 24, // a 50 GB file on a slow line may take many hours
      }),
    ),
  )
  return { uploadId, partSize: PART_SIZE, urls }
}

export async function completeMultipart(key: string, uploadId: string, parts: { n: number; etag: string }[]) {
  await client().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts].sort((a, b) => a.n - b.n).map((p) => ({ PartNumber: p.n, ETag: p.etag })),
      },
    }),
  )
}

export async function abortMultipart(key: string, uploadId: string) {
  await client()
    .send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }))
    .catch(() => undefined)
}
