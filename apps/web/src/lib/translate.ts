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

/**
 * Which service translates: Google Gemini when GEMINI_API_KEY is set (it has a free plan),
 * otherwise OpenAI with OPENAI_API_KEY. Both speak the same chat format.
 */
function provider() {
  const gemini = process.env.GEMINI_API_KEY?.trim()
  if (gemini)
    return {
      name: 'Gemini',
      key: gemini,
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    }
  const openai = process.env.OPENAI_API_KEY?.trim()
  if (openai)
    return {
      name: 'OpenAI',
      key: openai,
      url: 'https://api.openai.com/v1/chat/completions',
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    }
  return null
}

export function translationReady() {
  return provider() !== null
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

let geminiModelCache: string | undefined

/**
 * Google renames and retires model names from time to time, which shows up as "404 not found".
 * Ask Google which models this key can use and pick the newest plain "flash" one.
 */
async function pickGeminiModel(key: string): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null)
  if (!res?.ok) return null
  const json = (await res.json().catch(() => ({}))) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[]
  }
  const names = (json.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter((n) => /^gemini-[\d.]+-flash$/.test(n))
  names.sort((a, b) => parseFloat(b.split('-')[1]!) - parseFloat(a.split('-')[1]!))
  return names[0] ?? null
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function translateBatch(texts: string[], target: Target): Promise<string[]> {
  if (texts.length === 0) return []
  const prov = provider()
  if (!prov) throw new TranslateError('OPENAI_API_KEY (or GEMINI_API_KEY) is not set on the website service.')
  // "Too many requests" (429) is usually just a short rush: wait and try again, up to 4 times.
  // A 429 that says the account has no credit is different: waiting never fixes it.
  if (prov.name === 'Gemini' && !process.env.GEMINI_MODEL && geminiModelCache) prov.model = geminiModelCache
  let res: Response | undefined
  let triedOtherModel = false
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await send(prov, texts, target)
    if (res.status === 404 && prov.name === 'Gemini' && !triedOtherModel) {
      triedOtherModel = true
      const found = await pickGeminiModel(prov.key)
      if (found && found !== prov.model) {
        prov.model = geminiModelCache = found
        res = await send(prov, texts, target)
      }
    }
    if (res.status !== 429 && res.status < 500) break
    if (res.status === 429) {
      const detail = await res.clone().text().catch(() => '')
      if (/insufficient_quota|billing|exceeded your current quota/i.test(detail))
        throw new TranslateError(
          prov.name === 'OpenAI'
            ? 'The OpenAI account has no credit left (quota used up). Add credit under Billing at platform.openai.com, then run Translate again.'
            : 'The Gemini free daily limit is used up. Wait until tomorrow and run Translate again; finished items are kept.',
        )
    }
    const retryAfter = Number(res.headers.get('retry-after'))
    await wait(Math.min(20_000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt))
  }
  if (!res) throw new TranslateError('Translation service did not answer')
  if (res.status === 429)
    throw new TranslateError('The translation service is busy right now (HTTP 429). Wait a minute and run Translate again; finished items are kept.')
  if (res.status === 401 || res.status === 403)
    throw new TranslateError(`The ${prov.name} key is not accepted (HTTP ${res.status}). Check the key in the website settings.`)
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)
    throw new TranslateError(`Translation service answered HTTP ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return parseReply(res, texts)
}

function send(prov: NonNullable<ReturnType<typeof provider>>, texts: string[], target: Target) {
  return fetch(prov.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${prov.key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: prov.model,
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
