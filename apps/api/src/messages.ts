import type { Locale } from './catalog.js'

/**
 * Text used in emails, in the buyer's language.
 * Swedish, Tamil and Malayalam are drafts for native review before launch.
 */
const m = {
  en: {
    ticketsSubject: 'Your tickets',
    hello: 'Hello',
    ticketsIntro:
      'Thank you for your booking. Your tickets are attached as a PDF — show the QR code at the entrance, on your phone or printed.',
    viewOnline: 'View your tickets online',
    order: 'Order',
    date: 'Date',
    venue: 'Venue',
    total: 'Total paid',
    help: 'Questions? Just reply to this email.',
    codeSubject: 'Your sign-in code',
    codeIntro: 'Use this code to see your bookings. It works for 10 minutes.',
    codeIgnore: "If you didn't ask for this, you can ignore this email.",
  },
  sv: {
    ticketsSubject: 'Dina biljetter',
    hello: 'Hej',
    ticketsIntro:
      'Tack för din bokning. Dina biljetter finns som bifogad PDF — visa QR-koden vid entrén, i mobilen eller utskriven.',
    viewOnline: 'Visa dina biljetter online',
    order: 'Order',
    date: 'Datum',
    venue: 'Plats',
    total: 'Totalt betalt',
    help: 'Frågor? Svara bara på detta mejl.',
    codeSubject: 'Din inloggningskod',
    codeIntro: 'Använd koden för att se dina bokningar. Den gäller i 10 minuter.',
    codeIgnore: 'Om du inte har bett om detta kan du ignorera mejlet.',
  },
  ta: {
    ticketsSubject: 'உங்கள் டிக்கெட்டுகள்',
    hello: 'வணக்கம்',
    ticketsIntro:
      'முன்பதிவுக்கு நன்றி. உங்கள் டிக்கெட்டுகள் PDF ஆக இணைக்கப்பட்டுள்ளன — நுழைவாயிலில் QR குறியீட்டைக் காட்டுங்கள்.',
    viewOnline: 'டிக்கெட்டுகளை ஆன்லைனில் பார்க்க',
    order: 'ஆர்டர்',
    date: 'தேதி',
    venue: 'இடம்',
    total: 'செலுத்திய தொகை',
    help: 'கேள்விகள் இருந்தால் இந்த மின்னஞ்சலுக்குப் பதிலளிக்கவும்.',
    codeSubject: 'உங்கள் உள்நுழைவுக் குறியீடு',
    codeIntro:
      'உங்கள் முன்பதிவுகளைப் பார்க்க இந்தக் குறியீட்டைப் பயன்படுத்துங்கள். இது 10 நிமிடங்கள் செல்லுபடியாகும்.',
    codeIgnore: 'நீங்கள் இதைக் கேட்கவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கலாம்.',
  },
  ml: {
    ticketsSubject: 'നിങ്ങളുടെ ടിക്കറ്റുകൾ',
    hello: 'നമസ്കാരം',
    ticketsIntro:
      'ബുക്കിംഗിന് നന്ദി. നിങ്ങളുടെ ടിക്കറ്റുകൾ PDF ആയി ചേർത്തിരിക്കുന്നു — പ്രവേശന കവാടത്തിൽ QR കോഡ് കാണിക്കുക.',
    viewOnline: 'ടിക്കറ്റുകൾ ഓൺലൈനിൽ കാണുക',
    order: 'ഓർഡർ',
    date: 'തീയതി',
    venue: 'വേദി',
    total: 'അടച്ച തുക',
    help: 'സംശയങ്ങളുണ്ടെങ്കിൽ ഈ ഇമെയിലിന് മറുപടി നൽകുക.',
    codeSubject: 'നിങ്ങളുടെ സൈൻ-ഇൻ കോഡ്',
    codeIntro: 'നിങ്ങളുടെ ബുക്കിംഗുകൾ കാണാൻ ഈ കോഡ് ഉപയോഗിക്കുക. ഇത് 10 മിനിറ്റ് സാധുവാണ്.',
    codeIgnore: 'നിങ്ങൾ ഇത് ആവശ്യപ്പെട്ടില്ലെങ്കിൽ ഈ ഇമെയിൽ അവഗണിക്കാം.',
  },
} satisfies Record<Locale, Record<string, string>>

export type Messages = (typeof m)['en']
export const messages = (locale: Locale): Messages => m[locale]

export const intlLocale: Record<Locale, string> = {
  en: 'en-GB',
  sv: 'sv-SE',
  ta: 'ta-IN',
  ml: 'ml-IN',
}

export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Stockholm',
  }).format(date)
}
