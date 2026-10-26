import type { CollectionConfig } from 'payload'
import { organizers, hiddenUnless } from '@/access/roles'

/** One Facebook and Instagram ad for one event: pick the event, a budget and dates; Meta runs it. */
export const EventAds: CollectionConfig = {
  slug: 'event-ads',
  labels: { singular: 'Event ad', plural: 'Event ads' },
  admin: {
    group: 'Marketing center',
    hidden: hiddenUnless('admin'),
    useAsTitle: 'name',
    defaultColumns: ['name', 'event', 'status', 'impressions', 'clicks', 'spend'],
    description: 'Reach more guests with ads on Facebook and Instagram. Pick an event and a budget. Connect your Facebook Page first (Advertising: Facebook connection).',
  },
  access: { read: organizers, create: organizers, update: organizers, delete: organizers },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) return data
        const d = data as Record<string, unknown>
        if (!d.name && d.event) {
          const ev = await req.payload.findByID({ collection: 'events', id: d.event as string, depth: 0, overrideAccess: true }).catch(() => null)
          if (ev) d.name = `Ad: ${ev.title}`
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'event', type: 'relationship', relationTo: 'events', required: true },
    { name: 'name', type: 'text', admin: { description: 'Only you see this. Made from the event if empty.' } },
    { name: 'headline', type: 'text', maxLength: 40, admin: { description: 'Bold line on the ad (40 letters). Empty = the event title.' } },
    { name: 'message', type: 'textarea', required: true, maxLength: 300, admin: { description: 'The text above the picture. Mention the date and "Tickets are out now".' } },
    {
      type: 'row',
      fields: [
        { name: 'dailyBudget', type: 'number', required: true, min: 1, defaultValue: 100, label: 'Daily budget', admin: { description: 'In the currency of your ad account (e.g. SEK per day). Meta has a minimum.' } },
        { name: 'startDate', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'endDate', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Usually the day before the event.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'countries', type: 'text', defaultValue: 'SE', admin: { description: 'Two-letter country codes, separated by comma. SE = Sweden.' } },
        { name: 'ageMin', type: 'number', defaultValue: 18, min: 18, max: 65 },
        { name: 'ageMax', type: 'number', defaultValue: 65, min: 18, max: 65 },
      ],
    },
    { name: 'actions', type: 'ui', admin: { components: { Field: '/components/admin/AdActions#AdActions' } } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      admin: { readOnly: true, position: 'sidebar' },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Running', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Error', value: 'error' },
      ],
    },
    { name: 'metaStatus', type: 'text', admin: { readOnly: true, position: 'sidebar', description: 'What Meta says (e.g. ACTIVE, IN_REVIEW, WITH_ISSUES).' } },
    { name: 'errorMessage', type: 'textarea', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'impressions', type: 'number', defaultValue: 0, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'reach', type: 'number', defaultValue: 0, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'clicks', type: 'number', defaultValue: 0, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'spend', type: 'number', defaultValue: 0, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'metaCampaignId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'metaAdId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
