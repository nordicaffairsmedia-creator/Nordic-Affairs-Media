'use server'

import { requireStaff } from '@/lib/staff'
import { getPayloadClient } from '@/lib/payload'
import { logAudit } from '@/lib/audit'
import {
  ImportError,
  importBasics,
  importItem,
  loadPlan,
  repairFiles,
  storageReady,
  type PlanItem,
  type StepResult,
} from '@/lib/wordpress/importer'

type Outcome<T> = { ok: true; data: T } | { ok: false; error: string }

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error:
    e instanceof ImportError
      ? e.message
      : `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
})

/** SuperAdmin only: reads the old site and lists what will be moved. */
export async function planImport(): Promise<Outcome<PlanItem[]>> {
  await requireStaff()
  const storage = storageReady()
  if (!storage.ok) return { ok: false, error: storage.message ?? 'Storage not ready' }
  try {
    return { ok: true, data: await loadPlan() }
  } catch (e) {
    return fail(e)
  }
}

export async function importBasicsStep(): Promise<Outcome<StepResult>> {
  const user = await requireStaff()
  try {
    const payload = await getPayloadClient()
    const data = await importBasics(payload)
    await logAudit(payload, {
      user: typeof user.email === 'string' ? user.email : String(user.id),
      action: 'wordpress-import',
      target: 'settings',
      targetId: 'basics',
      summary: 'Imported contact details, About page, press logos and redirects from the old site',
    })
    return { ok: true, data }
  } catch (e) {
    return fail(e)
  }
}

/** Re-copies photos / videos whose file is missing from the bucket (see repairFiles). */
export async function repairFilesStep(
  collection: 'media' | 'videos',
  offset: number,
): Promise<Outcome<StepResult>> {
  await requireStaff()
  if ((collection !== 'media' && collection !== 'videos') || !Number.isInteger(offset) || offset < 0)
    return { ok: false, error: 'Bad request' }
  try {
    const payload = await getPayloadClient()
    return { ok: true, data: await repairFiles(payload, collection, offset) }
  } catch (e) {
    return fail(e)
  }
}

export async function importItemStep(
  key: string,
  offset: number,
  duplicateOf: string | null,
): Promise<Outcome<StepResult>> {
  await requireStaff()
  // "hero:home" = the old home-page slideshow (and footer background).
  if (!/^((page|post):\d+|hero:home)$/.test(key) || !Number.isInteger(offset) || offset < 0)
    return { ok: false, error: 'Bad request' }
  try {
    const payload = await getPayloadClient()
    return { ok: true, data: await importItem(payload, key, offset, duplicateOf) }
  } catch (e) {
    return fail(e)
  }
}
