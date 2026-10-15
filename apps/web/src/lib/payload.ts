import 'server-only'
import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

/** One Payload client per request (React `cache`), reused across server components. */
export const getPayloadClient = cache(async () => getPayload({ config }))

/**
 * Relationship fields arrive either as an ID (not populated) or as the full document.
 * This narrows to the populated document so components never deal with bare IDs.
 */
export function isDoc<T extends { id: string }>(value: string | T | null | undefined): value is T {
  return typeof value === 'object' && value !== null && 'id' in value
}

export function docs<T extends { id: string }>(values: (string | T)[] | null | undefined): T[] {
  return (values ?? []).filter(isDoc)
}
