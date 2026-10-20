import type { CollectionConfig } from 'payload'
import { anyone, staff } from '@/access/roles'
import { revalidateMediaChange, revalidateMediaDelete } from '@/lib/revalidate'

/**
 * Video and audio files (MP4, MOV, WebM, MP3, WAV ...), short or long. Bulk upload sends big files straight to storage in 64 MB pieces, so there is no size limit on our side (Cloudflare R2 allows up to 5 TB per file). Single "Create new" uploads stay at 2 GB: use the Bulk upload bar for bigger files.
 * Everything uploaded here appears on the public Media page.
 */
export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'Video / audio', plural: 'Videos & audio' },
  defaultSort: '-createdAt',
  admin: {
    group: 'Media library',
    useAsTitle: 'title',
    defaultColumns: ['title', 'filename', 'format'],
    pagination: { defaultLimit: 25, limits: [25, 50, 100] },
    components: { beforeListTable: ['/components/admin/FastUploadBanner#VideosListUpload'] },
  },
  access: { read: anyone, create: staff, update: staff, delete: staff },
  upload: { mimeTypes: ['video/*', 'audio/*'], pasteURL: false, bulkUpload: false },
  hooks: {
    afterChange: [revalidateMediaChange],
    afterDelete: [revalidateMediaDelete],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,
      admin: { description: 'Optional. The file name is used if left empty.' },
    },
    {
      name: 'format',
      type: 'select',
      defaultValue: 'short',
      options: [
        { label: 'Short video', value: 'short' },
        { label: 'Long video', value: 'long' },
      ],
      admin: { description: 'Short clips or long films. Both show on the Media page.' },
    },
    {
      name: 'showOnWebsite',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Show this file on the public Media page.' },
    },
    {
      name: 'poster',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Still image shown before the video plays.' },
    },
    { name: 'credit', type: 'text' },
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
  ],
}
