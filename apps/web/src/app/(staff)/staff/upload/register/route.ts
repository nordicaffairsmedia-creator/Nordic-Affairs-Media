import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hasRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { purgeMediaPages } from '@/lib/revalidate'
import { getStaffUser } from '@/lib/staff'

export const dynamic = 'force-dynamic'

const name = z.string().regex(/^[\w.-]{1,160}$/)
const size = z.object({
  filename: name,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mimeType: z.string().max(100),
  filesize: z.number().int().nonnegative(),
})
const body = z.object({
  kind: z.enum(['media', 'videos', 'documents']),
  showOnPage: z.boolean(),
  credit: z.string().max(200).optional(),
  items: z
    .array(
      z.object({
        filename: name,
        mimeType: z.string().max(100),
        filesize: z.number().int().nonnegative().max(200 * 1024 * 1024),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        sizes: z.partialRecord(z.enum(['thumb', 'card', 'feature', 'og']), size).optional(),
      }),
    )
    .min(1)
    .max(100),
  // Position of the first item of this chunk within the whole selection, and the selection size.
  offset: z.number().int().nonnegative(),
  total: z.number().int().positive(),
})

/**
 * Records files that the browser has already sent to storage. One request adds a whole chunk,
 * without reading the files again or resizing anything on the server. Newest-first lists show
 * the files in the order they were chosen, starting on page 1.
 */
export async function POST(req: Request) {
  const user = await getStaffUser()
  if (!user || !hasRole(user, 'admin', 'editor'))
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(
      { error: `Bad request: ${parsed.error.issues.slice(0, 2).map((i) => i.path.join('.') + ' ' + i.message).join('; ')}` },
      { status: 400 },
    )
  const { kind, showOnPage, credit, items, offset, total } = parsed.data

  const payload = await getPayloadClient()
  const base = Date.now()
  let added = 0
  const failed: string[] = []
  // The first chosen file gets the newest time, so it is first in a newest-first list.
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!
    const at = new Date(base + (total - 1 - (offset + i)))
    try {
      await payload.db.create({
        collection: kind,
        data:
          kind === 'media'
            ? {
                ...it,
                credit: credit || 'Nordic Affairs Media',
                showOnMediaPage: showOnPage,
                isPlaceholder: false,
                createdAt: at.toISOString(),
                updatedAt: at.toISOString(),
              }
            : kind === 'documents'
              ? {
                  filename: it.filename,
                  mimeType: it.mimeType,
                  filesize: it.filesize,
                  title: it.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
                  showOnWebsite: showOnPage,
                  allowDownload: true,
                  createdAt: at.toISOString(),
                  updatedAt: at.toISOString(),
                }
              : {
                filename: it.filename,
                mimeType: it.mimeType,
                filesize: it.filesize,
                title: { en: it.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') },
                format: 'short',
                showOnWebsite: showOnPage,
                credit: credit || 'Nordic Affairs Media',
                createdAt: at.toISOString(),
                updatedAt: at.toISOString(),
              },
      })
      added++
    } catch (e) {
      failed.push(`${it.filename}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  purgeMediaPages()
  return NextResponse.json({ added, failed })
}
