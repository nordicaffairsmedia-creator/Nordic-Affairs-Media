import { NextResponse } from 'next/server'
import { isLocale } from '@/i18n/config'
import { getPayloadClient } from '@/lib/payload'

/*
 * The website's own visitor counter. Each page view adds 1 to that page's count for the
 * day (Stockholm time); a "visit" is counted when someone arrives from outside the site.
 * No cookies, no IP addresses and nothing about the visitor is stored, so no consent is
 * needed.
 */

export const dynamic = 'force-dynamic'

const BOTS = /bot|crawl|spider|slurp|preview|monitor|lighthouse|headless|curl|wget|python|axios/i

type Model = {
  updateOne: (filter: object, update: object, opts: object) => Promise<unknown>
}

export async function POST(req: Request) {
  const done = new NextResponse(null, { status: 204 })
  if (BOTS.test(req.headers.get('user-agent') ?? '')) return done

  let body: { path?: unknown; entry?: unknown } = {}
  try {
    body = JSON.parse(await req.text())
  } catch {
    return done
  }
  const raw = typeof body.path === 'string' ? body.path.split(/[?#]/)[0]!.slice(0, 200) : ''
  if (!raw.startsWith('/') || /^\/(admin|staff|api|_next)(\/|$)/.test(raw)) return done

  // "/en/gallery/x" and "/sv/gallery/x" count as the same page.
  const parts = raw.split('/')
  const path = isLocale(parts[1]) ? '/' + parts.slice(2).join('/') : raw
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })

  try {
    const payload = await getPayloadClient()
    const model = (payload.db as unknown as { collections: Record<string, Model> }).collections['page-views']
    if (!model) return done
    const now = new Date()
    await model.updateOne(
      { day, path: path.replace(/\/+$/, '') || '/' },
      {
        $inc: { views: 1, visits: body.entry === true ? 1 : 0 },
        $set: { updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )
  } catch {
    // Counting must never break the website.
  }
  return done
}
