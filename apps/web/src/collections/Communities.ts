import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook, CollectionConfig, FieldAccess, PayloadRequest } from 'payload'
import { createHash } from 'node:crypto'
import { anyone, hasRole, staff } from '@/access/roles'

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
type EndpointReq = PayloadRequest
/** Signed up in the app (their email is in App sign-ups) or already joined something. */
async function isAppUser(req: EndpointReq, email: string): Promise<boolean> {
  const a = await req.payload.find({ collection: 'app-registrations', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
  if (a.totalDocs) return true
  const j = await req.payload.find({ collection: 'community-joins', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
  return j.totalDocs > 0
}
async function isMember(req: EndpointReq, kind: string, slug: string, email: string): Promise<boolean> {
  const key = kind === 'organisation' ? `${email}|org:${slug}` : `${email}|${slug}`
  const r = await req.payload.find({ collection: 'community-joins', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
  return r.totalDocs > 0
}

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
  endpoints: [
    {
      // Anyone who signed up in the app can see who joined a community: first names only, never emails.
      path: '/members',
      method: 'get',
      handler: async (req) => {
        const q = (req.query ?? {}) as Record<string, unknown>
        const kind = q.kind === 'organisation' ? 'organisation' : 'community'
        const slug = slugify(String(q.slug ?? ''))
        const email = String(q.email ?? '').trim().toLowerCase()
        if (!slug || !EMAIL.test(email)) return Response.json({ error: 'Bad request' }, { status: 400 })
        if (!(await isAppUser(req, email))) return Response.json({ error: 'Sign up first' }, { status: 403 })
        const all = await req.payload.find({
          collection: 'community-joins',
          where: { and: [{ communitySlug: { equals: slug } }, { kind: { equals: kind } }] },
          limit: 300,
          depth: 0,
          sort: '-createdAt',
          overrideAccess: true,
        })
        const members = all.docs
          .map((d) => String((d as { name?: string }).name ?? '').trim().split(/\s+/)[0]?.slice(0, 30) ?? '')
          .filter(Boolean)
        return Response.json({ count: all.totalDocs, members })
      },
    },
    {
      // Group chat of one community: only members read it.
      path: '/chat',
      method: 'get',
      handler: async (req) => {
        const q = (req.query ?? {}) as Record<string, unknown>
        const kind = q.kind === 'organisation' ? 'organisation' : 'community'
        const slug = slugify(String(q.slug ?? ''))
        const email = String(q.email ?? '').trim().toLowerCase()
        if (!slug || !EMAIL.test(email)) return Response.json({ error: 'Bad request' }, { status: 400 })
        if (!(await isMember(req, kind, slug, email))) return Response.json({ error: 'Join first' }, { status: 403 })
        const r = await req.payload.find({
          collection: 'community-messages',
          where: { and: [{ communitySlug: { equals: slug } }, { kind: { equals: kind } }] },
          limit: 80,
          depth: 0,
          sort: '-createdAt',
          overrideAccess: true,
        })
        const messages = r.docs
          .map((d) => {
            const m = d as { id: string | number; name?: string; email?: string; text?: string; createdAt?: string }
            return {
              id: String(m.id),
              name: String(m.name ?? ''),
              text: String(m.text ?? ''),
              at: m.createdAt ?? '',
              mine: m.email === email,
              // anonymous sender id so the app can offer "block this person" without ever seeing an email
              by: createHash('sha256').update(String(m.email ?? '')).digest('hex').slice(0, 12),
            }
          })
          .reverse()
        return Response.json({ messages })
      },
    },
    {
      // A member reports a chat message. Staff see it under Communities -> Chat reports and can delete the message.
      path: '/report',
      method: 'post',
      handler: async (req) => {
        let body: Record<string, unknown> = {}
        try {
          body = ((await req.json?.()) ?? {}) as Record<string, unknown>
        } catch {
          return Response.json({ error: 'Bad request' }, { status: 400 })
        }
        const kind = body.kind === 'organisation' ? 'organisation' : 'community'
        const slug = slugify(String(body.slug ?? ''))
        const email = String(body.email ?? '').trim().toLowerCase()
        const messageId = String(body.messageId ?? '').trim().slice(0, 60)
        const reason = String(body.reason ?? '').trim().slice(0, 300)
        if (!slug || !EMAIL.test(email) || !messageId) return Response.json({ error: 'Bad request' }, { status: 400 })
        if (!(await isMember(req, kind, slug, email))) return Response.json({ error: 'Join first' }, { status: 403 })
        const found = await req.payload.find({ collection: 'community-messages', where: { id: { equals: messageId } }, limit: 1, depth: 0, overrideAccess: true })
        const msg = found.docs[0] as { name?: string; email?: string; text?: string } | undefined
        if (!msg) return Response.json({ error: 'Not found' }, { status: 404 })
        await req.payload.create({
          collection: 'chat-reports',
          data: {
            communitySlug: slug,
            messageId,
            messageText: String(msg.text ?? '').slice(0, 500),
            messageAuthor: String(msg.name ?? ''),
            messageAuthorEmail: String(msg.email ?? ''),
            reporterEmail: email,
            reason,
          },
          overrideAccess: true,
        })
        return Response.json({ ok: true })
      },
    },
    {
      path: '/chat',
      method: 'post',
      handler: async (req) => {
        let body: Record<string, unknown> = {}
        try {
          body = ((await req.json?.()) ?? {}) as Record<string, unknown>
        } catch {
          return Response.json({ error: 'Bad request' }, { status: 400 })
        }
        const kind = body.kind === 'organisation' ? 'organisation' : 'community'
        const slug = slugify(String(body.slug ?? ''))
        const email = String(body.email ?? '').trim().toLowerCase()
        const text = String(body.text ?? '').trim().slice(0, 500)
        if (!slug || !EMAIL.test(email) || !text) return Response.json({ error: 'Bad request' }, { status: 400 })
        if (!(await isMember(req, kind, slug, email))) return Response.json({ error: 'Join first' }, { status: 403 })
        // slow down floods: one message every 2 seconds per person
        const last = await req.payload.find({
          collection: 'community-messages',
          where: { email: { equals: email } },
          limit: 1,
          sort: '-createdAt',
          depth: 0,
          overrideAccess: true,
        })
        const t = (last.docs[0] as { createdAt?: string } | undefined)?.createdAt
        if (t && Date.now() - new Date(t).getTime() < 2000) return Response.json({ error: 'Slow down' }, { status: 429 })
        const join = await req.payload.find({
          collection: 'community-joins',
          where: { key: { equals: kind === 'organisation' ? `${email}|org:${slug}` : `${email}|${slug}` } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const name = String((join.docs[0] as { name?: string } | undefined)?.name ?? 'Member').split(/\s+/)[0]!.slice(0, 30)
        await req.payload.create({
          collection: 'community-messages',
          data: { kind, communitySlug: slug, name, email, text },
          overrideAccess: true,
        })
        return Response.json({ ok: true })
      },
    },
  ],
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

/** Safe text from what an organisation typed in the app (anyone can send it, so nothing is trusted). */
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const cleanLink = (v: unknown) => {
  const s = clean(v, 300)
  return /^https:\/\/[^\s]+$/.test(s) ? s : ''
}
const httpsLink = (v: unknown) => {
  if (!v) return true
  return /^https:\/\/[^\s]+$/.test(String(v)) || 'Use the full link, starting with https://'
}
const signedIn: FieldAccess = ({ req }) => Boolean(req.user)
const staffOnly = { create: signedIn, read: signedIn, update: signedIn }

/**
 * Staff create and edit organisations here as before. An organisation can also register ITSELF in the app
 * (Organisations tab -> Register your organisation): that creates a profile that is NOT shown until you tick
 * "Show in the app". Everything it types is cleaned here, and its contact details stay private to staff.
 */
const prepareOrganisation: CollectionBeforeValidateHook = ({ data, req, operation }) => {
  if (!data) return data
  if (operation === 'create' && !req.user) {
    const name = clean(data.name, 120)
    if (name.length < 2) throw new Error('Please enter the organisation name.')
    const contactName = clean(data.contactName, 80)
    const contactEmail = clean(data.contactEmail, 200).toLowerCase()
    if (contactEmail && !EMAIL.test(contactEmail)) throw new Error('Please enter a valid contact email.')
    return {
      name,
      slug: `${slugify(name) || 'organisation'}-${Math.random().toString(36).slice(2, 6)}`,
      description: clean(data.description, 600),
      city: clean(data.city, 80),
      website: cleanLink(data.website),
      youtube: cleanLink(data.youtube),
      instagram: cleanLink(data.instagram),
      facebook: cleanLink(data.facebook),
      groupLink: cleanLink(data.groupLink),
      contactName,
      contactEmail,
      submittedFromApp: true,
      active: false,
      order: 100,
    }
  }
  const given = typeof data.slug === 'string' ? slugify(data.slug) : ''
  const fromName = typeof data.name === 'string' ? slugify(data.name) : ''
  return { ...data, slug: given || fromName }
}

/**
 * Associations and clubs shown in the ticketing app (for example a Kerala association): each has its own page
 * with a description, links (website, YouTube ...), announcement, events, a Join button and a group chat link.
 */
export const Organisations: CollectionConfig = {
  slug: 'organisations',
  labels: { singular: 'Organisation', plural: 'Organisations' },
  defaultSort: 'order',
  admin: {
    group: 'Communities',
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'active', 'submittedFromApp', 'createdAt'],
    description:
      'Associations and clubs of the ticketing app. Organisations can register themselves in the app: their profile arrives here hidden ("Show in the app" is unticked). Open it, check it, add a cover picture if you like, then tick "Show in the app" and Save to publish it. You can also create one yourself with Create New.',
  },
  access: {
    // the public sees only organisations ticked "Show in the app"; staff see everything (including new registrations)
    read: ({ req }) => (hasRole(req.user, 'admin', 'editor') ? true : { active: { equals: true } }),
    create: () => true, // the app registration form (cleaned in the hook above)
    update: staff,
    delete: staff,
  },
  hooks: { beforeValidate: [prepareOrganisation] },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'For example: Kerala Association Stockholm.' } },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'Created from the name. Do not change it after the organisation is in use.' },
    },
    { name: 'description', type: 'textarea', admin: { description: 'A few lines about the organisation, shown at the top of its page.' } },
    { name: 'city', type: 'text', admin: { description: 'Optional, for example Stockholm.' } },
    {
      type: 'row',
      fields: [
        { name: 'website', label: 'Website', type: 'text', validate: httpsLink, admin: { width: '50%', description: 'https://...' } },
        { name: 'youtube', label: 'YouTube', type: 'text', validate: httpsLink, admin: { width: '50%', description: 'https://...' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'instagram', label: 'Instagram', type: 'text', validate: httpsLink, admin: { width: '50%', description: 'https://...' } },
        { name: 'facebook', label: 'Facebook', type: 'text', validate: httpsLink, admin: { width: '50%', description: 'https://...' } },
      ],
    },
    {
      name: 'groupLink',
      label: 'Group chat link',
      type: 'text',
      validate: httpsLink,
      admin: { description: 'WhatsApp or Telegram group invite link. Opens from the "Group chat" button.' },
    },
    { name: 'announcement', type: 'textarea', access: { create: staffOnly.create, update: staffOnly.update }, admin: { description: 'Optional short message shown on the page. Empty = nothing shown.' } },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      access: { create: staffOnly.create, update: staffOnly.update },
      admin: { description: 'Optional picture for the top of the page. Best: wide, 1600 x 900 pixels.' },
    },
    {
      name: 'songs',
      label: 'Songs',
      type: 'upload',
      relationTo: 'community-songs',
      hasMany: true,
      access: { create: staffOnly.create, update: staffOnly.update },
      admin: { description: 'Optional. Songs played while this page is open. Upload them first under "Community songs".' },
    },
    {
      type: 'collapsible',
      label: 'Contact person (private: only staff can see this)',
      fields: [
        { name: 'contactName', type: 'text', access: staffOnly },
        { name: 'contactEmail', type: 'email', access: staffOnly },
      ],
    },
    {
      name: 'submittedFromApp',
      label: 'Registered in the app',
      type: 'checkbox',
      defaultValue: false,
      access: { create: () => true, read: signedIn, update: signedIn },
      admin: { position: 'sidebar', readOnly: true, description: 'Ticked when the organisation registered itself in the app.' },
    },
    { name: 'order', type: 'number', defaultValue: 10, admin: { position: 'sidebar', description: 'Smaller numbers come first.' } },
    {
      name: 'active',
      label: 'Show in the app',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Untick to hide this organisation in the app. New registrations from the app start unticked until you approve them.' },
    },
  ],
}

/** Messages of the in-app group chat. Members write through the app; staff can read and delete (moderation). */
export const CommunityMessages: CollectionConfig = {
  slug: 'community-messages',
  labels: { singular: 'Chat message', plural: 'Chat messages' },
  defaultSort: '-createdAt',
  admin: {
    group: 'Communities',
    useAsTitle: 'text',
    defaultColumns: ['communitySlug', 'name', 'text', 'createdAt'],
    description: 'Messages of the group chat inside each community / organisation. Delete a message here to remove it from the chat.',
  },
  access: { read: staff, create: staff, update: staff, delete: staff },
  fields: [
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'community',
      options: [
        { label: 'Community', value: 'community' },
        { label: 'Organisation', value: 'organisation' },
      ],
    },
    { name: 'communitySlug', label: 'Community / organisation', type: 'text', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'text', type: 'textarea', required: true },
  ],
}

/** A member reported a chat message (Apple requires a report function for user-written content). */
export const ChatReports: CollectionConfig = {
  slug: 'chat-reports',
  labels: { singular: 'Chat report', plural: 'Chat reports' },
  defaultSort: '-createdAt',
  admin: {
    group: 'Communities',
    useAsTitle: 'messageText',
    defaultColumns: ['communitySlug', 'messageAuthor', 'messageText', 'status', 'createdAt'],
    description:
      'Messages that members reported in a group chat. Open the message under Communities -> Chat messages and delete it if it breaks the rules; then set the status here to Handled. Aim to react within 24 hours.',
  },
  access: { read: staff, create: staff, update: staff, delete: staff },
  fields: [
    { name: 'status', type: 'select', defaultValue: 'new', options: [{ label: 'New', value: 'new' }, { label: 'Handled', value: 'handled' }], admin: { position: 'sidebar' } },
    { name: 'communitySlug', label: 'Community / organisation', type: 'text', index: true },
    { name: 'messageId', type: 'text' },
    { name: 'messageText', type: 'textarea' },
    { name: 'messageAuthor', type: 'text' },
    { name: 'messageAuthorEmail', type: 'email' },
    { name: 'reporterEmail', type: 'email' },
    { name: 'reason', type: 'textarea' },
  ],
}

/** "Delete my account" requests from the app (Apple requires an in-app way to ask). Staff erase the person's data and mark it done. */
export const DeletionRequests: CollectionConfig = {
  slug: 'deletion-requests',
  labels: { singular: 'Account deletion request', plural: 'Account deletion requests' },
  defaultSort: '-createdAt',
  admin: {
    group: 'Inbox',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'status', 'createdAt'],
    description:
      'People who asked in the app to delete their account. For each one: delete their rows under App sign-ups, Community members and Chat messages (search by email), then set the status to Done. Finish within 30 days (aim for a few days).',
  },
  access: { read: staff, create: () => true, update: staff, delete: staff },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation !== 'create' || !data) return data
        const email = clean(data.email, 200).toLowerCase()
        if (!EMAIL.test(email)) throw new Error('Please enter a valid email address.')
        return { email, name: clean(data.name, 80), status: 'new' }
      },
    ],
  },
  fields: [
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'name', type: 'text' },
    { name: 'status', type: 'select', defaultValue: 'new', options: [{ label: 'New', value: 'new' }, { label: 'Done', value: 'done' }], admin: { position: 'sidebar' } },
  ],
}
