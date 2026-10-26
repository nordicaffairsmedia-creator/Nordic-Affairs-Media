import type { GlobalConfig } from 'payload'
import { organizers, hiddenUnless } from '@/access/roles'

/** The Facebook Page and ad account the website runs ads as. Connected with "Continue with Facebook". */
export const AdvertisingSettings: GlobalConfig = {
  slug: 'advertising-settings',
  label: 'Advertising: Facebook connection',
  admin: {
    group: 'Marketing center',
    hidden: hiddenUnless('admin'),
    description: 'Connect your Facebook Page, then create ads for your events under "Event ads". Ads run on Facebook and Instagram as your page.',
  },
  access: { read: organizers, update: organizers },
  fields: [
    { name: 'connect', type: 'ui', admin: { components: { Field: '/components/admin/AdsConnect#AdsConnect' } } },
    {
      type: 'row',
      fields: [
        { name: 'pageId', type: 'text', label: 'Facebook Page ID', admin: { description: 'Filled in when you connect. Or type it in yourself.' } },
        { name: 'pageName', type: 'text', admin: { readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'adAccountId', type: 'text', label: 'Ad account ID', admin: { description: 'Numbers only (with or without act_). Meta bills the payment method of this ad account.' } },
        { name: 'adAccountName', type: 'text', admin: { readOnly: true } },
      ],
    },
    {
      name: 'accessToken',
      type: 'text',
      label: 'Access token',
      access: { read: () => false },
      admin: { description: 'Saved when you connect. Never shown again. You can also paste a token from Meta Business Suite instead of connecting.' },
    },
    { name: 'tokenExpiresAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'connectedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'pagesFound', type: 'textarea', label: 'Pages you manage', admin: { readOnly: true, description: 'Copy the ID of the page you want into "Facebook Page ID".' } },
    { name: 'adAccountsFound', type: 'textarea', label: 'Ad accounts you manage', admin: { readOnly: true } },
  ],
}
