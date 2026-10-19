import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { anyone, staff } from '@/access/roles'
import { revalidateOnChange, revalidateOnDelete } from '@/lib/revalidate'

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024

/** Rejects files over 200 MB (works for both normal and direct-to-storage uploads). */
const limitSize: CollectionBeforeValidateHook = ({ data, req }) => {
  const size = (req as { file?: { size?: number } }).file?.size ?? (data as { filesize?: number } | undefined)?.filesize
  if (typeof size === 'number' && size > MAX_VIDEO_BYTES) {
    throw new Error(
      `This file is ${(size / 1024 / 1024).toFixed(0)} MB. The limit is 200 MB. Please compress it or add a YouTube/Vimeo link instead.`,
    )
  }
  return data
}

/**
 * Video and audio files (MP4, MOV, WebM, MP3, WAV ...), short or long, up to 200 MB.
 * Everything uploaded here appears on the public Media page.
 */
export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'Video / audio', plural: 'Videos & audio' },
  orderable: true,
  admin: { group: 'Media library', useAsTitle: 'title', defaultColumns: ['title', 'filename', 'format'] },
  access: { read: anyone, create: staff, update: staff, delete: staff },
  upload: { mimeTypes: ['video/*', 'audio/*'], pasteURL: false },
  hooks: {
    beforeValidate: [limitSize],
    afterChange: [revalidateOnChange],
    afterDelete: [revalidateOnDelete],
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
