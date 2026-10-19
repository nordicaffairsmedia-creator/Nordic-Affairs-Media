import 'server-only'
import type { Locale } from '@/i18n/config'
import { getPayloadClient, isDoc } from '@/lib/payload'
import { getLatestArticles, getSiteChrome } from '@/lib/queries'
import { aboutFor } from '@/lib/i18n-content'
import { formatDate } from '@/lib/format'

/**
 * Everything Nora (the website assistant) is allowed to know, built from the CMS in
 * the visitor's language: the agency, its galleries, upcoming events and stories.
 * Rebuilt at most every 5 minutes per language, so new galleries appear quickly
 * without querying the database on every message.
 */

export type GalleryFact = {
  slug: string
  title: string
  date: string | null
  photos: number
  url: string
  cover: string | null
  about: string
}
export type EventFact = {
  slug: string
  title: string
  when: string
  venue: string
  prices: string
  status: string
  url: string
  cover: string | null
}
export type Knowledge = {
  /** The same facts as fields, for the built-in (no-AI) answers. */
  facts: {
    description: string
    paragraphs: string[]
    expertise: string[]
    eventsCovered: string[]
    phone: string
    location: string
    accreditation: string
  }
  text: string
  galleries: GalleryFact[]
  events: EventFact[]
  whatsapp: string | null
  contactEmail: string | null
  siteName: string
}

const TTL = 5 * 60_000
const cacheByLocale = new Map<Locale, { at: number; value: Knowledge }>()

type Loose = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')

function imageUrl(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const m = media as Loose
  const sizes = (m.sizes ?? {}) as Loose
  const card = (sizes.thumb ?? sizes.card) as Loose | undefined
  return str(card?.url) || str(m.url) || null
}

export async function getKnowledge(locale: Locale): Promise<Knowledge> {
  const hit = cacheByLocale.get(locale)
  if (hit && Date.now() - hit.at < TTL) return hit.value

  const payload = await getPayloadClient()
  const [{ settings }, galleriesRes, eventsRes, articles] = await Promise.all([
    getSiteChrome(locale),
    payload.find({
      collection: 'galleries',
      locale,
      depth: 1,
      limit: 300,
      sort: '-date',
      where: { _status: { equals: 'published' } },
      select: { title: true, slug: true, date: true, cover: true, photoCount: true, description: true },
      overrideAccess: false,
      draft: false,
    }),
    payload.find({
      collection: 'events',
      locale,
      depth: 1,
      limit: 25,
      sort: 'startsAt',
      where: {
        and: [
          { _status: { equals: 'published' } },
          { startsAt: { greater_than: new Date().toISOString() } },
          { salesStatus: { not_equals: 'cancelled' } },
        ],
      },
      overrideAccess: false,
      draft: false,
    }),
    getLatestArticles(locale, 12).catch(() => []),
  ])

  const base = `/${locale}` // links stay on whichever address the visitor is using
  const about_ = new Map(
    galleriesRes.docs.map((g) => [g.slug, (g.description ?? '').replace(/\s+/g, ' ').slice(0, 220)]),
  )
  const galleries: GalleryFact[] = galleriesRes.docs.map((g) => ({
    slug: g.slug,
    title: g.title,
    date: g.date ? formatDate(g.date, locale) : null,
    photos: g.photoCount ?? 0,
    url: `${base}/gallery/${g.slug}`,
    cover: imageUrl(g.cover),
    about: about_.get(g.slug) ?? '',
  }))

  const events: EventFact[] = eventsRes.docs.map((doc) => {
    const e = doc as unknown as Loose
    const venue = isDoc(e.venue as { id: string } | string | null)
      ? [str((e.venue as Loose).name), str((e.venue as Loose).city)].filter(Boolean).join(', ')
      : ''
    const currency = str(e.currency) || str((e.ticketing as Loose | undefined)?.currency) || 'SEK'
    const tiers = Array.isArray(e.tiers)
      ? e.tiers
      : Array.isArray((e.ticketing as Loose | undefined)?.tiers)
        ? ((e.ticketing as Loose).tiers as unknown[])
        : []
    const prices = tiers
      .map((t) => {
        const tier = t as Loose
        return typeof tier.price === 'number' ? `${str(tier.name)} ${tier.price} ${currency}` : ''
      })
      .filter(Boolean)
      .join('; ')
    return {
      slug: str(e.slug),
      title: str(e.title),
      when: e.startsAt ? `${formatDate(str(e.startsAt), locale)} ${new Date(str(e.startsAt)).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} (Stockholm)` : '',
      venue,
      prices,
      status: str(e.salesStatus) || 'onSale',
      url: `${base}/events/${str(e.slug)}`,
      cover: imageUrl((e.hero as Loose | undefined)?.poster ?? e.poster),
    }
  })

  const about = aboutFor(locale)
  const s = settings as unknown as Loose
  const stats = Array.isArray(s.stats)
    ? (s.stats as Loose[]).map((x) => `${str(x.value)} ${str(x.label)}`).join(' · ')
    : ''
  const whatsapp = str(s.whatsapp) || null
  const contactEmail = str(s.contactEmail) || null

  const text = [
    `# The agency`,
    `${str(s.siteName) || 'Nordic Affairs Media'} — ${str(s.tagline)}`,
    str(s.description),
    ...about.paragraphs,
    `What we cover: ${about.expertise.map((x) => x.label).join('; ')}.`,
    `${about.eventsTitle}: ${about.events.join('; ')}.`,
    `${about.ministersTitle}: ${about.ministers.join(', ')}.`,
    ...about.pillars.map((p) => `${p.title}: ${p.text}`),
    stats ? `Key figures: ${stats}.` : '',
    str(s.accreditation),
    `Contact: email ${contactEmail ?? '—'}, phone ${str(s.contactPhone) || '—'}, WhatsApp +${whatsapp ?? '—'}, based in ${str(s.location) || 'Stockholm, Sweden'}.`,
    `Instagram: https://www.instagram.com/nordicaffairsmedia/ (X, Facebook and YouTube channels are coming soon).`,
    `Pages: home ${base}, about ${base}/about-us, all galleries ${base}/gallery, media ${base}/media, concerts & events ${base}/events, contact ${base}/contact.`,
    '',
    `# Photo galleries (${galleries.length}, newest first) — slug | title | date | photos`,
    ...galleries.map(
      (g) =>
        `${g.slug} | ${g.title} | ${g.date ?? 'date not set'} | ${g.photos}${about_.get(g.slug) ? ` | ${about_.get(g.slug)}` : ''}`,
    ),
    '',
    `# Upcoming events (${events.length})`,
    ...(events.length
      ? events.map(
          (e) =>
            `${e.slug} | ${e.title} | ${e.when}${e.venue ? ` | ${e.venue}` : ''}${e.prices ? ` | tickets: ${e.prices}` : ''} | ${e.status}`,
        )
      : ['No upcoming events are published right now.']),
    '',
    `# Latest stories (${articles.length})`,
    ...articles.map((a) => {
      const x = a as unknown as Loose
      return `${str(x.title)}${str(x.deck) ? ` — ${str(x.deck)}` : ''} | ${base}/news/${str(x.slug)}`
    }),
  ]
    .filter((l) => l !== undefined)
    .join('\n')

  const value: Knowledge = {
    facts: {
      description: str(s.description),
      paragraphs: about.paragraphs,
      expertise: about.expertise.map((x) => x.label),
      eventsCovered: about.events,
      phone: str(s.contactPhone),
      location: str(s.location),
      accreditation: str(s.accreditation),
    },
    text,
    galleries,
    events,
    whatsapp,
    contactEmail,
    siteName: str(s.siteName) || 'Nordic Affairs Media',
  }
  cacheByLocale.set(locale, { at: Date.now(), value })
  return value
}
