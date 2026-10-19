import type { Payload } from 'payload'
import type { Locale } from '@/i18n/config'

/**
 * Machine translation of gallery and story text into Swedish, Tamil and Malayalam
 * (Staff → Translate). Only empty language fields are filled, so anything a person
 * has written or corrected is never overwritten. Uses OPENAI_API_KEY.
 */

export const TARGETS = ['sv', 'ta', 'ml'] as const satisfies readonly Locale[]
type Target = (typeof TARGETS)[number]
const NAMES: Record<Target, string> = { sv: 'Swedish', ta: 'Tamil', ml: 'Malayalam' }

export class TranslateError extends Error {}

export function translationReady() {
  return Boolean(process.env.OPENAI_API_KEY)
}

/** Long stories go in small batches, so one request never hits the provider's per-minute size limit. */
export async function translateTexts(texts: string[], target: Target): Promise<string[]> {
  const out: string[] = []
  let batch: string[] = []
  let chars = 0
  for (const t of texts) {
    if (batch.length && (batch.length >= 20 || chars + t.length > 4000)) {
      out.push(...(await translateBatch(batch, target)))
      batch = []
      chars = 0
    }
    batch.push(t)
    chars += t.length
  }
  if (batch.length) out.push(...(await translateBatch(batch, target)))
  return out
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function translateBatch(texts: string[], target: Target): Promise<string[]> {
  if (texts.length === 0) return []
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new TranslateError('OPENAI_API_KEY is not set on the website service.')
  // "Too many requests" (429) is usually just a short rush: wait and try again, up to 4 times.
  // A 429 that says the account has no credit is different: waiting never fixes it.
  let res: Response | undefined
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await send(key, texts, target)
    if (res.status !== 429 && res.status < 500) break
    if (res.status === 429) {
      const detail = await res.clone().text().catch(() => '')
      if (/insufficient_quota|billing|exceeded your current quota/i.test(detail))
        throw new TranslateError(
          'The OpenAI account has no credit left (quota used up). Add credit under Billing at platform.openai.com, then run Translate again.',
        )
    }
    const retryAfter = Number(res.headers.get('retry-after'))
    await wait(Math.min(20_000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt))
  }
  if (!res) throw new TranslateError('Translation service did not answer')
  if (res.status === 429)
    throw new TranslateError('The translation service is busy right now (HTTP 429). Wait a minute and run Translate again; finished items are kept.')
  if (res.status === 401)
    throw new TranslateError('The OpenAI key is not accepted (HTTP 401). Check OPENAI_API_KEY in the website settings.')
  if (!res.ok) throw new TranslateError(`Translation service answered HTTP ${res.status}`)
  return parseReply(res, texts)
}

function send(key: string, texts: string[], target: Target) {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `You are a professional translator for Nordic Affairs Media, a Swedish media agency covering diplomatic visits, royal events, concerts and sport. ` +
            `Translate every string in the JSON array "items" from English into ${NAMES[target]}. ` +
            `Write natural, polished ${NAMES[target]} suitable for a professional website. ` +
            `Keep names of people, bands, teams, places and organisations recognisable (use the usual ${NAMES[target]} spelling where one exists). ` +
            `Keep numbers, scores and dates exactly. Do not add or remove information. ` +
            `Reply with JSON {"items": [...]} containing exactly the same number of strings in the same order.`,
        },
        { role: 'user', content: JSON.stringify({ items: texts }) },
      ],
    }),
  }).catch((e: unknown) => {
    throw new TranslateError(`Translation service unreachable (${String(e)})`)
  })
}

async function parseReply(res: Response, texts: string[]): Promise<string[]> {
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  let items: unknown
  try {
    items = (JSON.parse(json.choices?.[0]?.message?.content ?? '{}') as { items?: unknown }).items
  } catch {
    throw new TranslateError('Translation service returned an unreadable answer')
  }
  if (
    !Array.isArray(items) ||
    items.length !== texts.length ||
    items.some((i) => typeof i !== 'string')
  )
    throw new TranslateError('Translation service returned the wrong number of texts')
  return items as string[]
}

type LexicalNode = { type?: string; text?: string; children?: LexicalNode[]; [k: string]: unknown }

function textNodes(node: LexicalNode | undefined, out: LexicalNode[] = []) {
  if (!node) return out
  if (node.type === 'text' && typeof node.text === 'string' && node.text.trim()) out.push(node)
  node.children?.forEach((c) => textNodes(c, out))
  return out
}

const empty = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

const emptyRichText = (v: unknown) =>
  !v || textNodes((v as { root?: LexicalNode }).root).length === 0

export type TranslateItem = { collection: 'galleries' | 'articles'; id: string; title: string }

export async function listTranslatable(payload: Payload): Promise<TranslateItem[]> {
  const [g, a] = await Promise.all([
    payload.find({
      collection: 'galleries',
      locale: 'en',
      limit: 1000,
      depth: 0,
      pagination: false,
      select: { title: true },
    }),
    payload.find({
      collection: 'articles',
      locale: 'en',
      limit: 1000,
      depth: 0,
      pagination: false,
      select: { title: true },
    }),
  ])
  return [
    ...g.docs.map((d) => ({ collection: 'galleries' as const, id: d.id, title: d.title })),
    ...a.docs.map((d) => ({ collection: 'articles' as const, id: d.id, title: d.title })),
  ]
}

/** Fills every empty Swedish, Tamil and Malayalam field of one gallery or story. */
export async function translateOne(
  payload: Payload,
  collection: TranslateItem['collection'],
  id: string,
): Promise<string> {
  const en = (await payload.findByID({
    collection,
    id,
    locale: 'en',
    depth: 0,
  })) as unknown as Record<string, unknown>
  const fields = collection === 'galleries' ? ['title', 'description'] : ['title', 'deck']
  const done: string[] = []

  for (const target of TARGETS) {
    const cur = (await payload.findByID({
      collection,
      id,
      locale: target,
      fallbackLocale: false,
      depth: 0,
    })) as unknown as Record<string, unknown>

    const keys = fields.filter((f) => !empty(en[f]) && empty(cur[f]))
    const texts = keys.map((k) => String(en[k]))

    // Story body: translate the text pieces and keep the layout (headings, lists, links).
    let body: { root: LexicalNode } | null = null
    let bodyNodes: LexicalNode[] = []
    if (collection === 'articles' && !emptyRichText(en.body) && emptyRichText(cur.body)) {
      body = structuredClone(en.body) as { root: LexicalNode }
      bodyNodes = textNodes(body.root)
    }

    const all = [...texts, ...bodyNodes.map((n) => n.text as string)]
    if (all.length === 0) continue
    const out = await translateTexts(all, target)

    const data: Record<string, unknown> = {}
    keys.forEach((k, i) => (data[k] = out[i]))
    bodyNodes.forEach((n, i) => (n.text = out[texts.length + i]))
    if (body) data.body = body
    // Title is required in every language that has any other text.
    if (collection === 'articles' && !data.title && empty(cur.title)) data.title = en.title

    await payload.update({ collection, id, locale: target, data: data as never })
    done.push(target)
  }
  return done.length ? `Translated: ${done.join(', ')}` : 'Already translated'
}
