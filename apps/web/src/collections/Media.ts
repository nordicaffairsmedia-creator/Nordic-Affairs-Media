import type { CollectionConfig } from 'payload'
import { anyone, staff } from '@/access/roles'
import { revalidateOnChange, revalidateOnDelete } from '@/lib/revalidate'

export const Media: CollectionConfig = {
  slug: 'media',
  orderable: true,
  hooks: { afterChange: [revalidateOnChange], afterDelete: [revalidateOnDelete] },
  admin: { group: 'Media library', defaultColumns: ['filename', 'alt', 'credit'] },
  access: { read: anyone, create: staff, update: staff, delete: staff },
  upload: {
    // No "Paste URL" button: files are chosen from the computer or dropped in.
    pasteURL: false,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
    focalPoint: true,
    // Pre-cut sizes; next/image picks the closest one and serves AVIF/WebP.
    imageSizes: [
      { name: 'thumb', width: 480 },
      { name: 'card', width: 960 },
      { name: 'feature', width: 1600 },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
    adminThumbnail: 'thumb',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      localized: true,
      admin: {
        description: 'Optional. Describe the image for people who cannot see it (accessibility, SEO).',
      },
    },
    { name: 'caption', type: 'text', localized: true },
    { name: 'showOnMediaPage', type: 'checkbox', defaultValue: false, admin: { description: 'Tick to show this picture on the public Media page. Unticked pictures stay in the library only.' } },
    { name: 'credit', type: 'text', admin: { description: 'Photographer or source.' } },
    {
      name: 'sourceUrl',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Original address on the old WordPress site (set by the import).',
      },
    },
    {
      name: 'isPlaceholder',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Development placeholder image — replace before launch.' },
    },
  ],
}
