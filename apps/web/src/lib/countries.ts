/** Countries offered in the buyer form: [ISO 3166 code, phone dial code]. Names come from Intl.DisplayNames. */
export const COUNTRIES: readonly [string, string][] = [
  ['SE', '+46'], ['NO', '+47'], ['DK', '+45'], ['FI', '+358'], ['IS', '+354'],
  ['IN', '+91'], ['LK', '+94'], ['GB', '+44'], ['IE', '+353'], ['DE', '+49'],
  ['FR', '+33'], ['NL', '+31'], ['BE', '+32'], ['ES', '+34'], ['IT', '+39'],
  ['PT', '+351'], ['PL', '+48'], ['EE', '+372'], ['LV', '+371'], ['LT', '+370'],
  ['CH', '+41'], ['AT', '+43'], ['US', '+1'], ['CA', '+1'], ['AU', '+61'],
  ['NZ', '+64'], ['AE', '+971'], ['QA', '+974'], ['SA', '+966'], ['KW', '+965'],
  ['OM', '+968'], ['BH', '+973'], ['SG', '+65'], ['MY', '+60'], ['ZA', '+27'],
]

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
