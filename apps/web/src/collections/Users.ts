import type { CollectionConfig } from 'payload'
import { logLogin } from '@/lib/loginLog'
import { hasRole, hiddenUnless, roleLabels, roles, superadminField } from '@/access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'username', 'email', 'roles'],
    group: 'Users & security',
    description:
      'Everyone who can sign in. Superadmin (owner) sees everything; Admin manager runs events and the website; Editor writes stories and galleries; Ticket staff only scan tickets at the gate.',
    // Only the owner manages accounts; others still see their own profile via the account menu.
    hidden: hiddenUnless(),
  },
  auth: {
    // Lock the account for 10 minutes after 5 wrong passwords.
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    tokenExpiration: 60 * 60 * 8,
    // Sign in with a username (e.g. "rana") or the email address.
    loginWithUsername: { allowEmailLogin: true, requireEmail: true },
  },
  access: {
    // Gate staff never enter the CMS; they use the scanner app (phase 6).
    admin: ({ req }) => hasRole(req.user, 'admin', 'editor'),
    read: ({ req }) => {
      // Organizers can see the staff list so they can assign gate staff to events.
      if (hasRole(req.user, 'admin')) return true
      return req.user ? { id: { equals: req.user.id } } : false
    },
    create: ({ req }) => hasRole(req.user),
    update: ({ req }) => {
      if (hasRole(req.user)) return true
      return req.user ? { id: { equals: req.user.id } } : false
    },
    delete: ({ req }) => hasRole(req.user),
  },
  hooks: {
    // Every account gets a username; if none is typed, it is taken from the email address.
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        const current = (data as { username?: string }).username ?? (originalDoc as { username?: string } | undefined)?.username
        if (current) return data
        const email = String((data as { email?: string }).email ?? (originalDoc as { email?: string } | undefined)?.email ?? '')
        const base = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user'
        let candidate = base
        for (let n = 2; n < 50; n++) {
          const taken = await req.payload.find({
            collection: 'users',
            where: { username: { equals: candidate } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          })
          const other = taken.docs[0] as { id: unknown } | undefined
          if (!other || other.id === (originalDoc as { id?: unknown } | undefined)?.id) break
          candidate = `${base}${n}`
        }
        return { ...data, username: candidate }
      },
    ],
    // Sign-in log for the dashboard chart (failures are logged where they happen).
    afterLogin: [
      async ({ req, user }) => {
        const path = req.url ? new URL(req.url, 'http://x').pathname : ''
        await logLogin(req.payload, {
          email: (user as { email?: string }).email,
          ok: true,
          source: path.startsWith('/api/') ? 'admin' : 'staff',
          headers: req.headers,
        })
      },
    ],
    // The very first account (created on the /admin welcome screen) becomes the owner.
    beforeChange: [
      async ({ req, operation, data }) => {
        if (operation !== 'create') return data
        // `find` with limit 1, not `count`: MongoDB refuses a plain count inside the
        // transaction Payload opens for this save ("Cannot run 'count' in a transaction").
        const existing = await req.payload.find({
          collection: 'users',
          req,
          limit: 1,
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
        return existing.docs.length === 0 ? { ...data, roles: ['superadmin'] } : data
      },
    ],
  },
  fields: [
    {
      name: 'accountActions',
      type: 'ui',
      admin: { components: { Field: '/components/admin/AccountActions#AccountActions' } },
    },
    { name: 'name', type: 'text', required: true },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['editor'],
      saveToJWT: true,
      options: roles.map((r) => ({ label: roleLabels[r], value: r })),
      // Only the owner can grant or remove roles (PRD S-02).
      // The welcome screen (no one signed in) may set it too — the hook above then makes
      // that very first account the owner. Anonymous sign-ups are blocked by `create` access.
      access: { create: ({ req }) => !req.user || hasRole(req.user), update: superadminField },
      // There is only ever one Superadmin (owner). Nobody can make a second one.
      validate: async (value: unknown, { req, id }: { req: { payload: import('payload').Payload }; id?: string | number }) => {
        const list = Array.isArray(value) ? (value as string[]) : []
        if (!list.length) return 'Choose at least one role.'
        if (!list.includes('superadmin')) return true
        const owners = await req.payload.find({
          collection: 'users',
          where: { roles: { in: ['superadmin'] } },
          limit: 2,
          depth: 0,
          overrideAccess: true,
        })
        const other = owners.docs.find((d) => String((d as { id: unknown }).id) !== String(id ?? ''))
        return other ? 'There can only be one Superadmin (owner). Choose Admin manager, Editor or Ticket staff.' : true
      },
    },
  ],
}
