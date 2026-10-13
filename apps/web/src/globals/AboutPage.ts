import type { Field, GlobalConfig } from 'payload'
import { anyone, editors } from '@/access/roles'
import { revalidateGlobal } from '@/lib/revalidate'

/** Icons the About page can show (drawn from the website's own icon set). */
export const aboutIcons = [
  { label: 'Government building', value: 'landmark' },
  { label: 'Crown', value: 'crown' },
  { label: 'Globe', value: 'globe' },
  { label: 'People', value: 'users' },
  { label: 'Trophy', value: 'trophy' },
  { label: 'Celebration', value: 'sparkles' },
  { label: 'Award', value: 'award' },
  { label: 'Eye', value: 'eye' },
  { label: 'Camera', value: 'camera' },
  { label: 'Map pin', value: 'map-pin' },
] as const

const icon: Field = {
  name: 'icon',
  type: 'select',
  options: aboutIcons.map((i) => ({ label: i.label, value: i.value })),
  defaultValue: 'globe',
}

const text = (name: string, label: string, textarea = false): Field =>
  textarea
    ? { name, label, type: 'textarea', localized: true }
    : { name, label, type: 'text', localized: true }

/**
 * The About Us page (/about-us), laid out in sections like the agency's original site.
 * Anything left empty shows the text from the old website.
 */
export const AboutPage: GlobalConfig = {
  slug: 'about-page',
  // Keeps the last 25 saved versions: Versions tab → pick one → Restore.
  versions: { max: 25 },
  typescript: { interface: 'AboutPageData' },
  label: 'About page',
  admin: {
    group: 'Website',
    description: 'Empty fields show the wording from the old website.',
  },
  access: { read: anyone, update: editors },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Introduction',
          fields: [
            text('title', 'Headline'),
            {
              name: 'paragraphs',
              type: 'array',
              labels: { singular: 'Paragraph', plural: 'Paragraphs' },
              fields: [text('text', 'Text', true)],
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Optional photo beside the introduction.' },
            },
          ],
        },
        {
          label: 'Expertise',
          fields: [
            text('expertiseEyebrow', 'Small heading'),
            text('expertiseTitle', 'Heading'),
            {
              name: 'expertise',
              type: 'array',
              fields: [text('label', 'Label'), icon],
            },
          ],
        },
        {
          label: 'Events covered',
          fields: [
            text('eventsTitle', 'Heading'),
            text('eventsIntro', 'Introduction', true),
            { name: 'events', type: 'array', fields: [text('label', 'Event')] },
            text('ministersTitle', 'Ministers heading'),
            { name: 'ministers', type: 'array', fields: [text('name', 'Name')] },
            text('ministersNote', 'Closing line'),
          ],
        },
        {
          label: 'Values',
          fields: [
            {
              name: 'pillars',
              type: 'array',
              maxRows: 3,
              fields: [text('title', 'Title'), text('text', 'Text', true), icon],
            },
          ],
        },
        {
          label: 'Closing',
          fields: [text('ctaTitle', 'Heading'), text('ctaText', 'Text', true)],
        },
      ],
    },
  ],
}
