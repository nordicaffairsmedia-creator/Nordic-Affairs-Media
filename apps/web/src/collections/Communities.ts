import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { anyone, staff } from '@/access/roles'

/**
 * Communities of the ticketing mobile app (Malayali, Tamil, Telugu, Kannada, North Indian ...).
 *
 * The app already shows these five by default. Create a community here with the same name to fill in its
 * songs, cover, description, group link and announcement, or add a new community. The app reads this list
 * live, so a change shows in the app without a new app release.
 */

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

/** The web address part comes from the name when left empty. */
const makeSlug: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  const given = typeof data.slug === 'string' ? slugify(data.slug) : ''
  const fromName = typeof data.name === 'string' ? slugify(data.name) : ''
  return { ...data, slug: given || fromName }
}

export const Communities: CollectionConfig = {
  slug: 'communities',
  labels: { singular: 'Community', plural: 'Communities' },
  defaultSort: 'order',
  admin: {
    group: 'Communities',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'active', 'order'],
    description:
      'Communities shown in the ticketing app. The app plays the community songs when its page is open. To use one of the five built-in names, type the same name: Malayali, Tamil, Telugu, Kannada or North Indian.',
  },
  access: { read: anyone, create: staff, update: staff, delete: staff },
  hooks: { beforeValidate: [makeSlug] },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'For example: Tamil.' } },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Created from the name. Built-in ones are: malayali, tamil, telugu, kannada, north-indian. Do not change it after the community is in use.',
      },
    },
    {
      name: 'script',
      label: 'Letters on the card',
      type: 'text',
      maxLength: 4,
      admin: { description: 'Optional. A few letters in the community language shown on its card, for example தமி.' },
    },
    { name: 'description', type: 'textarea', admin: { description: 'One or two lines shown at the top of the community page.' } },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional picture for the top of the community page.' },
    },
    {
      name: 'songs',
      label: 'Songs',
      type: 'upload',
      relationTo: 'community-songs',
      hasMany: true,
      admin: {
        description:
          'The songs played while this community page is open, one after another in a loop. Upload them first under "Community songs". Use licensed or royalty-free tracks, a few MB each.',
      },
    },
    {
      name: 'groupLink',
      label: 'Group chat link',
      type: 'text',
      admin: { description: 'WhatsApp or Telegram group invite link. Opens from the "Group chat" button.' },
      validate: (v: unknown) => {
        if (!v) return true
        return /^https:\/\/[^\s]+$/.test(String(v)) || 'Use the full https:// link of the group.'
      },
    },
    {
      name: 'announcement',
      type: 'textarea',
      admin: { description: 'Optional short message shown on the community page. Empty = nothing shown.' },
    },
    {
      name: 'accent',
      label: 'Card colour',
      type: 'select',
      defaultValue: 'gold',
      options: [
        { label: 'Gold', value: 'gold' },
        { label: 'Blue', value: 'blue' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'order', type: 'number', defaultValue: 10, admin: { position: 'sidebar', description: 'Smaller numbers come first.' } },
    {
      name: 'active',
      label: 'Show in the app',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Untick to hide this community in the app.' },
    },
  ],
}

/** Audio files of the communities (kept apart from the website background music, which plays on its own). */
const titleFromFile: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const title = typeof data?.title === 'string' ? data.title.trim() : ''
  if (title) return data
  const file = (typeof data?.filename === 'string' && data.filename) || originalDoc?.filename
  if (typeof file === 'string' && file) return { ...data, title: file.replace(/\.[^.]+$/, '') }
  return data
}

export const CommunitySongs: CollectionConfig = {
  slug: 'community-songs',
  labels: { singular: 'Community song', plural: 'Community songs' },
  defaultSort: '-createdAt',
  admin: {
    group: 'Communities',
    useAsTitle: 'title',
    defaultColumns: ['title', 'filename', 'createdAt'],
    description:
      'Audio files for the community pages of the ticketing app. Add a song here, then choose it inside the community under Songs. These do NOT play on the website.',
  },
  access: { read: anyone, create: staff, update: staff, delete: staff },
  upload: { mimeTypes: ['audio/*'], pasteURL: false, bulkUpload: false, allowRestrictedFileTypes: true },
  hooks: { beforeChange: [titleFromFile] },
  fields: [{ name: 'title', type: 'text', admin: { description: 'Optional. The file name is used if left empty.' } }],
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** People who tapped "Join" on a community page. The app can add an entry only; staff read and export. */
export const CommunityJoins: CollectionConfig = {
  slug: 'community-joins',
  labels: { singular: 'Community member', plural: 'Community members' },
  defaultSort: '-createdAt',
  admin: {
    group: 'Communities',
    useAsTitle: 'name',
    defaultColumns: ['community', 'kind', 'name', 'email', 'createdAt'],
    description: 'People who joined a community or an organisation in the ticketing app (one row per person and community or organisation).',
  },
  access: { read: staff, create: () => true, update: staff, delete: staff },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation !== 'create' || !data) return data
        const name = String(data.name ?? '').trim().slice(0, 80)
        const email = String(data.email ?? '').trim().toLowerCase().slice(0, 200)
        const community = String(data.community ?? '').trim().slice(0, 60)
        const slug = slugify(String(data.communitySlug ?? community))
        if (name.length < 2) throw new Error('Please enter a name.')
        if (!EMAIL.test(email)) throw new Error('Please enter a valid email address.')
        if (!slug) throw new Error('Missing community.')
        const kind = data.kind === 'organisation' ? 'organisation' : 'community'
        return {
          name,
          email,
          kind,
          community: community || slug,
          communitySlug: slug,
          key: kind === 'organisation' ? `${email}|org:${slug}` : `${email}|${slug}`,
        }
      },
    ],
  },
  fields: [
    {
      name: 'kind',
      label: 'Type',
      type: 'select',
      defaultValue: 'community',
      options: [
        { label: 'Community', value: 'community' },
        { label: 'Organisation', value: 'organisation' },
      ],
    },
    { name: 'community', label: 'Community / organisation', type: 'text', required: true, index: true },
    { name: 'communitySlug', type: 'text', index: true, admin: { hidden: true } },
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'key', type: 'text', unique: true, index: true, admin: { hidden: true } },
  ],
}

/**
 * Associations and clubs shown in the ticketing app (for example a Kerala association): each has its own page
 * with a description, announcement, events, a Join button and a group chat link. Works like Communities.
 */
export const Organisations: CollectionConfig = {
  slug: 'organisations',
  labels: { singular: 'Organisation', plural: 'Organisations' },
  defaultSort: 'order',
  admin: {
    group: 'Communities',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'active', 'order'],
    description:
      'Associations and clubs shown on the Organisations tab of the ticketing app. Create New: add the name, a short description and the group chat link, then Save. It appears in the app straight away.',
  },
  access: { read: anyone, create: staff, update: staff, delete: staff },
  hooks: { beforeValidate: [makeSlug] },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'For example: Kerala Association Stockholm.' } },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'Created from the name. Do not change it after the organisation is in use.' },
    },
    { name: 'description', type: 'textarea', admin: { description: 'One or two lines shown at the top of the organisation page.' } },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional picture for the top of the page. Best: wide, 1600 x 900 pixels.' },
    },
    {
      name: 'songs',
      label: 'Songs',
      type: 'upload',
      relationTo: 'community-songs',
      hasMany: true,
      admin: {
        description: 'Optional. Songs played while this page is open, one after another in a loop. Upload them first under "Community songs".',
      },
    },
    {
      name: 'groupLink',
      label: 'Group chat link',
      type: 'text',
      admin: { description: 'WhatsApp or Telegram group invite link. Opens from the "Group chat" button.' },
      validate: (v: unknown) => {
        if (!v) return true
        return /^https:\/\/[^\s]+$/.test(String(v)) || 'Use the full https:// link of the group.'
      },
    },
    { name: 'announcement', type: 'textarea', admin: { description: 'Optional short message shown on the page. Empty = nothing shown.' } },
    { name: 'order', type: 'number', defaultValue: 10, admin: { position: 'sidebar', description: 'Smaller numbers come first.' } },
    {
      name: 'active',
      label: 'Show in the app',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Untick to hide this organisation in the app.' },
    },
  ],
}
