import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hasRole } from '@/access/roles'
import { getStaffUser } from '@/lib/staff'
import { abortMultipart, completeMultipart, startMultipart, storageEnabled } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const key = z.string().regex(/^[\w.-]{1,160}$/)
const body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    filename: key,
    type: z.string().min(3).max(100),
    size: z.number().int().positive(),
  }),
  z.object({
    action: z.literal('complete'),
    filename: key,
    uploadId: z.string().min(1).max(1024),
    parts: z.array(z.object({ n: z.number().int().min(1).max(10_000), etag: z.string().min(1).max(200) })).min(1).max(10_000),
  }),
  z.object({ action: z.literal('abort'), filename: key, uploadId: z.string().min(1).max(1024) }),
])

/** Big files in pieces: start (signed address per piece), complete, or abort. Staff only. */
export async function POST(req: Request) {
  const user = await getStaffUser()
  if (!user || !hasRole(user, 'admin', 'editor'))
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (!storageEnabled())
    return NextResponse.json({ error: 'File storage is not set up (S3_BUCKET is empty).' }, { status: 503 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const b = parsed.data
  try {
    if (b.action === 'start') return NextResponse.json(await startMultipart(b.filename, b.type, b.size))
    if (b.action === 'complete') {
      await completeMultipart(b.filename, b.uploadId, b.parts)
      return NextResponse.json({ ok: true })
    }
    await abortMultipart(b.filename, b.uploadId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
