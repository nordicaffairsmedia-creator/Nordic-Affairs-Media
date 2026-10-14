import { pbkdf2, timingSafeEqual } from 'node:crypto'
import type { Payload } from 'payload'

/**
 * True when `password` is already the stored password of this account. Mirrors the hash
 * format Payload itself uses (current: PBKDF2-SHA256, 600k rounds; older: 25k rounds).
 *
 * Why this matters: Payload deletes every signed-in session of an account whenever its
 * password is written. This function runs on every server start (and on Vercel, every
 * cold start), so rewriting the same password each time signed the owner out of /admin
 * and /staff again and again.
 */
function passwordMatches(doc: { hash?: unknown; salt?: unknown }, password: string): Promise<boolean> {
  const { hash, salt } = doc
  if (typeof hash !== 'string' || typeof salt !== 'string') return Promise.resolve(false)
  const prefix = 'pbkdf2-sha256-v1:'
  const current = hash.startsWith(prefix)
  const stored = Buffer.from(current ? hash.slice(prefix.length) : hash, 'hex')
  return new Promise((resolve) => {
    pbkdf2(password, salt, current ? 600000 : 25000, current ? 32 : 512, 'sha256', (err, derived) => {
      resolve(!err && derived.length === stored.length && timingSafeEqual(derived, stored))
    })
  })
}

/**
 * The one and only Superadmin (owner) account, kept in line with Render's environment:
 *   OWNER_USERNAME  e.g. rana         (sign-in name)
 *   OWNER_PASSWORD  set in Render only — never in code
 *   OWNER_NAME      optional, shown as "Howdy, <name>" (default: the username, capitalised)
 *   OWNER_EMAIL     optional, only used if no owner exists yet
 * Runs at every start: the owner's username, name and password always match these values,
 * so the sign-in stays the same even if someone changes it in the panel.
 */
export async function ensureOwner(payload: Payload) {
  const username = process.env.OWNER_USERNAME?.trim().toLowerCase()
  const password = process.env.OWNER_PASSWORD
  if (!username || !password) return
  const name = process.env.OWNER_NAME?.trim() || username.charAt(0).toUpperCase() + username.slice(1)
  try {
    const found = await payload.find({
      collection: 'users',
      where: { roles: { in: ['superadmin'] } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    })
    const owner = found.docs[0] as
      | { id: string | number; username?: string; name?: string; hash?: unknown; salt?: unknown }
      | undefined
    if (owner) {
      // Only write what actually changed, so a normal restart never signs anyone out.
      const data: Record<string, unknown> = {}
      if (owner.username !== username) data.username = username
      if (owner.name !== name) data.name = name
      if (!(await passwordMatches(owner, password))) data.password = password
      if (Object.keys(data).length > 0) {
        await payload.update({
          collection: 'users',
          id: owner.id,
          data: data as never,
          overrideAccess: true,
        })
      }
    } else {
      await payload.create({
        collection: 'users',
        data: {
          email: process.env.OWNER_EMAIL?.trim() || `${username}@nordicaffairsmedia.com`,
          username,
          name,
          password,
          roles: ['superadmin'],
        } as never,
        overrideAccess: true,
      })
    }
    payload.logger.info(`Owner account "${username}" is ready.`)
  } catch (e) {
    payload.logger.error(`Could not set up the owner account: ${String(e)}`)
  }
}
