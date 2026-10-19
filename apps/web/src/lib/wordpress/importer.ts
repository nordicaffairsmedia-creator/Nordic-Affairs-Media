import type { Payload } from 'payload'
import { SKIPPED_PAGES, toItem, type WpItem } from './parse'
import * as content from './content'

/**
 * Moves the old WordPress site into the new CMS. Safe to run again: every photo and
 * video remembers its old address (`sourceUrl`), every gallery and story its old path
 * (`legacyUrl`), so a second run only fetches what is new or failed the first time.
 * Used by Staff → Import (in small steps) and by `npm run import:wordpress`.
 */

export const WP_BASE = (process.env.WP_IMPORT_URL || 'https://www.nordicaffairsmedia.com').replace(
  /\/$/,
  '',
)

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  Accept: '*/*',
}

const FIELDS = 'id,slug,link,date,date_gmt,title,content,featured_media'
const CREDIT = 'Nordic Affairs Media'

export class ImportError extends Error {}

/** Uploads must not land on the server's own disk on Render or Vercel — they vanish on every deploy. */
export function storageReady(): { ok: boolean; message?: string } {
  if (process.env.S3_BUCKET) return { ok: true }
  if (process.env.IMPORT_ALLOW_LOCAL_DISK === '1' || !(process.env.RENDER || process.env.VERCEL))
    return { ok: true }
  return {
    ok: false,
    message:
      'Photo storage is not set up yet (S3_BUCKET is empty). On Render, files saved without it are deleted on every update. Add the Cloudflare R2 keys first.',
  }
}

async function wpFetch(path: string): Promise<Response> {
  const res = await fetch(`${WP_BASE}${path}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(60_000),
  }).catch((e: unknown) => {
    throw new ImportError(`Could not reach the old website (${String(e)}).`)
  })
  if (res.status === 403 || res.status === 429 || res.status === 503)
    throw new ImportError(
      `The old website refused the server (HTTP ${res.status}). Its firewall probably blocks hosting companies — run the import from your own computer instead (see README).`,
    )
  return res
}

async function wpJson<T>(path: string): Promise<{ data: T; pages: number }> {
  const res = await wpFetch(path)
  if (!res.ok) throw new ImportError(`Old website answered HTTP ${res.status} for ${path}`)
  const data = (await res.json()) as T
  return { data, pages: Number(res.headers.get('x-wp-totalpages') ?? 1) }
}

type WpRaw = Parameters<typeof toItem>[1]

async function listAll(type: 'pages' | 'posts'): Promise<WpRaw[]> {
  const all: WpRaw[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, pages } = await wpJson<WpRaw[]>(
      `/wp-json/wp/v2/${type}?per_page=100&page=${page}&status=publish&_fields=${FIELDS}`,
    )
    all.push(...data)
    if (page >= pages) break
  }
  return all
}


/** The old home page's background slideshow (wp-content/uploads paths), in its order. */
export { HERO_SLIDES } from './heroSlides'
import { FOOTER_BG, HERO_SLIDES } from './heroSlides'
export const HERO_KEY = 'hero:home'

export type PlanItem = Pick<WpItem, 'key' | 'kind' | 'slug' | 'title' | 'oldPath' | 'date'> & {
  photos: number
  hasVideo: boolean
  /** Every photo of this page already appears in a bigger gallery — it only gets a redirect. */
  duplicateOf: string | null
}

/** Reads the whole old site (text only — no photos yet) and lists what will be moved. */
export async function loadPlan(): Promise<PlanItem[]> {
  const [pages, posts] = await Promise.all([listAll('pages'), listAll('posts')])
  const items = [
    ...pages.filter((p) => !SKIPPED_PAGES.has(p.slug)).map((p) => toItem('page', p)),
    ...posts.map((p) => toItem('post', p)),
  ].filter((i): i is WpItem => i !== null)

  const galleries = items.filter((i) => i.kind === 'gallery')
  const duplicateOf = (item: WpItem) => {
    if (item.kind !== 'gallery') return null
    const bigger = galleries.find(
      (g) =>
        g.key !== item.key &&
        g.photos.length > item.photos.length &&
        item.photos.every((p) => g.photos.includes(p)),
    )
    return bigger?.slug ?? null
  }

  const hero: PlanItem = {
    key: HERO_KEY,
    kind: 'gallery',
    slug: 'home-slideshow',
    title: 'Home page slideshow',
    oldPath: '/home/',
    date: new Date().toISOString(),
    photos: HERO_SLIDES.length,
    hasVideo: false,
    duplicateOf: null,
  }

  // Galleries first, so a gallery and a story sharing an old address send it to the gallery.
  return [hero, ...items

    .sort((a, b) =>
      a.kind === b.kind ? b.date.localeCompare(a.date) : a.kind === 'gallery' ? -1 : 1,
    )
    .map((i) => ({
      key: i.key,
      kind: i.kind,
      slug: i.slug,
      title: i.title,
      oldPath: i.oldPath,
      date: i.date,
      photos: i.photos.length,
      hasVideo: Boolean(i.video),
      duplicateOf: duplicateOf(i),
    }))]
}

async function loadItem(key: string): Promise<WpItem> {
  const [type, id] = key.split(':')
  if ((type !== 'page' && type !== 'post') || !id || !/^\d+$/.test(id))
    throw new ImportError(`Unknown item ${key}`)
  const { data } = await wpJson<WpRaw>(`/wp-json/wp/v2/${type}s/${id}?_fields=${FIELDS}`)
  const item = toItem(type, data)
  if (!item) throw new ImportError(`Nothing to import on ${key}`)
  if (type === 'post' && data.featured_media) {
    const media = await wpJson<{ source_url?: string }>(
      `/wp-json/wp/v2/media/${data.featured_media}?_fields=source_url`,
    ).catch(() => null)
    item.featuredImage = media?.data.source_url ?? null
  }
  return item
}

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

async function download(url: string, kind: 'image' | 'video') {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(300_000) }).catch(
    (e: unknown) => {
      throw new ImportError(`Download failed: ${String(e)}`)
    },
  )
  if (!res.ok) throw new ImportError(`HTTP ${res.status}`)
  const data = Buffer.from(await res.arrayBuffer())
  const rawName = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? `file-${Date.now()}`)
  const ext = rawName.split('.').pop()?.toLowerCase() ?? ''
  const header = res.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  const mimetype = header.startsWith(`${kind}/`) ? header : (IMAGE_TYPES[ext] ?? '')
  if (!mimetype.startsWith(`${kind}/`)) throw new ImportError(`Not an ${kind} (${header || ext})`)
  // Tidy names like "imageye___-_imgi_15_19.ZLATAN8JUNE24-min.jpg".
  const name = rawName.replace(/^imageye_+-_/, '').replace(/[^\w.-]+/g, '-')
  return { data, mimetype, name, size: data.length }
}

async function findIdBySource(payload: Payload, collection: 'media' | 'videos', url: string) {
  const found = await payload.find({
    collection,
    where: { sourceUrl: { equals: url } },
    limit: 1,
    depth: 0,
    pagination: false,
  })
  return found.docs[0]?.id ?? null
}

/** Imports one photo (or returns the one imported earlier). */
export async function ensureMedia(payload: Payload, url: string, alt: string) {
  const existing = await findIdBySource(payload, 'media', url)
  if (existing) return existing
  const file = await download(url, 'image')
  const doc = await payload.create({
    collection: 'media',
    data: { alt, credit: CREDIT, sourceUrl: url },
    file,
  })
  return doc.id
}

async function ensureVideo(payload: Payload, url: string, title: string, poster: string | null) {
  const existing = await findIdBySource(payload, 'videos', url)
  if (existing) return existing
  const file = await download(url, 'video')
  const doc = await payload.create({
    collection: 'videos',
    data: { title, credit: CREDIT, sourceUrl: url, ...(poster ? { poster } : {}) },
    file,
  })
  return doc.id
}

/**
 * Adds an old-address redirect once. With `correct`, an existing entry pointing
 * somewhere else is updated (used for the fixed site-wide redirects, so an early
 * wrong target such as /video → /en gets repaired on the next import run).
 */
async function ensureRedirect(payload: Payload, from: string, to: string, correct = false) {
  const path = from.replace(/\/+$/, '').toLowerCase() || '/'
  if (path === '/' || path === to) return
  const existing = await payload.find({
    collection: 'redirects',
    where: { from: { equals: path } },
    limit: 1,
    depth: 0,
  })
  const hit = existing.docs[0]
  if (hit) {
    if (correct && hit.to !== to)
      await payload.update({ collection: 'redirects', id: hit.id, data: { to, permanent: true } })
    return
  }
  await payload.create({ collection: 'redirects', data: { from: path, to, permanent: true } })
}

async function ensureTaxonomy(payload: Payload) {
  const cat = await payload.find({
    collection: 'categories',
    where: { slug: { equals: 'stories' } },
    limit: 1,
    depth: 0,
  })
  const category =
    cat.docs[0] ??
    (await payload.create({
      collection: 'categories',
      data: { title: 'Stories', slug: 'stories', showInNav: false },
    }))
  const auth = await payload.find({
    collection: 'authors',
    where: { slug: { equals: 'nordic-affairs-media' } },
    limit: 1,
    depth: 0,
  })
  const author =
    auth.docs[0] ??
    (await payload.create({
      collection: 'authors',
      data: { name: 'Nordic Affairs Media', slug: 'nordic-affairs-media' },
    }))
  return { category: category.id, author: author.id }
}

export type StepResult = {
  done: boolean
  next: number
  total: number
  added: number
  failed: string[]
  message: string
}

/**
 * Settings, About page, press logos, menu links and the fixed redirects.
 * Fills only fields that are still empty, so later edits in the CMS are never overwritten.
 */
export async function importBasics(payload: Payload): Promise<StepResult> {
  const failed: string[] = []
  let added = 0
  const s = content.settings
  const current = await payload.findGlobal({ slug: 'site-settings', depth: 0 })

  const pressMentions = current.pressMentions?.length
    ? null
    : ([] as { outlet: string; url: string; logo?: string }[])
  if (pressMentions) {
    for (const p of content.pressMentions) {
      const logo = await ensureMedia(payload, `${WP_BASE}${p.logo}`, `${p.outlet} logo`).catch(
        (e: unknown) => {
          failed.push(`${p.outlet} logo: ${String(e)}`)
          return null
        },
      )
      pressMentions.push({ outlet: p.outlet, url: p.url, ...(logo ? { logo } : {}) })
    }
  }

  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      tagline: current.tagline || s.tagline,
      description: current.description || s.description,
      contactEmail: current.contactEmail || s.contactEmail,
      contactPhone: current.contactPhone || s.contactPhone,
      whatsapp: current.whatsapp || s.whatsapp,
      location: current.location || s.location,
      accreditation: current.accreditation || s.accreditation,
      ...(current.stats?.length ? {} : { stats: s.stats }),
      ...(pressMentions ? { pressMentions } : {}),
    },
  })

  const about = await payload.count({
    collection: 'pages',
    where: { slug: { equals: content.about.slug } },
  })
  if (about.totalDocs === 0) {
    await payload.create({
      collection: 'pages',
      draft: false,
      data: {
        title: content.about.title,
        slug: content.about.slug,
        intro: content.about.intro,
        body: content.about.body,
        showStats: true,
        showPress: true,
        _status: 'published',
      } as never,
    })
    added++
  }

  const nav = await payload.findGlobal({ slug: 'navigation', depth: 0 })
  const primary = (nav.primary ?? []).map(({ label, href }) => ({ label, href }))
  for (const link of content.navLinks) {
    if (primary.length < 8 && !primary.some((l) => l.href === link.href)) primary.push(link)
  }
  await payload.updateGlobal({ slug: 'navigation', data: { primary } })

  for (const r of content.fixedRedirects) await ensureRedirect(payload, r.from, r.to, true)
  await ensureTaxonomy(payload)

  return {
    done: true,
    next: 0,
    total: 1,
    added,
    failed,
    message: 'Contact details, About page, key figures, press logos, menu and redirects',
  }
}

/** Number of photos fetched per step. Small steps keep each request well under a minute. */
export const BATCH = 3

/**
 * Repairs photos/videos whose record exists but whose file is not in the bucket (for example
 * after switching storage to Cloudflare R2). For each record with an old address it checks the
 * bucket and, if the file is missing, copies it again from the old website and attaches it to
 * the same record — so every page that already uses the photo starts showing it. Records are
 * walked in a fixed order, a few per call; call again with `next` until `done`.
 */
export async function repairFiles(
  payload: Payload,
  collection: 'media' | 'videos',
  offset = 0,
  batch = BATCH,
): Promise<StepResult> {
  const { objectExists } = await import('@/lib/storage')
  const page = await payload.find({
    collection,
    where: { sourceUrl: { exists: true } },
    sort: 'createdAt',
    limit: batch,
    page: Math.floor(offset / batch) + 1,
    depth: 0,
    overrideAccess: true,
  })
  const failed: string[] = []
  let added = 0
  for (const doc of page.docs) {
    const d = doc as unknown as { id: string | number; filename?: string | null; sourceUrl?: string | null }
    if (!d.sourceUrl) continue
    try {
      if (d.filename && (await objectExists(d.filename))) continue
      const file = await download(d.sourceUrl, collection === 'media' ? 'image' : 'video')
      await payload.update({
        collection,
        id: d.id,
        data: {} as never,
        file,
        overrideAccess: true,
      })
      added++
    } catch (e) {
      failed.push(`${d.filename ?? d.sourceUrl}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const end = offset + page.docs.length
  const done = !page.hasNextPage
  return {
    done,
    next: end,
    total: page.totalDocs,
    added,
    failed,
    message: done ? `Checked ${page.totalDocs} ${collection === 'media' ? 'photos' : 'videos'}` : '',
  }
}

/**
 * One step of one item: a gallery moves `BATCH` photos per call (call again with `next`
 * until `done`); a story moves in a single call.
 */
export async function importItem(
  payload: Payload,
  key: string,
  offset = 0,
  duplicateOf: string | null = null,
  batch = BATCH,
): Promise<StepResult> {
  if (key === HERO_KEY) return importHero(payload, offset, batch)
  const item = await loadItem(key)

  if (item.kind === 'gallery' && duplicateOf) {
    await ensureRedirect(payload, item.oldPath, `/en/gallery/${duplicateOf}`)
    return {
      done: true,
      next: 0,
      total: 0,
      added: 0,
      failed: [],
      message: `Same photos as “${duplicateOf}” — old address now points there`,
    }
  }

  return item.kind === 'gallery'
    ? importGallery(payload, item, offset, batch)
    : importArticle(payload, item)
}

/** Copies the old home page slideshow photos and puts them on the new home page, a few per call. */
async function importHero(payload: Payload, offset: number, batch: number): Promise<StepResult> {
  const failed: string[] = []
  let added = 0
  const end = Math.min(HERO_SLIDES.length, offset + batch)
  // First batch also brings over the old footer background (city skyline).
  const paths = offset === 0 ? [FOOTER_BG, ...HERO_SLIDES.slice(offset, end)] : HERO_SLIDES.slice(offset, end)
  for (const path of paths) {
    const url = `${WP_BASE}/wp-content/uploads/${path}`
    const before = await findIdBySource(payload, 'media', url)
    if (before) continue
    await ensureMedia(payload, url, 'Nordic Affairs Media coverage')
      .then(() => added++)
      .catch((e: unknown) => failed.push(`${path}: ${String(e)}`))
  }
  const done = end >= HERO_SLIDES.length
  if (done) {
    const home = await payload.findGlobal({ slug: 'homepage', depth: 0 })
    const current = (home.heroSlides ?? []) as unknown[]
    if (current.length === 0) {
      const ids: string[] = []
      for (const path of HERO_SLIDES) {
        const id = await findIdBySource(payload, 'media', `${WP_BASE}/wp-content/uploads/${path}`)
        if (id) ids.push(String(id))
      }
      if (ids.length) await payload.updateGlobal({ slug: 'homepage', data: { heroSlides: ids } as never })
    }
  }
  return {
    done,
    next: end,
    total: HERO_SLIDES.length,
    added,
    failed,
    message: done ? 'Home page slideshow photos are on the new home page' : '',
  }
}

async function importGallery(
  payload: Payload,
  item: WpItem,
  offset: number,
  batch: number,
): Promise<StepResult> {
  const failed: string[] = []
  let added = 0
  const end = Math.min(item.photos.length, offset + batch)

  for (let i = offset; i < end; i++) {
    const url = item.photos[i]!
    try {
      const before = await findIdBySource(payload, 'media', url)
      if (!before) {
        await ensureMedia(payload, url, `${item.title} — photo ${i + 1}`)
        added++
      }
    } catch (e) {
      failed.push(`${url.split('/').pop()}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Rebuild the photo list in the old site's order from everything imported so far.
  const wanted = item.photos.slice(0, end)
  const media = await payload.find({
    collection: 'media',
    where: { sourceUrl: { in: wanted } },
    limit: wanted.length + 10,
    depth: 0,
    pagination: false,
    select: { sourceUrl: true },
  })
  const byUrl = new Map<string, string>()
  for (const m of media.docs) if (m.sourceUrl) byUrl.set(m.sourceUrl, m.id)
  const photos = wanted.flatMap((u) => {
    const id = byUrl.get(u)
    return id ? [{ image: id }] : []
  })
  const done = end >= item.photos.length

  const existing = await payload.find({
    collection: 'galleries',
    where: { legacyUrl: { equals: item.oldPath } },
    limit: 1,
    depth: 0,
    draft: true,
  })
  const doc = existing.docs[0]
  const publish = done || doc?._status === 'published'
  const data = {
    title: item.title,
    date: content.eventDates[item.slug] ?? item.date,
    description: item.paragraphs.join('\n\n') || undefined,
    legacyUrl: item.oldPath,
    photos,
    _status: publish ? ('published' as const) : ('draft' as const),
  }

  let slug = doc?.slug ?? item.slug
  if (photos.length > 0) {
    if (doc) {
      await payload.update({ collection: 'galleries', id: doc.id, data, draft: !publish })
    } else {
      const taken = await payload.count({
        collection: 'galleries',
        where: { slug: { equals: slug } },
      })
      if (taken.totalDocs > 0) slug = `${slug}-${item.key.split(':')[1]}`
      await payload.create({ collection: 'galleries', data: { ...data, slug }, draft: !publish })
    }
  }
  if (done) await ensureRedirect(payload, item.oldPath, `/en/gallery/${slug}`)

  return {
    done,
    next: end,
    total: item.photos.length,
    added,
    failed,
    message: done
      ? photos.length
        ? `Gallery ready: ${photos.length} photos`
        : 'No photo could be downloaded'
      : `${end} of ${item.photos.length} photos`,
  }
}

async function importArticle(payload: Payload, item: WpItem): Promise<StepResult> {
  const failed: string[] = []
  const { category, author } = await ensureTaxonomy(payload)

  let hero: string | null = null
  if (item.featuredImage) {
    hero = await ensureMedia(payload, item.featuredImage, item.title).catch((e: unknown) => {
      failed.push(`Main image: ${String(e)}`)
      return null
    })
  }
  let video: string | null = null
  if (item.video) {
    video = await ensureVideo(payload, item.video, item.title, hero).catch((e: unknown) => {
      failed.push(`Video: ${String(e)}`)
      return null
    })
  }

  const existing = await payload.find({
    collection: 'articles',
    where: { slug: { equals: item.slug } },
    limit: 1,
    depth: 0,
    draft: true,
  })
  const doc = existing.docs[0]
  const data = {
    title: item.title,
    deck: item.paragraphs[0]?.slice(0, 280),
    body: content.richTextFromParagraphs(item.paragraphs.length ? item.paragraphs : [item.title]),
    heroImage: hero ?? undefined,
    heroVideo: video ?? undefined,
    category,
    authors: [author],
    publishedAt: item.wpDate,
    legacyUrl: item.oldPath,
    _status: 'published' as const,
  }
  let slug = item.slug
  if (doc && doc.legacyUrl === item.oldPath) {
    await payload.update({ collection: 'articles', id: doc.id, data: data as never, draft: false })
  } else {
    if (doc) slug = `${item.slug}-story`
    await payload.create({
      collection: 'articles',
      data: { ...data, slug } as never,
      draft: false,
    })
  }
  await ensureRedirect(payload, item.oldPath, `/en/news/${slug}`)
  return {
    done: true,
    next: 0,
    total: 1,
    added: 1,
    failed,
    message: `Story ready${video ? ' with video' : ''}`,
  }
}
