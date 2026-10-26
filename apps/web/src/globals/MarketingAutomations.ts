import type { GlobalConfig } from 'payload'
import { organizers, hiddenUnless } from '@/access/roles'

/*
 * Automations: emails that send themselves when something happens. You decide whether, and when.
 * Today: the "left the checkout" reminder. The booking server (Render) reads these settings and sends the emails.
 */
export const MarketingAutomations: GlobalConfig = {
  slug: 'marketing-automations',
  label: 'Automations',
  admin: {
    group: 'Marketing center',
    hidden: hiddenUnless('admin'),
    description: 'Emails that send themselves when something happens. You decide whether, and when.',
  },
  access: { read: organizers, update: organizers },
  fields: [
    {
      name: 'abandoned',
      type: 'group',
      label: 'Left the checkout reminder',
      admin: { description: 'An email to buyers who picked tickets, said yes to marketing and did not pay, with a button back to the event.' },
      fields: [
        { name: 'enabled', type: 'checkbox', label: 'Send the reminder', defaultValue: false },
        {
          name: 'waitHours',
          type: 'select',
          label: 'Wait before the email sends',
          defaultValue: '1',
          options: [
            { label: '1 hour', value: '1' },
            { label: '2 hours', value: '2' },
            { label: '3 hours', value: '3' },
            { label: '6 hours', value: '6' },
            { label: '12 hours', value: '12' },
            { label: '24 hours', value: '24' },
          ],
        },
        {
          name: 'discountCode',
          type: 'text',
          label: 'Discount in the reminder (optional)',
          admin: { description: 'A code from Ticketing → Promo codes. Prefer one that is only valid for a short time: people can learn to leave the checkout to get a discount. Empty = no discount.' },
        },
        { name: 'rules', type: 'ui', admin: { components: { Field: '/components/admin/AbandonedRules#AbandonedRules' } } },
        { name: 'stats', type: 'ui', admin: { components: { Field: '/components/admin/AbandonedStats#AbandonedStats' } } },
        { name: 'test', type: 'ui', admin: { components: { Field: '/components/admin/AbandonedTest#AbandonedTest' } } },
        { name: 'preview', type: 'ui', admin: { components: { Field: '/components/admin/AbandonedPreview#AbandonedPreview' } } },
      ],
    },
  ],
}
