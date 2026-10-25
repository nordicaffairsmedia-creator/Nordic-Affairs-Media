import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { anyone, staff } from '@/access/roles'
import { purge, revalidateOnDelete } from '@/lib/revalidate'

/**
 * Background music of the website.
 *
 * Add a track and it starts playing on the website straight away (every page, in a loop, with the
 * Play / Pause button at the bottom left). Only one track plays at a time: the one ticked
 * "Play on the website". Adding a new track, or ticking an older one, unticks the others.
 * Change: open a track to rename it, replace its audio file or tick another track.
 * Delete: remove a track; with no ticked track left, the website has no music and no Play button.
 */

/** A track without a title shows its file name (without ".mp3") in the list. */
const titleFromFile: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const title = typeof data?.title === 'string' ? data.title.trim() : ''
  if (title) return data
  const file = (typeof data?.filename === 'string' && data.filename) || originalDoc?.filename
  if (typeof file === 'string' && file) return { ...data, title: file.replace(/\.[^.]+$/, '') }
  return data
}

/** The ticked track is the only one that plays: untick every other track, then refresh the website. */
const onlyOneTrackPlays: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (doc?.active) {
    await req.payload.update({
      collection: 'music',
      where: { and: [{ active: { equals: true } }, { id: { not_equals: doc.id } }] },
      data: { active: false },
      depth: 0,
      req,
    })
  }
  purge()
  return doc
}

export const Music: CollectionConfig = {
  slug: 'music',
  labels: { singular: 'Music track', plural: 'Background music' },
  defaultSort: '-createdAt',
  admin: {
    group: 'Background music',
    description:
      'The music that plays on the website. Create New: choose an audio file (MP3, M4A, WAV...) and Save, and it plays on the website at once. To change the music, add a new track or tick another one. To remove it, delete the track.',
    useAsTitle: 'title',
    defaultColumns: ['title', 'filename', 'active', 'createdAt'],
    pagination: { defaultLimit: 25, limits: [25, 50, 100] },
  },
  access: { read: anyone, create: staff, update: staff, delete: staff },
  upload: {
    mimeTypes: ['audio/*'],
    pasteURL: false,
    bulkUpload: false,
    // Staff-only. Without this Payload downloads every finished upload back to the server to inspect it.
    allowRestrictedFileTypes: true,
  },
  hooks: {
    beforeChange: [titleFromFile],
    afterChange: [onlyOneTrackPlays],
    afterDelete: [revalidateOnDelete],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: { description: 'Optional name for you. The file name is used if left empty.' },
    },
    {
      name: 'active',
      label: 'Play on the website',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description:
          'Ticked: this track is the background music of the website. Only one track plays, so ticking it unticks the others. Untick it (with no other track ticked) to switch the music off.',
      },
    },
  ],
}
