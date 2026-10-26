import type { GlobalConfig } from 'payload'
import { organizers, hiddenUnless } from '@/access/roles'

/** Who marketing email comes from, and the footer the law asks for. */
export const MarketingSettings: GlobalConfig = {
  slug: 'marketing-settings',
  label: 'Marketing settings',
  admin: { group: 'Marketing center', hidden: hiddenUnless('admin'), description: 'Sender and footer of the emails you send from the Marketing center.' },
  access: { read: organizers, update: organizers },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'senderName', type: 'text', defaultValue: 'Nordic Affairs Media', required: true },
        {
          name: 'senderEmail',
          type: 'email',
          label: 'Sender address',
          admin: { description: 'Must be on the verified domain (nordicaffairsmedia.com). Empty = the website\'s default sender (EMAIL_FROM).' },
        },
      ],
    },
    { name: 'replyTo', type: 'email', label: 'Reply-to address', admin: { description: 'Where replies go, e.g. info@nordicaffairsmedia.com.' } },
    { name: 'smsSender', type: 'text', label: 'Text message sender name', admin: { description: 'Up to 11 letters or digits, e.g. NordicAffairs. Empty = the Twilio number (TWILIO_FROM). Some countries do not allow names.' } },
    {
      name: 'footerText',
      type: 'textarea',
      defaultValue: 'Nordic Affairs Media, Sweden',
      admin: { description: 'Shown at the bottom of every email: who you are and where you are.' },
    },
  ],
}
