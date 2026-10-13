import type { Field, GlobalConfig } from 'payload'
import { anyone, editors } from '@/access/roles'
import { socialPlatforms } from '@/collections/Authors'
import { revalidateGlobal } from '@/lib/revalidate'

const linkFields: Field[] = [
  { name: 'label', type: 'text', required: true, localized: true },
  {
    name: 'href',
    type: 'text',
    required: true,
    admin: {
      description:
        'Path without language, e.g. /events or /category/culture. Full URL for external links.',
    },
  },
]

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  // Keeps the last 25 saved versions: Versions tab → pick one → Restore.
  versions: { max: 25 },
  typescript: { interface: 'NavigationData' },
  admin: { group: 'Website' },
  access: { read: anyone, update: editors },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    { name: 'primary', type: 'array', maxRows: 8, fields: linkFields },
    {
      name: 'footerColumns',
      type: 'array',
      maxRows: 4,
      fields: [
        { name: 'heading', type: 'text', required: true, localized: true },
        { name: 'links', type: 'array', fields: linkFields },
      ],
    },
    {
      name: 'social',
      type: 'array',
      admin: {
        description: 'Only accounts Nordic Affairs Media actually uses (master prompt §28).',
      },
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: socialPlatforms.map((p) => ({ label: p, value: p })),
        },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ],
}
