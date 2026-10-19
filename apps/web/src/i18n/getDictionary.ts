import 'server-only'
import type { Locale } from './config'
import type { Dictionary } from './dictionaries/en'
import { en } from './dictionaries/en'
import { sv } from './dictionaries/sv'
import { ta } from './dictionaries/ta'
import { ml } from './dictionaries/ml'

const dictionaries: Record<Locale, Dictionary> = { en, sv, ta, ml }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}
