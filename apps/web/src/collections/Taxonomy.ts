import type { CollectionConfig } from 'payload'
import { anyone, editors, organizers, hiddenUnless } from '@/access/roles'
import { slugField } from '@/fields/common'

/**
 * Editorial categories. Deliberately empty at launch: the final list is decided from
 * the client's existing WordPress categories and magazine PDFs (master prompt §10),
 * not invented up front.
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  orderable: true,
  admin: {
    group: 'Posts & galleries',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'showInNav'],
  },
  access: { read: anyone, create: editors, update: editors, delete: editors },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'description', type: 'textarea', localized: true },
    { name: 'showInNav', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    { name: 'navOrder', type: 'number', defaultValue: 100, admin: { position: 'sidebar' } },
  ],
}

export const Tags: CollectionConfig = {
  slug: 'tags',
  orderable: true,
  admin: { group: 'Posts & galleries', useAsTitle: 'title' },
  access: { read: anyone, create: editors, update: editors, delete: editors },
  fields: [{ name: 'title', type: 'text', required: true, localized: true }, slugField()],
}

export const EventCategories: CollectionConfig = {
  slug: 'event-categories',
  orderable: true,
  admin: { group: 'Ticketing', hidden: hiddenUnless('admin'), useAsTitle: 'title' },
  access: { read: anyone, create: organizers, update: organizers, delete: organizers },
  fields: [{ name: 'title', type: 'text', required: true, localized: true }, slugField()],
}

export const Venues: CollectionConfig = {
  slug: 'venues',
  orderable: true,
  admin: { group: 'Ticketing', hidden: hiddenUnless('admin'), useAsTitle: 'name', defaultColumns: ['name', 'city', 'capacity'] },
  access: { read: anyone, create: organizers, update: organizers, delete: organizers },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'address', type: 'textarea', required: true },
    { name: 'city', type: 'text', required: true, index: true },
    { name: 'country', type: 'text', defaultValue: 'Sweden' },
    { name: 'mapUrl', type: 'text', admin: { description: 'Link to Google/Apple Maps.' } },
    {
      type: 'row',
      fields: [
        { name: 'latitude', type: 'number', min: -90, max: 90, admin: { description: 'Optional. Real venue latitude, e.g. 59.3293. Needed for the map view; events without it are listed but not pinned.' } },
        { name: 'longitude', type: 'number', min: -180, max: 180, admin: { description: 'Optional. Real venue longitude, e.g. 18.0686.' } },
      ],
    },
    { name: 'capacity', type: 'number', min: 1 },
    {
      name: 'seatingPlan',
      type: 'group',
      label: 'Seating plan (reserved seats)',
      admin: {
        description:
          'Only for venues with numbered seats. Add sections (e.g. Stalls, Balcony), each made of rows × seats. Then set an event at this venue to “Reserved seats” (event → Tickets tab) and give each ticket tier the section codes it sells. Buyers then pick exact seats on a map. Leave empty for standing or general-admission venues.',
      },
      fields: [
        { name: 'stageLabel', type: 'text', defaultValue: 'Stage', admin: { description: 'Shown above the seats, e.g. Stage or Screen.' } },
        {
          name: 'sections',
          type: 'array',
          labels: { singular: 'Section', plural: 'Sections' },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'code', type: 'text', required: true, admin: { description: 'Short code, letters/digits, e.g. A or BAL. Tickets refer to it.' } },
                { name: 'name', type: 'text', required: true, admin: { description: 'Shown to buyers, e.g. Stalls.' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'rows', type: 'number', required: true, min: 1, max: 60, defaultValue: 10 },
                { name: 'seatsPerRow', type: 'number', required: true, min: 1, max: 100, defaultValue: 12 },
                { name: 'firstRow', type: 'text', defaultValue: 'A', admin: { description: 'Letter of the first row (front). Rows continue A, B, C …' } },
              ],
            },
            { name: 'aisleAfter', type: 'text', admin: { description: 'Optional. Seat numbers after which a walkway is drawn, e.g. 6, 18.' } },
            { name: 'unavailable', type: 'text', admin: { description: 'Optional. Seats that do not exist or are not for sale, row letter + number, e.g. A1, A2, F7.' } },
          ],
        },
      ],
    },
    { name: 'accessInfo', type: 'textarea', localized: true, label: 'Access & parking info' },
  ],
}
