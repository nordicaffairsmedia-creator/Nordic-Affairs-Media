import type { Endpoint, PayloadRequest } from 'payload'
import { generateKeyBetween, generateNKeysBetween } from 'payload/shared'
import { hasRole } from '@/access/roles'

/**
 * Drag-and-drop ordering for every list. It replaces Payload's own "/reorder" step, which re-saved each
 * moved record through all its hooks and validation (slow, and it failed with "Failed to reorder" on
 * old records, on lists with many rows, and when two rows had the same position).
 * This one only writes the new position straight to the database, repairs positions by itself when
 * they are missing or duplicated, and so never asks to "refresh and try again".
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Row = { id: string | number; _order?: string | null }
type Req = PayloadRequest

async function setKey(req: Req, slug: string, id: string | number, key: string) {
  await req.payload.db.updateOne({
    collection: slug as never,
    id,
    data: { _order: key },
    returning: false,
  })
}

/** Gives every record a unique position: missing ones first (newest first), then those that already had one. */
async function renumber(req: Req, slug: string) {
  const r = await req.payload.find({
    collection: slug as never,
    depth: 0,
    limit: 0,
    pagination: false,
    sort: ['_order', '-createdAt'] as never,
    select: { _order: true } as never,
    overrideAccess: true,
  })
  const rows = r.docs as unknown as Row[]
  const unkeyed = rows.filter((x) => !x._order)
  const keyed = rows.filter((x) => x._order)
  const ordered = [...unkeyed, ...keyed]
  const keys = generateNKeysBetween(null, null, ordered.length)
  for (let i = 0; i < ordered.length; i += 25) {
    await Promise.all(ordered.slice(i, i + 25).map((row, j) => setKey(req, slug, row.id, keys[i + j]!)))
  }
}

async function keyOf(req: Req, slug: string, id: string | number) {
  const d = (await req.payload.findByID({
    collection: slug as never,
    id,
    depth: 0,
    select: { _order: true } as never,
    overrideAccess: true,
  })) as unknown as Row
  return d?._order ?? null
}

async function neighbour(req: Req, slug: string, key: string, side: 'greater' | 'less') {
  const r = await req.payload.find({
    collection: slug as never,
    depth: 0,
    limit: 1,
    pagination: false,
    select: { _order: true } as never,
    sort: (side === 'greater' ? '_order' : '-_order') as never,
    where: { _order: { [side === 'greater' ? 'greater_than' : 'less_than']: key } } as never,
    overrideAccess: true,
  })
  return ((r.docs[0] as unknown as Row | undefined)?._order ?? null) as string | null
}

async function moveOnce(
  req: Req,
  slug: string,
  docsToMove: (string | number)[],
  side: 'greater' | 'less',
  targetId: string | number,
) {
  const targetKey = await keyOf(req, slug, targetId)
  if (!targetKey) throw new Error('missing position')
  const adjacent = await neighbour(req, slug, targetKey, side)
  const keys =
    side === 'greater'
      ? generateNKeysBetween(targetKey, adjacent, docsToMove.length)
      : generateNKeysBetween(adjacent, targetKey, docsToMove.length)
  for (let i = 0; i < docsToMove.length; i++) await setKey(req, slug, docsToMove[i]!, keys[i]!)
  return keys
}

export const reorderEndpoint: Endpoint = {
  path: '/reorder',
  method: 'post',
  handler: async (req) => {
    if (!hasRole(req.user, 'admin', 'editor')) return json({ error: 'Please sign in again.' }, 401)
    const body = (await req.json?.().catch(() => null)) as {
      collectionSlug?: string
      docsToMove?: (string | number)[]
      newKeyWillBe?: string
      orderableFieldName?: string
      target?: { id?: string | number; key?: string }
    } | null
    const slug = body?.collectionSlug
    const docs = body?.docsToMove
    const side = body?.newKeyWillBe
    const targetId = body?.target?.id
    if (!slug || !Array.isArray(docs) || docs.length === 0 || (side !== 'greater' && side !== 'less') || targetId === undefined)
      return json({ error: 'Bad request' }, 400)
    const cfg = req.payload.config.collections.find((c) => c.slug === slug)
    if (!cfg?.orderable || body?.orderableFieldName !== '_order') return json({ error: `${slug} cannot be rearranged` }, 400)

    try {
      // A record without a position (older files): give everything a position first, then move.
      if (!body?.target?.key) await renumber(req, slug)
      let keys: string[]
      try {
        keys = await moveOnce(req, slug, docs, side, targetId)
      } catch {
        // Two records with the same position (or a gap): repair all positions once and try again.
        await renumber(req, slug)
        keys = await moveOnce(req, slug, docs, side, targetId)
      }
      return json({ orderValues: keys, success: true })
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500)
    }
  },
}
