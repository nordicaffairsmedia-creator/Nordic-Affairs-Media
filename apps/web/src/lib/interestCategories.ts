/**
 * Ticket categories shown on the "Register My Interest" form (pre-registration campaign).
 *
 * These are NOT sellable ticket tiers. They only record what a visitor would prefer,
 * so the organiser can gauge demand before tickets exist. To change a price or add a
 * category, edit this list only; the form, the admin dropdown and the confirmation
 * email all read from it. Prices are in SEK.
 */
export const INTEREST_CURRENCY = 'SEK'

export const interestCategories = [
  { value: 'family4', label: 'Family 4', note: '2 adults + 2 kids', price: 2500 },
  { value: 'family3', label: 'Family 3', note: '2 adults + 1 kid', price: 2000 },
  { value: 'vip', label: 'VIP', note: '', price: 1500 },
  { value: 'gold', label: 'Gold', note: '', price: 999 },
  { value: 'silver', label: 'Silver', note: '', price: 750 },
  { value: 'bronze', label: 'Bronze', note: '', price: 550 },
] as const

export type InterestCategory = (typeof interestCategories)[number]['value']

export const interestCategoryValues = interestCategories.map((c) => c.value) as [
  InterestCategory,
  ...InterestCategory[],
]

/** Human label used in the admin list and emails, e.g. "Family 4 (2 adults + 2 kids), 2500 SEK". */
export function interestCategoryText(value: string): string {
  const c = interestCategories.find((x) => x.value === value)
  if (!c) return value
  return `${c.label}${c.note ? ` (${c.note})` : ''}, ${c.price} ${INTEREST_CURRENCY}`
}
