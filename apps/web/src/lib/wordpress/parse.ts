/**
 * Reads the old WordPress/Elementor site (nordicaffairsmedia.com) through its public
 * REST API and turns each page into something the new site understands.
 * Pure functions only — no database access — so they can be checked in isolation.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  deg: '°',
  euro: '€',
}

// Accented letters common in Swedish, Norwegian, Danish, Finnish, German and French names.
for (const [base, marks] of Object.entries({
  a: { uml: 'ä', ring: 'å', acute: 'á', grave: 'à', circ: 'â', tilde: 'ã' },
  e: { uml: 'ë', acute: 'é', grave: 'è', circ: 'ê' },
  i: { uml: 'ï', acute: 'í', grave: 'ì', circ: 'î' },
  o: { uml: 'ö', acute: 'ó', grave: 'ò', circ: 'ô', tilde: 'õ', slash: 'ø' },
  u: { uml: 'ü', acute: 'ú', grave: 'ù', circ: 'û' },
  y: { uml: 'ÿ', acute: 'ý' },
  n: { tilde: 'ñ' },
  c: { cedil: 'ç' },
})) {
  for (const [mark, letter] of Object.entries(marks)) {
    ENTITIES[`${base}${mark}`] = letter
    ENTITIES[`${base.toUpperCase()}${mark}`] = letter.toUpperCase()
  }
}
Object.assign(ENTITIES, {
  aelig: 'æ',
  AElig: 'Æ',
  szlig: 'ß',
  eth: 'ð',
  thorn: 'þ',
  ETH: 'Ð',
  THORN: 'Þ',
})

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match
    }
    return ENTITIES[code] ?? ENTITIES[code.toLowerCase()] ?? match
  })
}

/** HTML fragment → clean plain text on one line. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' '),
  ).trim()
}

export type WidgetBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraphs'; items: string[] }
  | { kind: 'photos'; urls: string[] }
  | { kind: 'video'; url: string }

const UPLOAD_IMAGE = /\/wp-content\/uploads\/[^"'\s)]+\.(?:jpe?g|png|webp)/i

/** "photo-1024x683.jpg" → "photo.jpg" (WordPress resized copy → original upload). */
export function originalImageUrl(url: string): string {
  return url.replace(/-\d{2,5}x\d{2,5}(?=\.(?:jpe?g|png|webp)$)/i, '')
}

/**
 * Splits Elementor page HTML into its widgets (heading, text, gallery, image, video).
 * Elementor marks every widget with data-widget_type="name.default".
 */
export function parseElementor(html: string): WidgetBlock[] {
  const blocks: WidgetBlock[] = []
  const parts = html.split(/data-widget_type="/).slice(1)
  for (const part of parts) {
    const type = part.slice(0, part.indexOf('"')).split('.')[0] ?? ''
    const body = part.slice(part.indexOf('>') + 1)
    if (type === 'heading') {
      const m = body.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)
      const text = m ? htmlToText(m[1] ?? '') : ''
      if (text) blocks.push({ kind: 'heading', text })
    } else if (type === 'text-editor') {
      const items = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((m) => htmlToText(m[1] ?? ''))
        .filter(Boolean)
      if (items.length) blocks.push({ kind: 'paragraphs', items })
    } else if (
      ['gallery', 'image-gallery', 'image', 'image-carousel', 'media-carousel'].includes(type)
    ) {
      // Gallery links point at the full-size original; plain images may be resized copies.
      const links = [...body.matchAll(/href="([^"]+)"/gi)].map((m) => m[1] ?? '')
      const imgs = [...body.matchAll(/(?:data-src|src)="([^"]+)"/gi)].map((m) => m[1] ?? '')
      const urls = [...links, ...imgs]
        .map((u) => decodeEntities(u))
        .filter((u) => UPLOAD_IMAGE.test(u))
        .map(originalImageUrl)
      const unique = [...new Set(urls)]
      if (unique.length) blocks.push({ kind: 'photos', urls: unique })
    } else if (type === 'video') {
      const m = body.match(/<video[^>]+src="([^"]+)"/i)
      if (m?.[1]) blocks.push({ kind: 'video', url: decodeEntities(m[1]) })
    }
  }
  return blocks
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * The old site was rebuilt in 2026, so WordPress dates are upload dates, not event dates.
 * The photographers' file names carry the real date ("Sweden-Belgium-24-MARCH-23.jpg",
 * "ZLATAN8JUNE24-min.jpg"); the most common date across a gallery wins.
 */
export function dateFromFileNames(urls: string[], notAfter = new Date()): string | null {
  const counts = new Map<string, number>()
  const re =
    /(\d{1,2})[-_. ]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_. ]?(\d{4}|\d{2})(?!\d)/i
  for (const url of urls) {
    const name = decodeURIComponent(url.split('/').pop() ?? '')
    const m = name.match(re)
    if (!m) continue
    const day = Number(m[1])
    const month = MONTHS.indexOf((m[2] ?? '').toLowerCase())
    let year = Number(m[3])
    if (year < 100) year += 2000
    if (day < 1 || day > 31 || month < 0 || year < 2000) continue
    const date = new Date(Date.UTC(year, month, day, 12))
    if (date > notAfter || date.getUTCMonth() !== month) continue
    const key = date.toISOString()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [key, n] of counts) {
    if (n > bestCount) {
      best = key
      bestCount = n
    }
  }
  return best
}

/** WordPress pages that are site furniture, not content to move. */
export const SKIPPED_PAGES = new Set([
  'home',
  'about-us',
  'contact-us',
  'gallery',
  'media',
  'video',
  'concerts-events',
])

export type WpItem = {
  key: string // "page:123" / "post:456"
  kind: 'gallery' | 'article'
  wpId: number
  slug: string
  title: string
  oldPath: string
  wpDate: string
  date: string // best guess at the real event date
  paragraphs: string[]
  photos: string[]
  video: string | null
  featuredImage: string | null
}

type WpContent = {
  id: number
  slug: string
  link: string
  date: string
  date_gmt?: string
  title: { rendered: string }
  content: { rendered: string }
  featured_media?: number
}

export function toItem(type: 'page' | 'post', wp: WpContent): WpItem | null {
  const title = htmlToText(wp.title.rendered)
  const blocks = parseElementor(wp.content.rendered)
  const photos = [...new Set(blocks.flatMap((b) => (b.kind === 'photos' ? b.urls : [])))]
  const video = blocks.find((b) => b.kind === 'video')?.url ?? null
  const paragraphs = blocks.flatMap((b) => {
    if (b.kind === 'paragraphs') return b.items
    // Older pages put their text in heading widgets; keep it unless it repeats the title.
    if (b.kind === 'heading' && b.text.toLowerCase() !== title.toLowerCase() && b.text.length > 40)
      return [b.text]
    return []
  })
  let oldPath = '/'
  try {
    oldPath = new URL(wp.link).pathname
  } catch {
    oldPath = `/${wp.slug}/`
  }
  const wpDate = new Date(wp.date_gmt ? `${wp.date_gmt}Z` : wp.date).toISOString()
  const kind = type === 'post' ? 'article' : photos.length > 0 ? 'gallery' : null
  if (!kind) return null
  return {
    key: `${type}:${wp.id}`,
    kind,
    wpId: wp.id,
    slug: wp.slug,
    title,
    oldPath,
    wpDate,
    // Titles like "DENMARK KING VISIT 6 MAY 24" count as one more vote.
    date: dateFromFileNames([...photos, title]) ?? wpDate,
    paragraphs,
    photos,
    video,
    featuredImage: null,
  }
}
