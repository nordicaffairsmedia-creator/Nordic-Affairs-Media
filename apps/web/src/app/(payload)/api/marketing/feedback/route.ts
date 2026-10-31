import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { feedbackSig, slugTag, DEFAULTS } from '@/lib/emailTemplate'
import { escapeHtml } from '@/lib/mail'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

const page = (title: string, msg: string) =>
  new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><div style="max-width:480px;margin:12vh auto;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:36px 28px;text-align:center"><div style="font-size:34px;color:#f59e0b">&#9733;</div><h2 style="margin:8px 0 10px">${escapeHtml(title)}</h2><p style="color:#475569;line-height:1.6;margin:0 0 22px">${escapeHtml(msg)}</p><a href="${escapeHtml(siteUrl)}" style="display:inline-block;background:#005293;color:#fff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:1px;padding:12px 26px;border-radius:4px">VISIT OUR WEBSITE</a></div></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )

/** One click on a star or a tag in a campaign email. The link is signed, so it only works for the person it was sent to. */
export async function GET(req: Request) {
  const u = new URL(req.url)
  const c = u.searchParams.get('c') ?? ''
  const e = (u.searchParams.get('e') ?? '').trim().toLowerCase()
  const sig = u.searchParams.get('s') ?? ''
  const score = Number(u.searchParams.get('score') ?? '')
  const tagSlug = u.searchParams.get('tag') ?? ''
  if (!c || !e) return page('This link is not valid', 'Please use the buttons in the email.')

  // Test emails look real but are not recorded.
  if (e === 'test') return page('Thank you', 'This was a test email, so nothing was recorded.')
  if (sig !== feedbackSig(c, e)) return page('This link is not valid', 'Please use the buttons in the email.')

  const payload = await getPayloadClient()
  const camp = await payload.findByID({ collection: 'email-campaigns', id: c, depth: 0, overrideAccess: true }).catch(() => null)
  if (!camp) return page('This link is not valid', 'The campaign could not be found.')

  if (score >= 1 && score <= 5 && Number.isInteger(score)) {
    const found = await payload.find({ collection: 'email-feedback', where: { and: [{ campaign: { equals: c } }, { email: { equals: e } }, { kind: { equals: 'rating' } }] }, limit: 1, depth: 0, overrideAccess: true })
    if (found.docs[0]) await payload.update({ collection: 'email-feedback', id: found.docs[0].id, data: { score }, overrideAccess: true })
    else await payload.create({ collection: 'email-feedback', data: { campaign: camp.id, email: e, kind: 'rating', score }, overrideAccess: true })
    return page('Thank you for your rating', `You gave us ${score} out of 5. It helps us improve our press service.`)
  }

  if (tagSlug) {
    const tags = DEFAULTS.tags as { label?: string | null }[]
    const tag = tags.find((t) => t.label && slugTag(t.label) === tagSlug)
    if (!tag?.label) return page('This link is not valid', 'That option is no longer available.')
    const found = await payload.find({ collection: 'email-feedback', where: { and: [{ campaign: { equals: c } }, { email: { equals: e } }, { kind: { equals: 'tag' } }, { tag: { equals: tag.label } }] }, limit: 1, depth: 0, overrideAccess: true })
    if (!found.docs[0]) await payload.create({ collection: 'email-feedback', data: { campaign: camp.id, email: e, kind: 'tag', tag: tag.label }, overrideAccess: true })
    return page('Thank you', `We noted: ${tag.label}.`)
  }
  return page('This link is not valid', 'Please use the buttons in the email.')
}
