import { getPayloadClient } from '@/lib/payload'
import { siteUrl } from '@/lib/site'
import { AbandonedPreviewLive } from './AbandonedPreviewLive'

/** Looks up a real upcoming event for the sample, then hands over to the live preview (which reads the form). */
export async function AbandonedPreview() {
  let title = 'Your event'
  try {
    const payload = await getPayloadClient()
    const ev = await payload.find({ collection: 'events', where: { startsAt: { greater_than: new Date().toISOString() } }, sort: 'startsAt', limit: 1, depth: 0, locale: 'en', overrideAccess: true })
    if (ev.docs[0]) title = String(ev.docs[0].title)
  } catch {
    /* keep the sample title */
  }
  return <AbandonedPreviewLive title={title} url={siteUrl} />
}
