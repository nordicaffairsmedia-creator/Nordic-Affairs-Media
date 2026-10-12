/**
 * Single source of truth for platform languages (PRD W-09).
 *
 * Routing: every public URL is prefixed with its locale (`/en/...`, `/sv/...`,
 * `/ta/...`, `/ml/...`). The CMS stores one document per article with localized
 * fields, so a story keeps one slug and one ID across languages and editors fill in
 * each language when a translation exists. Untranslated fields fall back to English.
 */
export const locales = ['en', 'sv', 'ta', 'ml'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

/** Order of the language switcher, as the client asked: Svenska · English · മലയാളം · தமிழ். */
export const switcherOrder: readonly Locale[] = ['sv', 'en', 'ml', 'ta']

export const localeMeta: Record<
  Locale,
  { label: string; nativeLabel: string; htmlLang: string; ogLocale: string }
> = {
  en: { label: 'English', nativeLabel: 'English', htmlLang: 'en', ogLocale: 'en_GB' },
  sv: { label: 'Swedish', nativeLabel: 'Svenska', htmlLang: 'sv', ogLocale: 'sv_SE' },
  ta: { label: 'Tamil', nativeLabel: 'தமிழ்', htmlLang: 'ta', ogLocale: 'ta_IN' },
  ml: { label: 'Malayalam', nativeLabel: 'മലയാളം', htmlLang: 'ml', ogLocale: 'ml_IN' },
}

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value)
}
