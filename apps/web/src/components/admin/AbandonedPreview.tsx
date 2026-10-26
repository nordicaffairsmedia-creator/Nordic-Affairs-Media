import { getPayloadClient } from '@/lib/payload'
import { renderAbandoned } from '@/lib/abandonedEmail'
import { siteUrl } from '@/lib/site'

/** The email exactly as the buyer gets it (English and Swedish), with a real upcoming event. */
export async function AbandonedPreview() {
  let title = 'Your event'
  try {
    const payload = await getPayloadClient()
    const ev = await payload.find({ collection: 'events', where: { startsAt: { greater_than: new Date().toISOString() } }, sort: 'startsAt', limit: 1, depth: 0, locale: 'en', overrideAccess: true })
    if (ev.docs[0]) title = String(ev.docs[0].title)
  } catch {
    /* keep the sample title */
  }
  const view = (lang: 'en' | 'sv') => renderAbandoned({ lang, eventTitle: title, firstName: 'Alex', url: siteUrl, stopUrl: siteUrl, code: 'EXAMPLE10' }).html
  return (
    <div style={{ margin: '16px 0' }}>
      <strong>Preview</strong>
      <p style={{ opacity: 0.7, margin: '4px 0 12px' }}>Exactly the email the buyer gets. Swedish or English, following the buyer&apos;s language. The example code only shows when you set a discount.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {(['en', 'sv'] as const).map((l) => (
          <div key={l}>
            <div style={{ opacity: 0.7, marginBottom: 4 }}>{l === 'en' ? 'English' : 'Svenska'}</div>
            <iframe title={`Preview ${l}`} sandbox="" srcDoc={view(l)} style={{ width: '100%', height: 420, border: '1px solid var(--theme-elevation-150)', borderRadius: 6, background: '#fff' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
