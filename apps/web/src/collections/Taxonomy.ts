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
    { name: 'capacity', type: 'number', min: 1 },
    { name: 'accessInfo', type: 'textarea', localized: true, label: 'Access & parking info' },
  ],
}
