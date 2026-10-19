'use server'

import { requireStaff } from '@/lib/staff'
import { getPayloadClient } from '@/lib/payload'
import { listTranslatable, translateOne, TranslateError, type TranslateItem } from '@/lib/translate'

type Outcome<T> = { ok: true; data: T } | { ok: false; error: string }

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error:
    e instanceof TranslateError
      ? e.message
      : `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
})

export async function listForTranslation(): Promise<Outcome<TranslateItem[]>> {
  await requireStaff()
  try {
    return { ok: true, data: await listTranslatable(await getPayloadClient()) }
  } catch (e) {
    return fail(e)
  }
}

export async function translateItem(
  collection: TranslateItem['collection'],
  id: string,
): Promise<Outcome<string>> {
  await requireStaff()
  if (collection !== 'galleries' && collection !== 'articles')
    return { ok: false, error: 'Bad request' }
  try {
    return { ok: true, data: await translateOne(await getPayloadClient(), collection, id) }
  } catch (e) {
    return fail(e)
  }
}
