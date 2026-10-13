import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
} from 'payload'
import { revalidatePath } from 'next/cache'

/**
 * Pages are statically cached and refreshed every few minutes (ISR). When an editor
 * publishes, we purge the cache immediately so changes appear within seconds.
 * The site is small enough that purging the whole layout is simpler and safer than
 * tracking every page a document appears on.
 */
function purge(): void {
  try {
    revalidatePath('/', 'layout')
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
