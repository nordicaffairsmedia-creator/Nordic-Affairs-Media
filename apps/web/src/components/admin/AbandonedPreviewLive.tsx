'use client'

import { useFormFields } from '@payloadcms/ui'
import { renderAbandoned } from '@/lib/abandonedEmail'

/**
 * The reminder email exactly as the buyer gets it, English and Swedish. It reads what is
 * typed in the form right now, so the preview changes while you write (no Save needed).
 * Empty boxes show the standard text, like the real email does.
 */
export function AbandonedPreviewLive({ title, url }: { title: string; url: string }) {
  const fields = useFormFields(([f]) => f)
  const val = (k: string) => {
    const v = fields['abandoned.' + k]?.value
    return typeof v === 'string' ? v : ''
  }
  const code = val('discountCode').trim().toUpperCase()

  const view = (lang: 'en' | 'sv') => {
    const L = lang === 'en' ? 'En' : 'Sv'
    return renderAbandoned({
      lang,
      eventTitle: title,
      firstName: 'Alex',
      url,
      stopUrl: url,
      code: code || undefined,
      custom: { subject: val('subject' + L), message: val('message' + L), button: val('button' + L) },
    })
  }

  return (
    <div style={{ margin: '16px 0' }}>
      <strong>Preview</strong>
      <p style={{ opacity: 0.7, margin: '4px 0 12px' }}>
        Exactly the email the buyer gets, Swedish or English following the buyer&apos;s language. It updates while you type.
        The discount line shows only when you fill in a discount code. Press Save to keep your changes.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {(['en', 'sv'] as const).map((l) => {
          const mail = view(l)
          return (
            <div key={l}>
              <div style={{ opacity: 0.7, marginBottom: 4 }}>{l === 'en' ? 'English' : 'Svenska'}</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <span style={{ opacity: 0.7 }}>Subject: </span>
                {mail.subject}
              </div>
              <iframe
                title={`Preview ${l}`}
                sandbox=""
                srcDoc={mail.html}
                style={{ width: '100%', height: 420, border: '1px solid var(--theme-elevation-150)', borderRadius: 6, background: '#fff' }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
