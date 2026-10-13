import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  Payload,
  PayloadRequest,
} from 'payload'

/**
 * Audit log (PRD S-11): who changed what and when. Written with full access so it
 * works for every role, but only the owner can read it and nobody can edit it.
 * A failure to log never blocks the change itself.
 */
function who(user: PayloadRequest['user']): string {
  if (!user) return 'system'
  return 'email' in user && typeof user.email === 'string' ? user.email : String(user.id)
}

export async function logAudit(
  payload: Payload,
  entry: { user: string; action: string; target: string; targetId?: string; summary: string },
) {
  try {
    await payload.create({ collection: 'audit-log', data: entry, overrideAccess: true })
  } catch (e) {
    payload.logger.warn(`audit log failed: ${String(e)}`)
  }
}

function titleOf(doc: Record<string, unknown>): string {
  for (const k of ['title', 'name', 'code', 'email', 'slug']) {
    const v = doc[k]
    if (typeof v === 'string' && v) return v
  }
  return String(doc.id ?? '')
}

export const auditChange: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
  collection,
}) => {
  // Skip the log's own writes and changes made by scripts (no user).
  if (collection.slug !== 'audit-log' && req.user) {
    await logAudit(req.payload, {
      user: who(req.user),
      action: operation === 'create' ? 'created' : 'updated',
      target: collection.slug,
      targetId: String(doc.id),
      summary: `${operation === 'create' ? 'Created' : 'Updated'} ${collection.slug}: ${titleOf(doc)}`,
    })
  }
  return doc
}

export const auditDelete: CollectionAfterDeleteHook = async ({ doc, req, collection }) => {
  if (req.user) {
    await logAudit(req.payload, {
      user: who(req.user),
      action: 'deleted',
      target: collection.slug,
      targetId: String(doc.id),
      summary: `Deleted ${collection.slug}: ${titleOf(doc)}`,
    })
  }
  return doc
}

export const auditGlobal: GlobalAfterChangeHook = async ({ doc, req, global }) => {
  if (req.user) {
    await logAudit(req.payload, {
      user: who(req.user),
      action: 'updated',
      target: global.slug,
      summary: `Updated settings: ${global.slug}`,
    })
  }
  return doc
}
