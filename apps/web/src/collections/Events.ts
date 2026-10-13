import type { CollectionConfig } from 'payload'
import { organizers, publishedOrStaff, hiddenUnless } from '@/access/roles'
import { placeholderField, seoFields, slugField } from '@/fields/common'
import { revalidateOnChange, revalidateOnDelete } from '@/lib/revalidate'

export const currencies = ['SEK', 'EUR', 'NOK', 'DKK'] as const

/**
 * Events and their ticket tiers (PRD W-05/06, A-01/A-02).
 *
 * Ticket *definitions* live here so organizers manage them in the same screen as the
 * event. Live stock (sold / held) is owned by the booking API (apps/api) in its own
 * collections, so a CMS edit can never overwrite a sale in progress. Each tier has a
 * stable `tierId` the booking API keys its stock on.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  orderable: true,
  admin: {
    group: 'Ticketing', hidden: hiddenUnless('admin'),
    useAsTitle: 'title',
    defaultColumns: ['title', 'startsAt', 'venue', '_status'],
  },
  access: { read: publishedOrStaff, create: organizers, update: organizers, delete: organizers },
  versions: { drafts: true },
  hooks: { afterChange: [revalidateOnChange], afterDelete: [revalidateOnDelete] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'summary', type: 'textarea', localized: true },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Details',
          fields: [
            { name: 'poster', type: 'upload', relationTo: 'media', required: true },
            { name: 'trailerUrl', type: 'text' },
            { name: 'description', type: 'richText', localized: true },
            {
              name: 'lineup',
              type: 'array',
              fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'role', type: 'text', localized: true },
              ],
            },
          ],
        },
        {
          label: 'Tickets',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'currency',
                  type: 'select',
                  options: [...currencies],
                  defaultValue: 'SEK',
                  required: true,
                },
                {
                  name: 'vatRate',
                  type: 'number',
                  defaultValue: 6,
                  min: 0,
                  max: 25,
                  admin: {
                    description:
                      'VAT (moms) % on tickets. Confirm the correct rate with the accountant.',
                  },
                },
                { name: 'maxPerOrder', type: 'number', defaultValue: 10, min: 1 },
              ],
            },
            {
              name: 'tiers',
              type: 'array',
              labels: { singular: 'Ticket tier', plural: 'Ticket tiers' },
              admin: {
                description: 'e.g. Regular, VIP, Family, Child — or a venue zone such as Balcony.',
              },
              fields: [
                {
                  name: 'tierId',
                  type: 'text',
                  required: true,
                  admin: {
                    readOnly: true,
                    description: 'Internal ID used for stock. Set automatically.',
                  },
                  hooks: {
                    beforeValidate: [
                      ({ value }) =>
                        typeof value === 'string' && value.length > 0 ? value : crypto.randomUUID(),
                    ],
                  },
                },
                { name: 'name', type: 'text', required: true, localized: true },
                { name: 'description', type: 'text', localized: true },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'price',
                      type: 'number',
                      required: true,
                      min: 0,
                      defaultValue: 0,
                      admin: { description: 'Incl. VAT' },
                    },
                    { name: 'quantity', type: 'number', required: true, min: 0, defaultValue: 0 },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'salesStart',
                      type: 'date',
                      admin: { date: { pickerAppearance: 'dayAndTime' } },
                    },
                    {
                      name: 'salesEnd',
                      type: 'date',
                      admin: { date: { pickerAppearance: 'dayAndTime' } },
                    },
                  ],
                },
              ],
            },
          ],
        },
        { label: 'SEO', fields: [seoFields] },
      ],
    },
    slugField(),
    {
      name: 'startsAt',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Leave empty while the date is not confirmed: the event shows “Date to be announced” and tickets open once a date is set.',
      },
    },
    {
      name: 'endsAt',
      type: 'date',
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'venue',
      type: 'relationship',
      relationTo: 'venues',
      admin: { position: 'sidebar', description: 'Can be added later.' },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'event-categories',
      admin: { position: 'sidebar' },
    },
    {
      name: 'eventLanguage',
      type: 'select',
      hasMany: true,
      admin: { position: 'sidebar', description: 'Language(s) the event is held in.' },
      options: [
        { label: 'English', value: 'en' },
        { label: 'Swedish', value: 'sv' },
        { label: 'Tamil', value: 'ta' },
        { label: 'Malayalam', value: 'ml' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'organizer',
      type: 'relationship',
      relationTo: 'organizers',
      admin: {
        position: 'sidebar',
        description:
          'Only for events run by an outside partner — their commission is shown in Staff → Reports.',
      },
    },
    {
      name: 'gateStaff',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description: 'Who may scan tickets at the door for this event (PRD A-07).',
      },
      filterOptions: { roles: { in: ['gate', 'admin'] } },
    },
    {
      name: 'salesStatus',
      type: 'select',
      defaultValue: 'onSale',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Announced (not on sale yet)', value: 'announced' },
        { label: 'On sale', value: 'onSale' },
        { label: 'Sold out', value: 'soldOut' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    placeholderField,
  ],
}
