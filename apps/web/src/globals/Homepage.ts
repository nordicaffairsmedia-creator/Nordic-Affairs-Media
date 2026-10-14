import type { GlobalConfig } from 'payload'
import { anyone, editors } from '@/access/roles'
import { revalidateGlobal } from '@/lib/revalidate'

/**
 * Editors decide what the front page shows (master prompt §40). Nothing on the
 * homepage is hard-coded: if a slot is empty the section is simply not rendered.
 */
export const Homepage: GlobalConfig = {
  slug: 'homepage',
  // Keeps the last 25 saved versions: Versions tab → pick one → Restore.
  versions: { max: 25 },
  typescript: { interface: 'HomepageData' },
  admin: { group: 'Website' },
  access: { read: anyone, update: editors },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      type: 'collapsible',
      label: 'Landing slideshow (top of the home page)',
      fields: [
        {
          name: 'heroSlides',
          type: 'upload',
          relationTo: 'media',
          hasMany: true,
          admin: {
            description:
              'Photos that fade one after another behind the title. Empty = the cover photos of the newest galleries. The import fills this with the old website’s slideshow.',
          },
        },
        {
          name: 'heroTitle',
          type: 'text',
          localized: true,
          admin: { description: 'Empty = “Capturing Global Moments” (in each language).' },
        },
        { name: 'heroText', type: 'textarea', localized: true },
        { name: 'heroButtonLabel', type: 'text', localized: true, admin: { description: 'Empty = “Explore More”.' } },
        {
          name: 'heroButtonLink',
          type: 'text',
          admin: { description: 'Page the button opens, e.g. /gallery or /about-us. Empty = /gallery.' },
        },
      ],
    },
    {
      name: 'leadStory',
      type: 'relationship',
      relationTo: 'articles',
      admin: { description: 'The big story at the top. Empty = newest article.' },
    },
    {
      name: 'featured',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      maxRows: 4,
      admin: { description: 'Up to four stories shown beside and under the lead.' },
    },
    { name: 'showLatest', type: 'checkbox', defaultValue: true, label: 'Show "Latest" list' },
    {
      name: 'sections',
      type: 'array',
      labels: { singular: 'Category section', plural: 'Category sections' },
      admin: { description: 'Rows of stories from one category, e.g. Culture, Music, Interviews.' },
      fields: [
        { name: 'category', type: 'relationship', relationTo: 'categories', required: true },
        {
          name: 'heading',
          type: 'text',
          localized: true,
          admin: { description: 'Empty = category name.' },
        },
        {
          name: 'layout',
          type: 'select',
          required: true,
          defaultValue: 'leadWithList',
          options: [
            { label: 'One large story + list', value: 'leadWithList' },
            { label: 'Three columns', value: 'threeUp' },
            { label: 'Horizontal stories', value: 'horizontal' },
          ],
        },
        { name: 'limit', type: 'number', defaultValue: 4, min: 2, max: 8 },
      ],
    },
    { name: 'showEvents', type: 'checkbox', defaultValue: true, label: 'Show upcoming events' },
    {
      name: 'showGalleries',
      type: 'checkbox',
      defaultValue: true,
      label: 'Show latest photo galleries',
    },
    {
      name: 'featuredPublication',
      type: 'relationship',
      relationTo: 'publications',
      admin: { description: 'Empty = newest issue.' },
    },
    { name: 'showNewsletter', type: 'checkbox', defaultValue: true },
  ],
}
