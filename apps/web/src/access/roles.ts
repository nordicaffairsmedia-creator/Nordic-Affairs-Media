import type { Access, FieldAccess, PayloadRequest } from 'payload'

/**
 * Platform roles (PRD section 4). A user can hold several roles.
 * - superadmin: business owner, full control incl. platform settings
 * - admin:      organizer — events, tickets, attendees, refunds
 * - editor:     editorial staff — articles, publications, authors
 * - gate:       gate staff — check-in scanner only (no CMS access)
 */
export const roles = ['superadmin', 'admin', 'editor', 'gate'] as const
export type Role = (typeof roles)[number]

type MaybeUser = PayloadRequest['user'] | { roles?: unknown } | null | undefined

function userRoles(user: MaybeUser): readonly string[] {
  if (!user || typeof user !== 'object' || !('roles' in user) || !Array.isArray(user.roles))
    return []
  return user.roles as string[]
}

/** True if the user holds any of the roles (SuperAdmin always passes). No roles given = SuperAdmin only. */
export function hasRole(user: MaybeUser, ...allowed: Role[]): boolean {
  const held = userRoles(user)
  return held.includes('superadmin') || allowed.some((r) => held.includes(r))
}

/** Collection-level helpers */
export const anyone: Access = () => true
export const superadminOnly: Access = ({ req }) => hasRole(req.user)
export const editors: Access = ({ req }) => hasRole(req.user, 'editor')
export const organizers: Access = ({ req }) => hasRole(req.user, 'admin')
export const staff: Access = ({ req }) => hasRole(req.user, 'admin', 'editor')

/** Public can read published documents only; staff can read drafts too. */
export const publishedOrStaff: Access = ({ req }) => {
  if (hasRole(req.user, 'admin', 'editor')) return true
  return { _status: { equals: 'published' } }
}

/** Field-level helper */
export const superadminField: FieldAccess = ({ req }) => hasRole(req.user)

/** Names people see for each role (in the content manager, staff suite and dashboard). */
export const roleLabels: Record<Role, string> = {
  superadmin: 'Superadmin (owner)',
  admin: 'Admin manager',
  editor: 'Editor',
  gate: 'Ticket staff',
}

/** The highest role a user holds, for display. */
export function topRole(user: MaybeUser): Role | null {
  const held = userRoles(user)
  return (roles.find((r) => held.includes(r)) as Role | undefined) ?? null
}

/**
 * Menu visibility in the content manager: hide an item unless the person holds one of the
 * roles (the owner always sees it). No roles given = owner only. This only tidies the menu;
 * the access rules on each collection still decide what can be read or changed.
 */
export const hiddenUnless =
  (...allowed: Role[]) =>
  ({ user }: { user: unknown }) =>
    !hasRole(user as MaybeUser, ...allowed)
