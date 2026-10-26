import { randomBytes } from 'node:crypto'
import type { CollectionBeforeChangeHook, CollectionConfig, PayloadRequest } from 'payload'
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
const importContacts: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const d = data as Record<string, unknown>
  const pasted = typeof d.importCsv === 'string' ? d.importCsv.trim() : ''
  d.importCsv = ''
  const rows = (Array.isArray(d.contacts) ? d.contacts : (originalDoc?.contacts ?? [])) as {
    email?: string
    firstName?: string
    lastName?: string
    phone?: string
    unsubscribed?: boolean
    token?: string
  }[]
  const byEmail = new Map(rows.map((r) => [String(r.email ?? '').toLowerCase(), r]))
  if (pasted) {
    if (!d.consentConfirmed && !originalDoc?.consentConfirmed)
      throw new Error('Tick "These people agreed to get marketing email" before you import contacts.')
    for (const line of pasted.split(/\r?\n/)) {
      const [email = '', firstName = '', lastName = '', phone = ''] = line.split(/[;,\t]/).map((s) => s.trim().replace(/^"|"$/g, ''))
      if (!EMAIL.test(email) || /^email$/i.test(email)) continue
      const key = email.toLowerCase()
      const old = byEmail.get(key)
      byEmail.set(key, {
        email: key,
        firstName: firstName || old?.firstName || '',
        lastName: lastName || old?.lastName || '',
        phone: /^\+[1-9]\d{6,14}$/.test(phone.replace(/[\s-]/g, '')) ? phone.replace(/[\s-]/g, '') : old?.phone || '',
        unsubscribed: old?.unsubscribed ?? false,
        token: old?.token || token(),
      })
    }
  }
  d.contacts = [...byEmail.values()].map((r) => ({ ...r, token: r.token || token() }))
  d.contactCount = (d.contacts as { unsubscribed?: boolean }[]).filter((r) => !r.unsubscribed).length
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
  hooks: { beforeChange: [importContacts] },
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
      admin: { initCollapsed: true },
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
      name: 'body',
      type: 'textarea',
      required: true,
      label: 'Message',
      admin: { rows: 10, description: 'Plain text. A blank line starts a new paragraph. {{firstName}} becomes the reader\'s first name. For text messages keep it short (160 characters is one message); the link and "Reply STOP to unsubscribe" are added for you.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'ctaLabel', type: 'text', label: 'Button text', admin: { description: 'e.g. Buy tickets' } },
        { name: 'ctaUrl', type: 'text', label: 'Button link', admin: { description: 'Full address. Leave empty to use a tracking link below.' } },
      ],
    },
    {
      name: 'trackingLink',
      type: 'relationship',
      relationTo: 'tracking-links',
      admin: { description: 'The button goes through this tracking link, so you can count the clicks.' },
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
