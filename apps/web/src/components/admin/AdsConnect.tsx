'use client'
import { useFormFields } from '@payloadcms/ui'

/** "Continue with Facebook" and what to tick in Facebook's dialog. */
export function AdsConnect() {
  const pageId = useFormFields(([f]) => f.pageId?.value) as string | undefined
  const connectedAt = useFormFields(([f]) => f.connectedAt?.value) as string | undefined
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const err = params?.get('error')
  const connected = Boolean(connectedAt && pageId)
  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 16, margin: '0 0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <strong>Connect your Facebook Page</strong>
        <span style={{ opacity: 0.8 }}>{connected ? 'Connected' : 'Not connected'}</span>
      </div>
      <p style={{ margin: '8px 0 12px', opacity: 0.8 }}>
        Ads run as your page. Sign in with the Facebook account that has full control of the page. In Facebook&apos;s dialog, tick the page and the ad account. If the page is in a business portfolio, tick the portfolio too.
      </p>
      <a className="btn btn--style-primary btn--size-medium" href="/api/advertising/connect">Continue with Facebook</a>
      {params?.get('connected') ? <p style={{ marginTop: 12 }}>Connected. Check the page and ad account below, then save.</p> : null}
      {err ? (
        <p style={{ marginTop: 12, color: 'var(--theme-error-500)' }}>
          {err === 'not-configured' ? 'The website has no Meta app yet (META_APP_ID and META_APP_SECRET).' : err === 'denied' ? 'Facebook sign-in was cancelled.' : `Facebook said: ${err}`}
        </p>
      ) : null}
    </div>
  )
}
