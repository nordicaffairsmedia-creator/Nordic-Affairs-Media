import { cache } from 'react'
import { getPayloadClient } from '@/lib/payload'
import { OLD_UPLOADS } from './heroSlides'

/**
 * Address of a picture from the old website: our own imported copy when the import has
 * brought it over, otherwise straight from nordicaffairsmedia.com.
 */
export const legacyAssetUrl = cache(async (path: string): Promise<string> => {
  const old = OLD_UPLOADS + path
  try {
    const payload = await getPayloadClient()
    const found = await payload.find({
      collection: 'media',
      where: { sourceUrl: { equals: old } },
      limit: 1,
      depth: 0,
      pagination: false,
    })
    const url = (found.docs[0] as { url?: string | null } | undefined)?.url
    return url || old
  } catch {
    return old
  }
})
