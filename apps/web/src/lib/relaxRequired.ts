import type { CollectionConfig, Field, GlobalConfig } from 'payload'

/**
 * The admin must never block a save because a box is empty. Fields keep their
 * `required: true` (so the code that reads them can rely on the value's type), but this
 * switches off the "required" check and drops minimum row counts. The red asterisk is
 * hidden in custom.scss. Sign-in (Users), the public enquiry/subscribe forms (validated by
 * their own routes) and promo codes (a code is the whole point) are left as they are.
 */
const KEEP = new Set(['users', 'enquiries', 'subscribers', 'promo-codes', 'audit-log', 'page-views', 'login-events'])

const always = () => true

function relaxFields(fields: Field[] | undefined): void {
  for (const f of fields ?? []) {
    const field = f as Field & Record<string, unknown>
    if ('required' in field && field.required === true && !field.validate) {
      field.validate = always
    }
    if (field.type === 'array' && 'minRows' in field) delete (field as Record<string, unknown>).minRows
    if ('fields' in field) relaxFields(field.fields as Field[])
    if (field.type === 'tabs') for (const tab of field.tabs) relaxFields(tab.fields)
    if (field.type === 'blocks') for (const block of field.blocks) relaxFields(block.fields)
  }
}

export function relaxCollection<T extends CollectionConfig>(c: T): T {
  if (!KEEP.has(c.slug)) relaxFields(c.fields)
  return c
}

export function relaxGlobal<T extends GlobalConfig>(g: T): T {
  relaxFields(g.fields)
  return g
}
