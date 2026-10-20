import type { CollectionConfig } from 'payload'
import { anyone, staff } from '@/access/roles'
import { placeOnTop } from '@/lib/orderTop'
import { revalidateMediaChange, revalidateMediaDelete } from '@/lib/revalidate'

/**
 * Video and audio files (MP4, MOV, WebM, MP3, WAV ...), short or long. Bulk upload sends big files straight to storage in 64 MB pieces, so there is no size limit on our side (Cloudflare R2 allows up to 5 TB per file). "Create new" also has no size limit (big files go in pieces).
 * Everything uploaded here appears on the public Media page.
 */
export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'Video / audio', plural: 'Videos & audio' },
  orderable: true,
  defaultSort: '-createdAt',
  admin: {
    group: 'Media library',
    description: 'Bulk upload bar above the list: any size, any number. Create New: one file, no size limit.',
    useAsTitle: 'title',
    defaultColumns: ['title', 'filename', 'format'],
    pagination: { defaultLimit: 25, limits: [25, 50, 100] },
    components: { beforeListTable: ['/components/admin/FastUploadBanner#VideosListUpload'] },
  },
  // "Create New" (one file, up to 5 GB) and the Bulk upload bar above the list (any size, any number) both work.
  access: { read: anyone, create: staff, update: staff, delete: staff },
  upload: {
    // Every audio and video format; a few come with an "application/..." type from the browser.
    mimeTypes: [
      'video/*',
      'audio/*',
      'application/mxf',
      'application/ogg',
      'application/vnd.rn-realmedia',
      'application/vnd.rn-realmedia-vbr',
      'application/x-mpegURL',
      'application/vnd.apple.mpegurl',
    ],
    pasteURL: false,
    // Staff-only. Without this, Payload downloads every finished upload back to the server to inspect it (the file-type list forces it),
    // which fails with "Something went wrong" on big videos. The file types are still limited by the picker (mimeTypes below).
    allowRestrictedFileTypes: true,
    bulkUpload: false,
  },
  hooks: {
    beforeChange: [placeOnTop],
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
