import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { staff } from '@/access/roles'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+[1-9]\d{6,14}$/

/** Clean and check what the ticketing app sends. The app form is public, so nothing is trusted. */
const check: CollectionBeforeValidateHook = ({ data, operation }) => {
  if (operation !== 'create' || !data) return data
  const name = String(data.name ?? '').trim().slice(0, 80)
  const email = String(data.email ?? '').trim().toLowerCase().slice(0, 200)
  const phone = String(data.phone ?? '').replace(/[\s-]/g, '').slice(0, 20)
  if (name.length < 2) throw new Error('Please enter a name.')
  if (!EMAIL.test(email)) throw new Error('Please enter a valid email address.')
  if (!PHONE.test(phone)) throw new Error('Please enter a valid mobile number with country code.')
  return { name, email, phone, locale: String(data.locale ?? 'en').slice(0, 5), consentAt: new Date().toISOString() }
}

/**
 * People who gave their name, email and mobile number before opening the ticketing mobile app.
 * Staff can read and export them; the app can only add a new entry (it cannot read, change or delete anything).
 */
export const AppRegistrations: CollectionConfig = {
  slug: 'app-registrations',
  labels: { singular: 'App sign-up', plural: 'App sign-ups' },
  defaultSort: '-createdAt',
  admin: {
    group: 'Inbox',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'phone', 'createdAt'],
    description:
      'People who entered their name, email and mobile number before opening the ticketing mobile app. Use the Export button above the list for a spreadsheet (CSV).',
  },
  access: {
    read: staff,
    create: () => true, // the app form (checked in the hook above)
    update: staff,
    delete: staff,
  },
  hooks: { beforeValidate: [check] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true, unique: true, index: true },
    { name: 'phone', type: 'text', required: true },
    { name: 'locale', type: 'text', admin: { readOnly: true } },
    {
      name: 'consentAt',
      type: 'date',
      admin: { readOnly: true, description: 'When the visitor agreed to the privacy policy in the app.' },
    },
    {
      name: 'internalNote',
      type: 'textarea',
      access: { create: ({ req }) => Boolean(req.user), read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
    },
  ],
}
