import type { GlobalConfig } from 'payload'
import { anyone, hasRole, superadminOnly, hiddenUnless } from '@/access/roles'
import { revalidateGlobal } from '@/lib/revalidate'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  // Keeps the last 25 saved versions: Versions tab → pick one → Restore.
  versions: { max: 25 },
  typescript: { interface: 'SiteSettingsData' },
  admin: { group: 'Settings', hidden: hiddenUnless() },
  access: { read: anyone, update: ({ req }) => hasRole(req.user, 'editor') },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    { name: 'siteName', type: 'text', required: true, defaultValue: 'Nordic Affairs Media' },
    {
      name: 'tagline',
      type: 'text',
      localized: true,
      admin: {
        description:
          'Short line under the logo and in search results. To be agreed with the client.',
      },
    },
    { name: 'description', type: 'textarea', localized: true },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'defaultShareImage', type: 'upload', relationTo: 'media' },
    { name: 'contactEmail', type: 'email' },
    {
      type: 'row',
      fields: [
        { name: 'contactPhone', type: 'text', admin: { description: 'e.g. +46 73 300 26 65' } },
        {
          name: 'whatsapp',
          type: 'text',
          admin: { description: 'Number for the WhatsApp button, digits only, e.g. 46733002665' },
        },
        {
          name: 'location',
          type: 'text',
          localized: true,
          admin: { description: 'e.g. Stockholm, Sweden' },
        },
      ],
    },
    {
      name: 'accreditation',
      type: 'text',
      localized: true,
      admin: {
        description: 'Shown in the footer, e.g. "Accredited by the Swedish Press Association".',
      },
    },
    {
      name: 'stats',
      type: 'array',
      label: 'Key figures',
      maxRows: 6,
      admin: { description: 'Shown on pages with "Show key figures" ticked (e.g. About).' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'value', type: 'text', required: true, admin: { description: 'e.g. 500+' } },
            { name: 'label', type: 'text', required: true, localized: true },
          ],
        },
      ],
    },
    {
      name: 'pressMentions',
      type: 'array',
      label: 'Coverage in the press',
      admin: {
        description:
          'Outlets that published the agency’s work. Shown on pages with "Show press coverage" ticked.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'outlet', type: 'text', required: true },
            { name: 'url', type: 'text', required: true },
          ],
        },
        { name: 'logo', type: 'upload', relationTo: 'media' },
      ],
    },
    { name: 'privacyPage', type: 'relationship', relationTo: 'pages' },
    { name: 'cookiePage', type: 'relationship', relationTo: 'pages' },
  ],
}

/**
 * Business switches for the owner (PRD S-03, S-04, S-09). Read by the booking API
 * and the website. Only SuperAdmin can open this screen.
 */
export const PlatformSettings: GlobalConfig = {
  slug: 'platform-settings',
  typescript: { interface: 'PlatformSettingsData' },
  admin: {
    group: 'Settings', hidden: hiddenUnless(),
    description: 'Owner-only controls for fees, VAT, holds and features.',
  },
  access: { read: superadminOnly, update: superadminOnly },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'defaultCurrency',
          type: 'select',
          options: ['SEK', 'EUR', 'NOK', 'DKK'],
          defaultValue: 'SEK',
        },
        {
          name: 'holdMinutes',
          type: 'number',
          defaultValue: 10,
          min: 3,
          max: 30,
          label: 'Ticket hold (minutes)',
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'bookingFee',
          type: 'number',
          defaultValue: 0,
          min: 0,
          label: 'Booking fee per order',
        },
        {
          name: 'serviceFeePercent',
          type: 'number',
          defaultValue: 0,
          min: 0,
          max: 20,
          label: 'Service fee %',
        },
        {
          name: 'defaultVatRate',
          type: 'number',
          defaultValue: 6,
          min: 0,
          max: 25,
          label: 'Default VAT %',
        },
      ],
    },
    {
      name: 'services',
      type: 'group',
      label: 'Checkout services (My Booking, step 3)',
      admin: {
        description:
          'Optional paid extras. Prices are in the event currency. “Tickets by SMS” and “Event reminder” are only shown to buyers once Twilio is set up on the booking API. “Refund protection” refunds the tickets and fees automatically when the buyer cancels before the event starts.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'smsTicketsEnabled', type: 'checkbox', defaultValue: true, label: 'Tickets by SMS' },
            { name: 'smsTicketsPrice', type: 'number', defaultValue: 15, min: 0, label: 'Price' },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'refundProtectionEnabled', type: 'checkbox', defaultValue: true, label: 'Refund protection (illness)' },
            { name: 'refundProtectionPrice', type: 'number', defaultValue: 13, min: 0, label: 'Price' },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'reminderEnabled', type: 'checkbox', defaultValue: true, label: 'Event reminder SMS' },
            { name: 'reminderPrice', type: 'number', defaultValue: 15, min: 0, label: 'Price' },
          ],
        },
      ],
    },
    {
      name: 'features',
      type: 'group',
      label: 'Feature switches',
      fields: [
        { name: 'ticketSales', type: 'checkbox', defaultValue: true, label: 'Ticket sales open' },
        { name: 'guestCheckout', type: 'checkbox', defaultValue: true },
        { name: 'promoCodes', type: 'checkbox', defaultValue: true },
        { name: 'klarna', type: 'checkbox', defaultValue: true },
        {
          name: 'swish',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Needs Swish activation on Stripe.' },
        },
        { name: 'aiAssistant', type: 'checkbox', defaultValue: false },
        { name: 'newsletter', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'emailTexts',
      type: 'group',
      label: 'Email wording',
      admin: {
        description:
          'Optional. Empty = the standard text. Write each language in its language tab.',
      },
      fields: [
        {
          name: 'ticketsIntro',
          type: 'textarea',
          localized: true,
          label: 'Ticket email — opening paragraph',
        },
        {
          name: 'ticketsFooter',
          type: 'textarea',
          localized: true,
          label: 'Ticket email — closing line',
        },
        {
          name: 'newsletterConfirm',
          type: 'textarea',
          localized: true,
          label: 'Newsletter confirmation email',
        },
      ],
    },
    {
      name: 'assistant',
      type: 'group',
      label: 'AI assistant',
      fields: [
        {
          name: 'tone',
          type: 'textarea',
          admin: { description: 'How the assistant should sound.' },
        },
        {
          name: 'knowledge',
          type: 'richText',
          admin: { description: 'Facts the assistant may use (FAQs, policies).' },
        },
        { name: 'handoverEmail', type: 'email' },
        { name: 'handoverWhatsapp', type: 'text' },
      ],
    },
  ],
}
