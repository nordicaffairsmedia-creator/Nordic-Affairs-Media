import type { CollectionBeforeChangeHook } from 'payload'
import { generateKeyBetween } from 'payload/shared'

/**
 * Media, Videos & audio and Documents can be rearranged by dragging like every other list. A new file
 * from "Create New" goes to the top of the manual order (as the newest-first lists always showed it),
 * instead of the bottom where Payload would otherwise put it.
 */
export const placeOnTop: CollectionBeforeChangeHook = async ({ data, operation, req, collection }) => {
  const d = data as Record<string, unknown>
  if (operation !== 'create' || d._order) return data
  const first = await req.payload.find({
    collection: collection.slug as 'media',
    depth: 0,
    limit: 1,
    pagination: false,
    sort: '_order',
    select: { _order: true } as never,
    where: { _order: { exists: true } } as never,
    req,
  })
  const firstKey = (first.docs[0] as unknown as { _order?: string } | undefined)?._order ?? null
  d._order = generateKeyBetween(null, firstKey)
  return data
}
