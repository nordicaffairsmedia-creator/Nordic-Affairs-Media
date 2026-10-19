import type { CollectionConfig } from 'payload'
import { anyone, editors } from '@/access/roles'
import { placeholderField, slugField } from '@/fields/common'

export const socialPlatforms = [
  'facebook',
  'instagram',
  'youtube',
  'linkedin',
  'x',
  'whatsapp',
  'spotify',
  'website',
] as const

export const Authors: CollectionConfig = {
  slug: 'authors',
  orderable: true,
  admin: { group: 'Posts & galleries', useAsTitle: 'name', defaultColumns: ['name', 'role', 'slug'] },
  access: { read: anyone, create: editors, update: editors, delete: editors },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    {
      name: 'role',
      type: 'text',
      localized: true,
      admin: { description: 'e.g. Editor, Contributor' },
    },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'textarea', localized: true },
    {
      name: 'expertise',
      type: 'text',
      hasMany: true,
      localized: true,
      admin: { description: 'Areas this person writes about.' },
    },
    {
      name: 'socialLinks',
      type: 'array',
      admin: { description: 'Only add accounts that really exist.' },
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: socialPlatforms.map((p) => ({ label: p, value: p })),
        },
        { name: 'url', type: 'text', required: true },
      ],
    },
    placeholderField,
  ],
}
