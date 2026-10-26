import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { unsubscribeSig } from '@/lib/marketing'

export const dynamic = 'force-dynamic'

const page = (msg: string) =>
  new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><body style="font-family:Arial;max-width:480px;margin:15vh auto;padding:0 16px;text-align:center"><h2>${msg}</h2></body>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )

/** One-click unsubscribe for people on a recipient list (also used as the List-Unsubscribe link). */
async function handle(req: Request) {
  const u = new URL(req.url)
  // Signed link (ticket buyers, people who left the checkout): add the address to the "unsubscribed" list.
  const e = u.searchParams.get('e')
  if (e) {
    const email = e.trim().toLowerCase()
    if (u.searchParams.get('s') !== unsubscribeSig(email)) return page('This link is not valid.')
    const payload = await getPayloadClient()
    const found = await payload.find({ collection: 'subscribers', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
    if (found.docs[0]) await payload.update({ collection: 'subscribers', id: found.docs[0].id, data: { status: 'unsubscribed' }, overrideAccess: true })
    else await payload.create({ collection: 'subscribers', data: { email, status: 'unsubscribed', token: `unsub-${unsubscribeSig(email)}` }, overrideAccess: true })
    return page('You are unsubscribed. You will not get more marketing email from us.')
  }
  const listId = u.searchParams.get('l')
  const t = u.searchParams.get('t')
  if (!listId || !t || t.length < 10) return page('This link is not valid.')
  const payload = await getPayloadClient()
  const list = await payload.findByID({ collection: 'recipient-lists', id: listId, depth: 0, overrideAccess: true }).catch(() => null)
  const person = list?.contacts?.find((p) => p.token === t)
  if (!list || !person) return page('This link is not valid.')
  const email = String(person.email).toLowerCase()
  // Unsubscribed from one list = no marketing email at all.
  const all = await payload.find({ collection: 'recipient-lists', limit: 200, pagination: false, depth: 0, overrideAccess: true })
  for (const l of all.docs) {
    if (!l.contacts?.some((p) => String(p.email).toLowerCase() === email && !p.unsubscribed)) continue
    await payload.update({
      collection: 'recipient-lists',
      id: l.id,
      overrideAccess: true,
      data: { contacts: l.contacts.map((p) => (String(p.email).toLowerCase() === email ? { ...p, unsubscribed: true } : p)) },
    })
  }
  return page('You are unsubscribed. You will not get more marketing email from us.')
}

export const GET = handle
export const POST = handle
