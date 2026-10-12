import type { CollectionConfig } from 'payload'
import { organizers, hiddenUnless } from '@/access/roles'

/**
 * Discount codes (PRD B-04, A-07). Only staff can see them; the booking API reads
 * them straight from the database and counts each use.
 */
export const PromoCodes: CollectionConfig = {
  slug: 'promo-codes',
  orderable: true,
  admin: {
    group: 'Ticketing', hidden: hiddenUnless('admin'),
    useAsTitle: 'code',
    defaultColumns: ['code', 'discountType', 'amount', 'timesUsed', 'maxUses', 'active'],
  },
  access: { read: organizers, create: organizers, update: organizers, delete: organizers },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'What buyers type, e.g. EARLYBIRD. Stored in capitals.' },
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : value,
        ],
      },
    },
    {
      name: 'description',
      type: 'text',
      admin: { description: 'Internal note (not shown to buyers).' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'discountType',
          type: 'select',
          required: true,
          defaultValue: 'percent',
          options: [
            { label: 'Percent off tickets', value: 'percent' },
            { label: 'Fixed amount off order', value: 'fixed' },
          ],
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
          min: 0,
          admin: { description: '% or amount in the event currency' },
        },
      ],
    },
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      admin: { description: 'Empty = valid for every event.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'validFrom', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'validUntil', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'maxUses', type: 'number', min: 1, admin: { description: 'Empty = unlimited' } },
        { name: 'timesUsed', type: 'number', defaultValue: 0, admin: { readOnly: true } },
      ],
    },
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
  ],
}
