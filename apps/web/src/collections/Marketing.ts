import { randomBytes } from 'node:crypto'
import type { CollectionAfterReadHook, CollectionBeforeChangeHook, CollectionConfig, PayloadRequest } from 'payload'
import { organizers, hiddenUnless } from '@/access/roles'

/*
 * Marketing center (admin menu: Marketing center).
 *   · Recipient lists   – groups of people who agreed to get marketing email (imported or typed in)
 *   · Email campaigns   – write an email, pick who gets it, send a test, send it, see the numbers
 *   · Tracking links    – one link per place you share (Instagram, poster, newsletter) with a click counter
 * Settings (sender name, reply address, footer) are in the "Marketing settings" screen.
 */

const group = 'Marketing center'
const token = () => randomBytes(18).toString('base64url')
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Paste contacts" → rows. One person per line: email, first name, last name (comma or semicolon). */
const contactName = (r: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim().toLowerCase() || String(r.email ?? '').toLowerCase()

/** Contacts always show in alphabetical order, also for lists saved before and after adding a person by hand. */
const sortContactsRead: CollectionAfterReadHook = ({ doc }) => {
  if (Array.isArray(doc?.contacts)) doc.contacts = [...doc.contacts].sort((x, y) => contactName(x).localeCompare(contactName(y)) || String(x.email).localeCompare(String(y.email)))
  return doc
}

const importContacts: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const d = data as Record<string, unknown>
  const pasted = typeof d.importCsv === 'string' ? d.importCsv.trim() : ''
  d.importCsv = ''
  type Row = { email?: string; firstName?: string; lastName?: string; phone?: string; unsubscribed?: boolean; token?: string }
  // Every row typed in by hand is kept, even when two people share one email address. Rows without a valid email are dropped.
  const rows = ((Array.isArray(d.contacts) ? d.contacts : (originalDoc?.contacts ?? [])) as Row[])
    .filter((r) => EMAIL.test(String(r?.email ?? '').trim()))
    .map((r) => ({ ...r, email: String(r.email).trim().toLowerCase() }))
  if (pasted) {
    if (!d.consentConfirmed && !originalDoc?.consentConfirmed)
      throw new Error('Tick "These people agreed to get marketing email" before you import contacts.')
    for (const line of pasted.split(/\r?\n/)) {
      const [email = '', firstName = '', lastName = '', phone = ''] = line.split(/[;,\t]/).map((s) => s.trim().replace(/^"|"$/g, ''))
      if (!EMAIL.test(email) || /^email$/i.test(email)) continue
      const key = email.toLowerCase()
      const phoneOk = /^\+[1-9]\d{6,14}$/.test(phone.replace(/[\s-]/g, '')) ? phone.replace(/[\s-]/g, '') : ''
      const old = rows.find((r) => r.email === key && (!firstName || (r.firstName ?? '').toLowerCase() === firstName.toLowerCase() || !r.firstName))
      if (old) {
        old.firstName = firstName || old.firstName || ''
        old.lastName = lastName || old.lastName || ''
        old.phone = phoneOk || old.phone || ''
      } else {
        rows.push({ email: key, firstName, lastName, phone: phoneOk, unsubscribed: false, token: token() })
      }
    }
  }
  d.contacts = rows
    .map((r) => ({ ...r, token: r.token || token() }))
    .sort((x, y) => contactName(x).localeCompare(contactName(y)) || String(x.email).localeCompare(String(y.email)))
  d.contactCount = rows.filter((r) => !r.unsubscribed).length
  return data
}

export const RecipientLists: CollectionConfig = {
  slug: 'recipient-lists',
  labels: { singular: 'Recipient list', plural: 'Recipient lists' },
  admin: {
    group,
    hidden: hiddenUnless('admin'),
    useAsTitle: 'name',
    defaultColumns: ['name', 'contactCount', 'consentConfirmed', 'updatedAt'],
    description:
      'People who agreed to get marketing email. Paste their emails, one per line (email, first name, last name, phone). Everyone gets an unsubscribe link.',
  },
  access: { read: organizers, create: organizers, update: organizers, delete: organizers },
  hooks: { beforeChange: [importContacts], afterRead: [sortContactsRead] },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'consentConfirmed',
      type: 'checkbox',
      label: 'These people agreed to get marketing email',
      admin: { description: 'Required before you can import contacts. Imported contacts are saved with this consent.' },
    },
    {
      name: 'importCsv',
      type: 'textarea',
      label: 'Paste contacts',
      admin: { description: 'One person per line: email, first name, last name, phone (with +46…, only needed for text messages). Existing emails are updated. Saved, then this box is emptied.' },
    },
    { name: 'contactCount', type: 'number', defaultValue: 0, admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'contacts',
      type: 'array',
      admin: {
        initCollapsed: true,
        components: { RowLabel: '/components/admin/ContactRowLabel#ContactRowLabel' },
      },
      fields: [
        { name: 'email', type: 'email', required: true },
        { type: 'row', fields: [{ name: 'firstName', type: 'text' }, { name: 'lastName', type: 'text' }] },
        { name: 'phone', type: 'text', admin: { description: 'With country code, e.g. +46701234567. Only for text messages.' } },
        { name: 'unsubscribed', type: 'checkbox', defaultValue: false },
        { name: 'token', type: 'text', admin: { hidden: true } },
      ],
    },
  ],
}

export const EmailCampaigns: CollectionConfig = {
  slug: 'email-campaigns',
  labels: { singular: 'Email campaign', plural: 'Email campaigns' },
  admin: {
    group,
    hidden: hiddenUnless('admin'),
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'sentCount', 'clicks', 'sentAt'],
    description: 'Write an email, pick who gets it, send a test to yourself, then send it.',
  },
  access: { read: organizers, create: organizers, update: organizers, delete: organizers },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Only you see this name.' } },
    {
      name: 'channel',
      type: 'select',
      defaultValue: 'email',
      required: true,
      label: 'Send as',
      options: [
        { label: 'Email', value: 'email' },
        { label: 'Text message (SMS)', value: 'sms' },
      ],
    },
    { name: 'subject', type: 'text', admin: { condition: (d) => d?.channel !== 'sms', description: 'Required for email.' } },
    { name: 'preheader', type: 'text', admin: { condition: (d) => d?.channel !== 'sms', description: 'The short grey line after the subject in the inbox (optional).' } },
    {
      name: 'template',
      type: 'relationship',
      relationTo: 'email-templates',
      label: 'Header image (from Templates)', admin: { condition: (d) => d?.channel !== 'sms', description: 'Optional. The picture of the template you pick is placed at the top of the email. Upload new ones in Marketing center, Templates.' },
    },
    { name: 'headline', type: 'text', label: 'Headline', admin: { condition: (d) => d?.channel !== 'sms', description: 'Big title above the message (optional).' } },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      label: 'Message (email: main paragraphs)',
      admin: { rows: 10, description: 'Plain text. A blank line starts a new paragraph. {{firstName}} becomes the reader\'s first name. For text messages keep it short (160 characters is one message); the link and "Reply STOP to unsubscribe" are added for you.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'ctaLabel', type: 'text', label: 'Button text', admin: { description: 'e.g. Request coverage. Empty = the template button text.' } },
        { name: 'ctaUrl', type: 'text', label: 'Button link', admin: { description: 'Full address or a page like /en/contact. Leave empty to use a tracking link below, or the template link.' } },
      ],
    },
    {
      name: 'trackingLink',
      type: 'relationship',
      relationTo: 'tracking-links',
      admin: { description: 'The button goes through this tracking link, so you can count the clicks.' },
    },
    {
      type: 'collapsible',
      label: 'Star rating (feedback)',
      admin: { initCollapsed: true, condition: (d) => d?.channel !== 'sms', description: 'Readers tap a star (1 to 5) in the email. Results show in the "Feedback results" box below and in Email feedback.' },
      fields: [
        { name: 'feedbackOn', type: 'checkbox', label: 'Show the star rating in the email', defaultValue: true },
        { name: 'feedbackEyebrow', type: 'text', label: 'Small title', admin: { placeholder: 'Executive media feedback' } },
        { name: 'feedbackTitle', type: 'text', label: 'Question', admin: { placeholder: 'How was your experience working with our press pool?' } },
        { name: 'feedbackText', type: 'text', label: 'Line under the question', admin: { placeholder: 'Tap below to submit your rating instantly (1 click):' } },
      ],
    },
    {
      name: 'sendToSubscribers',
      type: 'checkbox',
      label: 'Send to newsletter subscribers',
      defaultValue: true,
      admin: { condition: (d) => d?.channel !== 'sms', description: 'People who confirmed on the website and did not unsubscribe.' },
    },
    {
      name: 'sendToCustomers',
      type: 'checkbox',
      label: 'Send to ticket buyers who said yes to marketing',
      defaultValue: false,
      admin: { description: 'Everyone who ticked the marketing box at checkout and bought tickets.' },
    },
    {
      name: 'sendToAbandoned',
      type: 'checkbox',
      label: 'Send to people who left the checkout (last 90 days)',
      defaultValue: false,
      admin: { description: 'Started an order, said yes to marketing and did not pay. Not those who already bought for that event.' },
    },
    { name: 'lists', type: 'relationship', relationTo: 'recipient-lists', hasMany: true, label: 'Also send to these lists' },
    { name: 'send', type: 'ui', admin: { components: { Field: '/components/admin/CampaignSend#CampaignSend' } } },
    { name: 'results', type: 'ui', admin: { components: { Field: '/components/admin/FeedbackResults#FeedbackResults' } } },
    {
      type: 'row',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'draft',
          admin: { readOnly: true },
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Sending', value: 'sending' },
            { label: 'Sent', value: 'sent' },
          ],
        },
      ],
    },
    { name: 'sentAt', type: 'date', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'recipientCount', type: 'number', defaultValue: 0, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'sentCount', type: 'number', defaultValue: 0, label: 'Sent', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'failedCount', type: 'number', defaultValue: 0, label: 'Failed', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'clicks', type: 'number', defaultValue: 0, admin: { readOnly: true, position: 'sidebar' } },
  ],
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .slice(0, 60)

export const TrackingLinks: CollectionConfig = {
  slug: 'tracking-links',
  labels: { singular: 'Tracking link', plural: 'Tracking links' },
  admin: {
    group,
    hidden: hiddenUnless('admin'),
    useAsTitle: 'name',
    defaultColumns: ['name', 'shortLink', 'clicks', 'lastClickAt'],
    description: 'Make one link per place you share it (Instagram, the poster, the newsletter) and see which one gets clicks.',
  },
  access: { read: organizers, create: organizers, update: organizers, delete: organizers },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        const d = data as Record<string, unknown>
        if (typeof d.slug === 'string' && d.slug.trim()) d.slug = slugify(d.slug)
        else if (typeof d.name === 'string') d.slug = slugify(d.name)
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'e.g. Instagram bio, Poster QR, Newsletter' } },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { description: 'The end of the short link. Made from the name.' } },
    { name: 'event', type: 'relationship', relationTo: 'events', admin: { description: 'Opens this event page. Or fill in the address below.' } },
    { name: 'destination', type: 'text', label: 'Other address', admin: { description: 'Full address (https://...). Used when no event is picked.' } },
    {
      name: 'shortLink',
      type: 'text',
      virtual: true,
      admin: { readOnly: true, description: 'Share this link.' },
      hooks: {
        afterRead: [
          ({ siblingData }) => {
            const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
            return siblingData?.slug ? `${base}/api/go/${siblingData.slug}` : ''
          },
        ],
      },
    },
    { name: 'clicks', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'lastClickAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    {
      type: 'row',
      fields: [
        {
          name: 'orders',
          type: 'number',
          virtual: true,
          label: 'Orders paid',
          admin: { readOnly: true, description: 'Paid orders from people who came through this link (last 30 days before they bought).' },
          hooks: { afterRead: [async ({ siblingData, req }) => (await salesFor(req, siblingData?.slug)).orders] },
        },
        {
          name: 'revenue',
          type: 'number',
          virtual: true,
          label: 'Sales (kr)',
          admin: { readOnly: true, description: 'Total of those orders.' },
          hooks: { afterRead: [async ({ siblingData, req }) => (await salesFor(req, siblingData?.slug)).revenue] },
        },
      ],
    },
  ],
}

/** Paid orders that came through a tracking link (the website stamps the link's name on the order at checkout). */
async function salesFor(req: PayloadRequest, slug: unknown): Promise<{ orders: number; revenue: number }> {
  if (typeof slug !== 'string' || !slug) return { orders: 0, revenue: 0 }
  try {
    const db = (req.payload.db as unknown as { connection: { db: { collection: (n: string) => { aggregate: (p: object[]) => { toArray: () => Promise<{ n: number; sum: number }[]> } } } } }).connection.db
    const [r] = await db
      .collection('booking_orders')
      .aggregate([
        { $match: { trackingSource: slug, status: { $in: ['paid', 'partially_refunded'] } } },
        { $group: { _id: null, n: { $sum: 1 }, sum: { $sum: '$total' } } },
      ])
      .toArray()
    return { orders: r?.n ?? 0, revenue: Math.round((r?.sum ?? 0) / 100) }
  } catch {
    return { orders: 0, revenue: 0 }
  }
}

/** Star ratings and tag clicks from the "Clean Blue" email. Written only by the website, read by organizers. */
export const EmailFeedback: CollectionConfig = {
  slug: 'email-feedback',
  labels: { singular: 'Email feedback', plural: 'Email feedback' },
  admin: {
    group,
    hidden: hiddenUnless('admin'),
    useAsTitle: 'email',
    defaultColumns: ['campaign', 'email', 'kind', 'score', 'tag', 'createdAt'],
    description: 'Every star and tag a reader clicked in a campaign email.',
  },
  access: { read: organizers, create: () => false, update: () => false, delete: organizers },
  fields: [
    { name: 'campaign', type: 'relationship', relationTo: 'email-campaigns', required: true, index: true },
    { name: 'email', type: 'email', required: true },
    { name: 'kind', type: 'select', required: true, options: [{ label: 'Star rating', value: 'rating' }, { label: 'Tag', value: 'tag' }] },
    { name: 'score', type: 'number', min: 1, max: 5 },
    { name: 'tag', type: 'text' },
  ],
}

/** Files attached to campaign emails: pictures, PDF, Word, Excel, anything. Not shown on the public website. */
export const EmailFiles: CollectionConfig = {
  slug: 'email-files',
  labels: { singular: 'Email file', plural: 'Email files' },
  admin: {
    group,
    hidden: hiddenUnless('admin'),
    useAsTitle: 'filename',
    description: 'Files you attach to email campaigns. Any type of file. They are not listed on the website.',
  },
  access: { read: () => true, create: organizers, update: organizers, delete: organizers },
  upload: { pasteURL: false, bulkUpload: false },
  fields: [],
}

/** Email templates: a picture or a document (PDF, Word ...) that is shown at the top of a campaign email. */
export const EmailTemplates: CollectionConfig = {
  slug: 'email-templates',
  labels: { singular: 'Email template', plural: 'Templates' },
  admin: {
    group,
    hidden: hiddenUnless('admin'),
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
    description: 'Upload a header picture once, then pick it in any email campaign.',
  },
  access: { read: organizers, create: organizers, update: organizers, delete: organizers },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Only you see this name.' } },
    { name: 'picture', type: 'upload', relationTo: 'email-files', label: 'Header picture', admin: { description: 'Placed at the top of the email as its header (JPG, PNG). Best width 1200 px.' } },
    { name: 'buttonUrl', type: 'text', label: 'Link when the picture is clicked', admin: { description: 'e.g. /en/contact or a full address. Optional.' } },
  ],
}
