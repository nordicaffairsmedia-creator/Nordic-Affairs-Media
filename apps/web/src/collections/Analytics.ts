import type { CollectionConfig } from 'payload'
import { hasRole } from '@/access/roles'

/*
 * The website's own visitor counter and sign-in log — the parts of Site Kit / Google
 * Analytics and "Limit Login Attempts" the old WordPress panel showed as graphs.
 * Both are written by the system only and shown as charts on the dashboard.
 */

/** Page views per day and page. No cookies and nothing about the visitor is stored. */
export const PageViews: CollectionConfig = {
  slug: 'page-views',
  admin: { hidden: true, useAsTitle: 'path' },
  access: {
    read: ({ req }) => hasRole(req.user, 'admin'),
    create: () => false,
    update: () => false,
    delete: ({ req }) => hasRole(req.user),
  },
  fields: [
    { name: 'day', type: 'text', required: true, index: true },
    { name: 'path', type: 'text', required: true, index: true },
    { name: 'views', type: 'number', defaultValue: 0 },
    { name: 'visits', type: 'number', defaultValue: 0 },
  ],
}

/** Every sign-in to the content manager or staff suite, successful or not. */
export const LoginEvents: CollectionConfig = {
  slug: 'login-events',
  labels: { singular: 'Sign-in', plural: 'Sign-in log' },
  admin: {
    group: 'Users & security',
    hidden: ({ user }) => !hasRole(user as never),
    useAsTitle: 'email',
    defaultColumns: ['email', 'ok', 'source', 'ip', 'createdAt'],
    description: 'Every sign-in attempt. Accounts lock for 10 minutes after 5 wrong passwords.',
  },
  access: {
    read: ({ req }) => hasRole(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => hasRole(req.user),
  },
  fields: [
    { name: 'email', type: 'text', index: true },
    { name: 'ok', type: 'checkbox', label: 'Signed in', defaultValue: false, index: true },
    { name: 'source', type: 'text' },
    { name: 'ip', type: 'text' },
  ],
}
