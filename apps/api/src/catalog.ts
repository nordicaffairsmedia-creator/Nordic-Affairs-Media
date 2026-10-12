import { ObjectId, type Document } from 'mongodb'
import { getDb } from './db.js'

/**
 * Read-only view of what organizers set up in the CMS (Payload stores its data in
 * the same MongoDB). Payload keeps translated fields as { en: '…', sv: '…' }; the
 * helpers below pick the reader's language with English as the fallback.
 */
export type Locale = 'en' | 'sv' | 'ta' | 'ml'
export const LOCALES: readonly Locale[] = ['en', 'sv', 'ta', 'ml']

type Localized = string | Partial<Record<Locale, string>> | null | undefined

export function pick(value: Localized, locale: Locale): string {
  if (typeof value === 'string') return value
  if (!value) return ''
  return value[locale] ?? value.en ?? Object.values(value).find(Boolean) ?? ''
}

export type Tier = {
  tierId: string
  name: Localized
  description?: Localized
  price: number
  quantity: number
  salesStart?: Date | string | null
  salesEnd?: Date | string | null
}

export type CatalogEvent = {
  _id: ObjectId
  title: Localized
  slug: string
  startsAt: Date
  currency: 'SEK' | 'EUR' | 'NOK' | 'DKK'
  vatRate?: number | null
  maxPerOrder?: number | null
  salesStatus?: 'announced' | 'onSale' | 'soldOut' | 'cancelled' | null
  tiers?: Tier[] | null
  venue?: ObjectId | string | null
  _status?: 'draft' | 'published'
}

export type PlatformSettings = {
  holdMinutes: number
  bookingFee: number
  serviceFeePercent: number
  defaultVatRate: number
  features: {
    ticketSales: boolean
    guestCheckout: boolean
    promoCodes: boolean
  }
}

export type PromoCode = {
  _id: ObjectId
  code: string
  discountType: 'percent' | 'fixed'
  amount: number
  event?: ObjectId | string | null
  maxUses?: number | null
  timesUsed?: number | null
  validFrom?: Date | null
  validUntil?: Date | null
  active?: boolean | null
}

function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null
}

export async function findPublishedEvent(id: string): Promise<CatalogEvent | null> {
  const _id = toObjectId(id)
  if (!_id) return null
  return getDb().collection<CatalogEvent>('events').findOne({ _id, _status: 'published' })
}

export async function getVenueName(id: CatalogEvent['venue']): Promise<string> {
  if (!id) return ''
  const _id = typeof id === 'string' ? toObjectId(id) : id
  if (!_id) return ''
  const venue = await getDb().collection<Document>('venues').findOne({ _id })
  return venue ? [venue.name, venue.city].filter(Boolean).join(', ') : ''
}

/** Owner-controlled switches (CMS → Settings → Platform settings), with safe defaults. */
export async function getSettings(): Promise<PlatformSettings> {
  const doc = await getDb()
    .collection<Document>('globals')
    .findOne({ globalType: 'platform-settings' })
  const f = (doc?.features ?? {}) as Record<string, unknown>
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
  return {
    holdMinutes: Math.min(30, Math.max(3, num(doc?.holdMinutes, 10))),
    bookingFee: Math.max(0, num(doc?.bookingFee, 0)),
    serviceFeePercent: Math.min(20, Math.max(0, num(doc?.serviceFeePercent, 0))),
    defaultVatRate: num(doc?.defaultVatRate, 6),
    features: {
      ticketSales: bool(f.ticketSales, true),
      guestCheckout: bool(f.guestCheckout, true),
      promoCodes: bool(f.promoCodes, true),
    },
  }
}

export async function findPromo(code: string): Promise<PromoCode | null> {
  return getDb().collection<PromoCode>('promo-codes').findOne({ code: code.trim().toUpperCase() })
}

/** Counts a promo use only if it is still under its limit (atomic). */
export async function claimPromoUse(promo: PromoCode): Promise<boolean> {
  const filter: Document = { _id: promo._id }
  if (promo.maxUses)
    filter.$or = [{ timesUsed: { $lt: promo.maxUses } }, { timesUsed: { $exists: false } }]
  const res = await getDb()
    .collection('promo-codes')
    .updateOne(filter, { $inc: { timesUsed: 1 } })
  return res.modifiedCount === 1
}

export async function releasePromoUse(promoId: ObjectId): Promise<void> {
  await getDb()
    .collection('promo-codes')
    .updateOne({ _id: promoId, timesUsed: { $gt: 0 } }, { $inc: { timesUsed: -1 } })
}

export function tierOnSale(tier: Tier, now = new Date()): boolean {
  if (tier.salesStart && new Date(tier.salesStart) > now) return false
  if (tier.salesEnd && new Date(tier.salesEnd) < now) return false
  return tier.quantity > 0
}

export function eventOnSale(event: CatalogEvent, now = new Date()): boolean {
  if (event.salesStatus && event.salesStatus !== 'onSale') return false
  return new Date(event.startsAt) > now
}

/** Plain text from Payload rich text (Lexical JSON). */
export function richTextToPlain(node: unknown): string {
  if (typeof node !== 'object' || node === null) return ''
  const n = node as { text?: unknown; children?: unknown; root?: unknown; type?: unknown }
  if (n.root) return richTextToPlain(n.root)
  const own = typeof n.text === 'string' ? n.text : ''
  const kids = Array.isArray(n.children) ? n.children.map(richTextToPlain).join('') : ''
  const block = n.type === 'paragraph' || n.type === 'heading' || n.type === 'listitem' ? '\n' : ''
  return own + kids + block
}

export type AssistantSettings = {
  enabled: boolean
  tone: string
  knowledge: string
  handoverEmail: string
  handoverWhatsapp: string
}

export async function getAssistantSettings(): Promise<AssistantSettings> {
  const doc = await getDb()
    .collection<Document>('globals')
    .findOne({ globalType: 'platform-settings' })
  const a = (doc?.assistant ?? {}) as Record<string, unknown>
  const f = (doc?.features ?? {}) as Record<string, unknown>
  return {
    enabled: f.aiAssistant === true,
    tone: typeof a.tone === 'string' ? a.tone : '',
    knowledge: richTextToPlain(a.knowledge).trim(),
    handoverEmail: typeof a.handoverEmail === 'string' ? a.handoverEmail : '',
    handoverWhatsapp: typeof a.handoverWhatsapp === 'string' ? a.handoverWhatsapp : '',
  }
}

/** Owner's own email wording (Platform settings → Email wording), if filled in for this language. */
export async function getEmailTexts(locale: Locale) {
  const doc = await getDb()
    .collection<Document>('globals')
    .findOne({ globalType: 'platform-settings' })
  const t = (doc?.emailTexts ?? {}) as Record<string, Localized>
  const get = (k: string) => {
    const v = t[k]
    if (!v) return ''
    return typeof v === 'string' ? v : (v[locale] ?? '')
  }
  return { ticketsIntro: get('ticketsIntro'), ticketsFooter: get('ticketsFooter') }
}
