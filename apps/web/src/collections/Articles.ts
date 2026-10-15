import type { CollectionConfig } from 'payload'
import { editors, publishedOrStaff } from '@/access/roles'
import { placeholderField, seoFields, slugField } from '@/fields/common'
import { revalidateOnChange, revalidateOnDelete } from '@/lib/revalidate'

export const Articles: CollectionConfig = {
  slug: 'articles',
  orderable: true,
  admin: {
    group: 'Posts & galleries',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt', '_status'],
    listSearchableFields: ['title', 'slug'],
    preview: (doc) => (typeof doc.slug === 'string' ? `/en/news/${doc.slug}` : null),
  },
  access: { read: publishedOrStaff, create: editors, update: editors, delete: editors },
  // Drafts + scheduled publishing (master prompt §20 "Schedule publication").
  versions: { drafts: { autosave: { interval: 2000 }, schedulePublish: true }, maxPerDoc: 50 },
  hooks: { afterChange: [revalidateOnChange], afterDelete: [revalidateOnDelete] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    {
      name: 'deck',
      type: 'textarea',
      localized: true,
      label: 'Summary (deck)',
      admin: { description: 'One or two sentences shown under the headline and on story cards.' },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Story',
          fields: [
            { name: 'heroImage', type: 'upload', relationTo: 'media' },
            {
              name: 'heroVideo',
              type: 'upload',
              relationTo: 'videos',
              admin: { description: 'Optional video file shown at the top of the story.' },
            },
            {
              name: 'heroVideoUrl',
              type: 'text',
              admin: { description: 'Optional YouTube/Vimeo link.' },
            },
            { name: 'body', type: 'richText', localized: true, required: true },
          ],
        },
        {
          label: 'Related',
          fields: [
            {
              name: 'relatedArticles',
              type: 'relationship',
              relationTo: 'articles',
              hasMany: true,
              maxRows: 6,
              filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
            },
            {
              name: 'relatedEvent',
              type: 'relationship',
              relationTo: 'events',
              admin: { description: 'Show a "Book tickets" panel for this event.' },
            },
          ],
        },
        { label: 'SEO', fields: [seoFields] },
      ],
    },
    slugField(),
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'authors',
      hasMany: true,
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      index: true,
      defaultValue: () => new Date().toISOString(),
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'legacyUrl',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Old WordPress address (path only, e.g. /2024/05/my-story/). Redirects here automatically.',
      },
    },
    placeholderField,
  ],
}
