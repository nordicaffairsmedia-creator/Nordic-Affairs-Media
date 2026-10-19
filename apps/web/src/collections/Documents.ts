import type { CollectionConfig } from 'payload'
import { anyone, staff } from '@/access/roles'
import { revalidateOnChange, revalidateOnDelete } from '@/lib/revalidate'

/** Documents (PDF, Word, Excel ...): magazine issues, press kits, policies. */
export const Documents: CollectionConfig = {
  slug: 'documents',
  orderable: true,
  admin: { group: 'Media library', useAsTitle: 'title' },
  hooks: { afterChange: [revalidateOnChange], afterDelete: [revalidateOnDelete] },
  access: { read: anyone, create: staff, update: staff, delete: staff },
  upload: {
    pasteURL: false,
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { description: 'Optional. The file name is used if left empty.' } },
    { name: 'showOnWebsite', type: 'checkbox', defaultValue: true, admin: { description: 'List this file on the public Media page.' } },
    {
      name: 'allowDownload',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Show a download button to readers.' },
    },
  ],
}
