import type { Locale } from '@/i18n/config'

export const intlLocales: Record<Locale, string> = {
  en: 'en-GB',
  sv: 'sv-SE',
  ta: 'ta-IN',
  ml: 'ml-IN',
}

/** Dates are shown in Swedish time — events happen in Sweden, regardless of the reader's location. */
const TIME_ZONE = 'Europe/Stockholm'

export function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return ''
  return new Intl.DateTimeFormat(intlLocales[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(value))
}

const TBA: Record<Locale, { short: string; full: string }> = {
  en: { short: 'TBA', full: 'Date to be announced' },
  sv: { short: 'TBA', full: 'Datum meddelas senare' },
  ta: { short: 'TBA', full: 'தேதி விரைவில் அறிவிக்கப்படும்' },
  ml: { short: 'TBA', full: 'തീയതി ഉടൻ പ്രഖ്യാപിക്കും' },
}

/** Event date for display; an event without a confirmed date shows "Date to be announced". */
export function formatEventDate(
  value: string | null | undefined,
  locale: Locale,
): { day: string; month: string; full: string } {
  if (!value) return { day: '', month: TBA[locale].short, full: TBA[locale].full }
  const date = new Date(value)
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intlLocales[locale], { timeZone: TIME_ZONE, ...opts }).format(date)
  return {
    day: fmt({ day: 'numeric' }),
    month: fmt({ month: 'short' }),
    full: fmt({
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

export function formatPrice(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocales[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

/** Minimal shape of a Lexical node — enough to walk text content. */
function collectText(node: unknown): string {
  if (typeof node !== 'object' || node === null) return ''
  const { text, children } = node as { text?: unknown; children?: unknown }
  const own = typeof text === 'string' ? text : ''
  const kids = Array.isArray(children) ? children.map(collectText).join(' ') : ''
  return `${own} ${kids}`
}

/** Reading time at ~220 words per minute, minimum one minute. Accepts Lexical rich text. */
export function readingMinutes(body: unknown): number {
  if (typeof body !== 'object' || body === null || !('root' in body)) return 1
  const words = collectText(body.root).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}
