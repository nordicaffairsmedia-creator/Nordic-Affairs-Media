import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
} from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'
import { locales } from '@/i18n/config'

/**
 * Pages are statically cached and refreshed every few minutes (ISR). When an editor
 * publishes, we purge the cache immediately so changes appear within seconds.
 * The site is small enough that purging the whole layout is simpler and safer than
 * tracking every page a document appears on.
 */
function purge(): void {
  try {
    revalidatePath('/', 'layout')
    // Cached database reads (event lists, event pages, header/footer) are dropped at the same moment.
    revalidateTag('content')
  } catch {
    // Outside a Next.js request (e.g. `payload run` seed scripts) there is no cache to purge.
  }
}

export const revalidateOnChange: CollectionAfterChangeHook = ({ doc }) => {
  purge()
  return doc
}

export const revalidateOnDelete: CollectionAfterDeleteHook = ({ doc }) => {
  purge()
  return doc
}

export const revalidateGlobal: GlobalAfterChangeHook = ({ doc }) => {
  purge()
  return doc
}

/**
 * Photos and videos: only the public Media page lists them by itself (every other page picks
 * its pictures through galleries, articles or settings, which purge the whole site when saved).
 * Purging the whole site for every uploaded photo made every page slow to open again after each
 * upload, and a bulk upload did it dozens of times. Pass `context: { skipRevalidate: true }` to a
 * save to skip even this (used by bulk jobs, which purge once at the end).
 */
export function purgeMediaPages(): void {
  try {
    for (const l of locales) revalidatePath(`/${l}/media`)
  } catch {
    // Outside a Next.js request there is no cache to purge.
  }
}

export const revalidateMediaChange: CollectionAfterChangeHook = ({ doc, req }) => {
  if (!(req.context as { skipRevalidate?: boolean } | undefined)?.skipRevalidate) purgeMediaPages()
  return doc
}

export const revalidateMediaDelete: CollectionAfterDeleteHook = ({ doc }) => {
  purgeMediaPages()
  return doc
}
