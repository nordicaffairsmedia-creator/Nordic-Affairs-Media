import type { CollectionConfig } from 'payload'
import { anyone, hasRole, hiddenUnless } from '@/access/roles'
import { seoFields, slugField } from '@/fields/common'
import { revalidateOnChange, revalidateOnDelete } from '@/lib/revalidate'

/** Simple editable pages: About, FAQ, Terms, Privacy, Cookies, Refund policy (PRD W-08). */
export const Pages: CollectionConfig = {
  slug: 'pages',
  orderable: true,
  admin: { group: 'Website', useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status'] },
  access: {
    read: ({ req }) =>
      hasRole(req.user, 'admin', 'editor') ? true : { _status: { equals: 'published' } },
    create: ({ req }) => hasRole(req.user, 'editor'),
    update: ({ req }) => hasRole(req.user, 'editor'),
    delete: ({ req }) => hasRole(req.user),
  },
  versions: { drafts: true },
  hooks: { afterChange: [revalidateOnChange], afterDelete: [revalidateOnDelete] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'intro', type: 'textarea', localized: true },
    { name: 'body', type: 'richText', localized: true },
    {
      type: 'row',
      fields: [
        {
          name: 'showStats',
          type: 'checkbox',
          label: 'Show key figures',
          admin: { description: 'From Settings → Site settings → Key figures.' },
        },
        {
          name: 'showPress',
          type: 'checkbox',
          label: 'Show press coverage',
          admin: { description: 'From Settings → Site settings → Coverage in the press.' },
        },
      ],
    },
    seoFields,
  ],
}

/** Old-address → new-address redirects (master prompt §21, PRD W-10). */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  orderable: true,
  admin: { group: 'Settings', hidden: hiddenUnless(), useAsTitle: 'from', defaultColumns: ['from', 'to', 'permanent'] },
  access: {
    read: anyone,
    create: ({ req }) => hasRole(req.user, 'editor'),
    update: ({ req }) => hasRole(req.user, 'editor'),
    delete: ({ req }) => hasRole(req.user, 'editor'),
  },
  hooks: { afterChange: [revalidateOnChange], afterDelete: [revalidateOnDelete] },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Old path, e.g. /2024/05/my-story/ (no domain).' },
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? normalizePath(value) : value)],
      },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: { description: 'New path, e.g. /en/news/my-story' },
    },
    { name: 'permanent', type: 'checkbox', defaultValue: true, label: 'Permanent (301)' },
  ],
}

/** Lower-case, leading slash, no trailing slash, no query string. */
export function normalizePath(path: string): string {
  const clean = path.trim().split(/[?#]/)[0] ?? ''
  const withSlash = clean.startsWith('/') ? clean : `/${clean}`
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '').toLowerCase() : withSlash
}
