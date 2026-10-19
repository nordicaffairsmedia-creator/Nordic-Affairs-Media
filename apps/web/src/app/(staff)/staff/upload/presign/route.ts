import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hasRole } from '@/access/roles'
import { getStaffUser } from '@/lib/staff'
import { prepareUploadTargets, storageEnabled } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const body = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(300),
        type: z.string().min(3).max(100),
        variants: z
          .array(
            z.object({
              key: z.enum(['thumb', 'card', 'feature', 'og']),
              ext: z.enum(['webp', 'jpg']),
              type: z.enum(['image/webp', 'image/jpeg']),
            }),
          )
          .max(4),
      }),
    )
    .min(1)
    .max(200),
})

/** Gives the browser upload addresses for a batch of files (staff only). */
export async function POST(req: Request) {
  const user = await getStaffUser()
  if (!user || !hasRole(user, 'admin', 'editor'))
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (!storageEnabled())
    return NextResponse.json({ error: 'File storage is not set up (S3_BUCKET is empty).' }, { status: 503 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  try {
    return NextResponse.json({ targets: await prepareUploadTargets(parsed.data.files) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
