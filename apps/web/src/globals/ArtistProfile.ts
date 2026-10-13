import type { GlobalConfig } from 'payload'
import { anyone, editors } from '@/access/roles'
import { socialPlatforms } from '@/collections/Authors'
import { revalidateGlobal } from '@/lib/revalidate'

/**
 * Editorial profile of the founder as an artist (PRD W-07, master prompt §14).
 * The page at /artist stays hidden until "Show on website" is ticked, so nothing is
 * published before the client has supplied and approved verified facts.
 */
export const ArtistProfile: GlobalConfig = {
  slug: 'artist-profile',
  // Keeps the last 25 saved versions: Versions tab → pick one → Restore.
  versions: { max: 25 },
  typescript: { interface: 'ArtistProfileData' },
  label: 'Artist profile',
  admin: { group: 'Website' },
  access: { read: anyone, update: editors },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Show on website',
      defaultValue: false,
      admin: { description: 'Only tick when every fact below has been approved by the client.' },
    },
    { name: 'name', type: 'text', required: true, defaultValue: 'Artist name' },
    {
      name: 'role',
      type: 'text',
      localized: true,
      admin: { description: 'e.g. Singer · Founder, Nordic Affairs Media' },
    },
    { name: 'portrait', type: 'upload', relationTo: 'media' },
    {
      name: 'intro',
      type: 'textarea',
      localized: true,
      admin: { description: 'Two or three sentences.' },
    },
    { name: 'biography', type: 'richText', localized: true },
    {
      name: 'music',
      type: 'array',
      labels: { singular: 'Release', plural: 'Music' },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'year', type: 'number' },
        {
          name: 'note',
          type: 'text',
          localized: true,
          admin: { description: 'e.g. film, album, composer' },
        },
        {
          name: 'url',
          type: 'text',
          admin: { description: 'Spotify / YouTube / Apple Music link' },
        },
      ],
    },
    {
      name: 'performances',
      type: 'array',
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
        { name: 'date', type: 'date' },
        { name: 'place', type: 'text' },
        { name: 'url', type: 'text' },
      ],
    },
    {
      name: 'press',
      type: 'array',
      fields: [
        { name: 'outlet', type: 'text', required: true },
        { name: 'headline', type: 'text', required: true },
        { name: 'date', type: 'date' },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'videos',
      type: 'array',
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'links',
      type: 'array',
      admin: { description: "Artist's own channels — only accounts that really exist." },
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
    {
      name: 'pressKit',
      type: 'upload',
      relationTo: 'documents',
      admin: { description: 'Optional press kit PDF.' },
    },
  ],
}
