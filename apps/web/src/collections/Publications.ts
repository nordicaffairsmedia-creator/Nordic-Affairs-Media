import type { CollectionConfig } from 'payload'
import { editors, publishedOrStaff } from '@/access/roles'
import { placeholderField, seoFields, slugField } from '@/fields/common'
import { revalidateOnChange, revalidateOnDelete } from '@/lib/revalidate'

/** A magazine issue or digital publication (PRD W-04, master prompt §3–4, §32). */
export const Publications: CollectionConfig = {
  slug: 'publications',
  orderable: true,
  admin: {
    group: 'Posts & galleries',
    useAsTitle: 'title',
    defaultColumns: ['title', 'issueNumber', 'year', '_status'],
  },
  access: { read: publishedOrStaff, create: editors, update: editors, delete: editors },
  versions: { drafts: true },
  hooks: { afterChange: [revalidateOnChange], afterDelete: [revalidateOnDelete] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    {
      type: 'row',
      fields: [
        { name: 'issueNumber', type: 'text', admin: { width: '33%' } },
        {
          name: 'year',
          type: 'number',
          required: true,
          index: true,
          min: 1990,
          max: 2100,
          admin: { width: '33%' },
        },
        { name: 'publishedAt', type: 'date', admin: { width: '33%' } },
      ],
    },
    { name: 'cover', type: 'upload', relationTo: 'media', required: true },
    { name: 'description', type: 'textarea', localized: true },
    {
      name: 'pdf',
      type: 'upload',
      relationTo: 'documents',
      admin: { description: 'The full issue as a PDF.' },
    },
    {
      name: 'articles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      admin: { description: 'Stories from this issue that are also published as web articles.' },
    },
    { name: 'contributors', type: 'relationship', relationTo: 'authors', hasMany: true },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    seoFields,
    placeholderField,
  ],
}
