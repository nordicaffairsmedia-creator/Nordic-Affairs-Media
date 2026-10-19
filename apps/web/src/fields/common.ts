import type { Field, FieldHook } from 'payload'

/** Lower-case, hyphenated, ASCII-only slug. Non-Latin titles need a manual slug. */
export function toSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

const fallbackSlug = () => `item-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const fillSlug =
  (sourceField: string): FieldHook =>
  ({ value, data }) => {
    if (typeof value === 'string' && value.length > 0) return toSlug(value) || fallbackSlug()
    const source: unknown = data?.[sourceField]
    const fromSource = typeof source === 'string' ? toSlug(source) : ''
    // Never leave the address empty (it must be unique), even when no title was typed.
    return fromSource || fallbackSlug()
  }

/**
 * Slug shared by all languages so a story keeps one URL per locale prefix.
 * Kept identical to the old WordPress slug where one exists (SEO continuity).
 */
export function slugField(sourceField = 'title'): Field {
  return {
    name: 'slug',
    type: 'text',
    // Always filled automatically by the hook below, so it can never block a save.
    required: true,
    unique: true,
    index: true,
    admin: {
      position: 'sidebar',
      description:
        'Web address of this item. Filled from the English title if left empty. Keep the old WordPress slug when moving an existing article.',
    },
    hooks: { beforeValidate: [fillSlug(sourceField)] },
  }
}

/** Per-document SEO overrides (master prompt section 22). */
export const seoFields: Field = {
  name: 'seo',
  type: 'group',
  label: 'SEO',
  admin: { description: 'Optional. Leave empty to use the headline, summary and main image.' },
  fields: [
    {
      // Yoast-style checker: traffic-light score, Google preview and a short to-do list.
      name: 'seoCheck',
      type: 'ui',
      admin: { components: { Field: '/components/admin/SeoCheck#SeoCheck' } },
    },
    {
      name: 'focusKeyword',
      type: 'text',
      localized: true,
      admin: { description: 'The word or phrase people would search for, e.g. "Polar Music Prize 2024".' },
    },
    { name: 'title', type: 'text', localized: true, maxLength: 70 },
    { name: 'description', type: 'textarea', localized: true, maxLength: 170 },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'noIndex', type: 'checkbox', label: 'Hide from search engines', defaultValue: false },
  ],
}

/**
 * Marks development placeholder content (master prompt section 41). Anything with
 * this flag renders with a visible "Placeholder" badge and is excluded from the sitemap.
 */
export const placeholderField: Field = {
  name: 'isPlaceholder',
  type: 'checkbox',
  defaultValue: false,
  admin: {
    position: 'sidebar',
    description: 'Development placeholder — never publish to the live site with this ticked.',
  },
}
