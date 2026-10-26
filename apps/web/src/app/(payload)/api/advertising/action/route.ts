import { NextResponse } from 'next/server'
import { hasRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { campaignResults, createEventAd, metaReady, setCampaignStatus } from '@/lib/meta'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** POST { id, action: start | pause | resume | refresh } for one event ad. Organizers only. */
export async function POST(req: Request) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !hasRole(user, 'admin')) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  const { id, action } = (await req.json().catch(() => ({}))) as { id?: string | number; action?: string }
  if (!id || !action) return NextResponse.json({ error: 'Save the ad first.' }, { status: 400 })

  const ad = await payload.findByID({ collection: 'event-ads', id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!ad) return NextResponse.json({ error: 'Ad not found.' }, { status: 404 })
  const s = await payload.findGlobal({ slug: 'advertising-settings', overrideAccess: true })
  // The token field cannot be read through the API, so read it straight from the database.
  const db = (payload.db as unknown as { connection: { db: { collection: (n: string) => { findOne: (f: object) => Promise<Record<string, unknown> | null> } } } }).connection.db
  const raw = await db.collection('globals').findOne({ globalType: 'advertising-settings' })
  const token = String(raw?.accessToken ?? '')
  if (!token || !s.pageId || !s.adAccountId) return NextResponse.json({ error: 'Connect your Facebook Page first (Advertising: Facebook connection).' }, { status: 400 })

  const fail = async (e: unknown) => {
    const msg = e instanceof Error ? e.message : 'Something went wrong.'
    await payload.update({ collection: 'event-ads', id, data: { status: 'error', errorMessage: msg }, overrideAccess: true })
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  try {
    if (action === 'start') {
      if (!metaReady()) return NextResponse.json({ error: 'META_APP_ID and META_APP_SECRET are not set on the website.' }, { status: 400 })
      if (ad.metaCampaignId) return NextResponse.json({ error: 'This ad already exists on Meta. Use Pause or Resume.' }, { status: 409 })
      const ev = ad.event && typeof ad.event === 'object' ? ad.event : null
      if (!ev) return NextResponse.json({ error: 'Pick an event and save.' }, { status: 400 })
      const full = await payload.findByID({ collection: 'events', id: ev.id, depth: 1, locale: 'en', overrideAccess: true })
      const poster = (full as { poster?: unknown }).poster as { url?: string } | undefined
      // Every ad goes through a tracking link, so ticket sales can be traced back to it.
      const slug = `ad-${full.slug}`
      const found = await payload.find({ collection: 'tracking-links', where: { slug: { equals: slug } }, limit: 1, overrideAccess: true })
      if (!found.docs[0]) await payload.create({ collection: 'tracking-links', data: { name: `Facebook and Instagram ad: ${full.title}`, slug, event: full.id }, overrideAccess: true })
      const ids = await createEventAd({
        adAccountId: s.adAccountId,
        pageId: s.pageId,
        token,
        name: ad.name || `Ad: ${full.title}`,
        headline: ad.headline || String(full.title).slice(0, 40),
        message: ad.message,
        link: `${siteUrl}/api/go/${slug}`,
        imageUrl: poster?.url ? (poster.url.startsWith('http') ? poster.url : `${siteUrl}${poster.url}`) : undefined,
        dailyBudget: ad.dailyBudget,
        startTime: new Date(ad.startDate),
        endTime: new Date(ad.endDate),
        countries: String(ad.countries || 'SE').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
        ageMin: ad.ageMin ?? 18,
        ageMax: ad.ageMax ?? 65,
      })
      await payload.update({ collection: 'event-ads', id, data: { status: 'active', errorMessage: '', metaCampaignId: ids.campaignId, metaAdId: ids.adId }, overrideAccess: true })
      return NextResponse.json({ ok: true, message: 'The ad is created and sent to Meta. Meta reviews it first; it starts when approved.' })
    }
    if (!ad.metaCampaignId) return NextResponse.json({ error: 'This ad has not been started yet.' }, { status: 400 })
    if (action === 'pause' || action === 'resume') {
      await setCampaignStatus(ad.metaCampaignId, token, action === 'pause' ? 'PAUSED' : 'ACTIVE')
      await payload.update({ collection: 'event-ads', id, data: { status: action === 'pause' ? 'paused' : 'active' }, overrideAccess: true })
      return NextResponse.json({ ok: true, message: action === 'pause' ? 'Paused.' : 'Running again.' })
    }
    if (action === 'refresh') {
      const r = await campaignResults(ad.metaCampaignId, token)
      await payload.update({
        collection: 'event-ads',
        id,
        data: { metaStatus: r.effectiveStatus, impressions: r.impressions, reach: r.reach, clicks: r.clicks, spend: r.spend },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, message: `Updated: ${r.impressions} views, ${r.clicks} clicks, ${r.spend} spent.` })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (e) {
    return action === 'start' ? fail(e) : NextResponse.json({ error: e instanceof Error ? e.message : 'Failed.' }, { status: 502 })
  }
}
