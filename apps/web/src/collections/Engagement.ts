import type { CollectionConfig } from 'payload'
import { editors, hasRole, organizers, staff, hiddenUnless } from '@/access/roles'
import { seoFields, slugField } from '@/fields/common'
import { revalidateOnChange, revalidateOnDelete } from '@/lib/revalidate'

/** Messages from the contact form (PRD W-08). Only staff can read them. */
export const Enquiries: CollectionConfig = {
  slug: 'enquiries',
  orderable: true,
  admin: {
    group: 'Inbox',
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'type', 'name', 'email', 'status', 'createdAt'],
  },
  access: {
    read: staff,
    create: () => false, // only through the website form (server-side)
    update: staff,
    delete: ({ req }) => hasRole(req.user),
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'General', value: 'general' },
            { label: 'Editorial', value: 'editorial' },
            { label: 'Press', value: 'press' },
            { label: 'Events & tickets', value: 'events' },
            { label: 'Music / artist', value: 'artist' },
            { label: 'Advertising', value: 'advertising' },
            { label: 'Partnerships', value: 'partnerships' },
          ],
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'new',
          options: [
            { label: 'New', value: 'new' },
            { label: 'In progress', value: 'open' },
            { label: 'Answered', value: 'done' },
          ],
        },
      ],
    },
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'message', type: 'textarea', required: true },
    { name: 'locale', type: 'text', admin: { readOnly: true } },
    {
      name: 'consentAt',
      type: 'date',
      admin: { readOnly: true, description: 'When the sender agreed to the privacy notice.' },
    },
    { name: 'internalNote', type: 'textarea' },
  ],
}

/**
 * Newsletter list (PRD W-13) with double opt-in: an address only counts as
 * subscribed after clicking the link in the confirmation email (GDPR good practice).
 */
export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  orderable: true,
  admin: {
    group: 'Inbox',
    useAsTitle: 'email',
    defaultColumns: ['email', 'status', 'locale', 'createdAt'],
  },
  access: { read: staff, create: () => false, update: staff, delete: staff },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Waiting for confirmation', value: 'pending' },
        { label: 'Subscribed', value: 'confirmed' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
    },
    { name: 'locale', type: 'text' },
    { name: 'token', type: 'text', index: true, admin: { hidden: true } },
    { name: 'consentAt', type: 'date', admin: { readOnly: true } },
    { name: 'confirmedAt', type: 'date', admin: { readOnly: true } },
  ],
}

/** Photo galleries of past events (PRD W-14). */
export const Galleries: CollectionConfig = {
  slug: 'galleries',
  orderable: true,
  admin: { group: 'Posts & galleries', useAsTitle: 'title', defaultColumns: ['title', 'date', '_status'] },
  access: {
    read: ({ req }) =>
      hasRole(req.user, 'admin', 'editor') ? true : { _status: { equals: 'published' } },
    create: editors,
    update: editors,
    delete: editors,
  },
  versions: { drafts: true },
  hooks: {
    // "Add many photos" (picked from the library or uploaded in bulk) are appended to the photo
    // list before the form is checked, so a new gallery can be filled with this box alone.
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const d = data as Record<string, unknown>
        const idOf = (v: unknown): string | null =>
          v && typeof v === 'object' && 'id' in v ? String((v as { id: unknown }).id) : v ? String(v) : null
        const extra = (Array.isArray(d.addPhotos) ? d.addPhotos : []).map(idOf).filter((x): x is string => !!x)
        if (extra.length) {
          const prev = (originalDoc as { photos?: unknown } | undefined)?.photos
          const rows = (Array.isArray(d.photos) ? d.photos : Array.isArray(prev) ? prev : []) as {
            image?: unknown
          }[]
          const have = new Set(rows.map((r) => idOf(r?.image)))
          d.photos = [...rows, ...extra.filter((id) => !have.has(id)).map((id) => ({ image: id }))]
        }
        d.addPhotos = []
        return data
      },
    ],
    // Lists only need the cover and the count, so they never load every photo.
    beforeChange: [
      ({ data }) => {
        const photos = Array.isArray(data.photos) ? data.photos : null
        if (photos) {
          data.photoCount = photos.length
          const first: unknown = photos[0]?.image
          const firstId =
            first && typeof first === 'object' && 'id' in first
              ? (first as { id: string }).id
              : first
          if (!data.cover && firstId) data.cover = firstId
        }
        return data
      },
    ],
    afterChange: [revalidateOnChange],
    afterDelete: [revalidateOnDelete],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'date', type: 'date', admin: { position: 'sidebar' } },
    { name: 'event', type: 'relationship', relationTo: 'events', admin: { position: 'sidebar' } },
    { name: 'description', type: 'textarea', localized: true },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
        description: 'Shown on gallery lists. Leave empty to use the first photo.',
      },
    },
    {
      name: 'photoCount',
      type: 'number',
      admin: { position: 'sidebar', readOnly: true, description: 'Counted automatically.' },
    },
    {
      name: 'legacyUrl',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Old WordPress address (path only). Set by the import.',
      },
    },
    {
      name: 'bulkPhotosTool',
      type: 'ui',
      admin: { components: { Field: '/components/admin/GalleryBulkPhotos#GalleryBulkPhotos' } },
    },
    {
      name: 'addPhotos',
      label: 'Add many photos',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        allowCreate: false,
        description:
          'Pick several photos from the library (or upload them with the box above). On Save they move to the end of the photo list below.',
      },
    },
    {
      name: 'photos',
      type: 'array',
      // No minimum here: a new gallery may be filled only through "Add many photos" above.
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text', localized: true },
      ],
    },
    seoFields,
  ],
}

/**
 * Outside organizers who sell tickets through the platform (PRD S-07).
 * Their commission is calculated in Staff → Reports.
 */
export const Organizers: CollectionConfig = {
  slug: 'organizers',
  orderable: true,
  admin: {
    group: 'Ticketing', hidden: hiddenUnless('admin'),
    useAsTitle: 'name',
    defaultColumns: ['name', 'commissionPercent', 'contactEmail'],
  },
  access: {
    read: organizers,
    create: ({ req }) => hasRole(req.user),
    update: ({ req }) => hasRole(req.user),
    delete: ({ req }) => hasRole(req.user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'commissionPercent',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: {
        description: 'Share of ticket revenue (after refunds) kept by Nordic Affairs Media.',
      },
    },
    { name: 'contactName', type: 'text' },
    { name: 'contactEmail', type: 'email' },
    {
      name: 'payoutDetails',
      type: 'textarea',
      admin: { description: 'How and where the organizer is paid. Internal.' },
    },
  ],
}

/** Read-only log of important changes (PRD S-11). Written automatically. */
export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  admin: {
    group: 'Users & security', hidden: hiddenUnless(),
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'user', 'action', 'summary'],
  },
  access: {
    read: ({ req }) => hasRole(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'user', type: 'text' },
    { name: 'action', type: 'text' },
    { name: 'target', type: 'text' },
    { name: 'targetId', type: 'text' },
    { name: 'summary', type: 'text' },
  ],
}
