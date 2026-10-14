'use client'

import { useEffect, useState } from 'react'

export type CookieLabels = {
  cookieTitle: string
  cookieBody: string
  cookieAccept: string
  cookieReject: string
  privacyPolicy: string
}

const COOKIE = 'nam-consent'
const OPEN_EVENT = 'nam:cookie-settings'
type Choice = 'necessary' | 'stats'

function readChoice(): Choice | null {
  const m = document.cookie.match(/(?:^|; )nam-consent=(necessary|stats)/)
  return m ? (m[1] as Choice) : null
}

function saveChoice(choice: Choice) {
  // Remember for 6 months, then ask again (common practice under EU guidance).
  const maxAge = 60 * 60 * 24 * 182
  document.cookie = `${COOKIE}=${choice}; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

/** Loads cookie-free Plausible statistics, and only after consent. Nothing loads if not configured. */
function loadStats() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  if (!domain || document.getElementById('nam-stats')) return
  const s = document.createElement('script')
  s.id = 'nam-stats'
  s.defer = true
  s.dataset.domain = domain
  s.src = 'https://plausible.io/js/script.js'
  document.head.appendChild(s)
}

/**
 * Cookie notice (PRD W-11). Only strictly necessary cookies are used without asking
 * (language, sign-in, checkout). Statistics load only after "Allow statistics".
 * The legal wording of the privacy/cookie policy itself is the client's responsibility.
 */
export function CookieConsent({
  labels,
  privacyHref,
}: {
  labels: CookieLabels
  privacyHref: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const choice = readChoice()
    if (choice === 'stats') loadStats()
    if (!choice) setOpen(true)
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, reopen)
    return () => window.removeEventListener(OPEN_EVENT, reopen)
  }, [])

  const choose = (choice: Choice) => {
    saveChoice(choice)
    if (choice === 'stats') loadStats()
    else if (document.getElementById('nam-stats')) window.location.reload() // unload statistics
    setOpen(false)
  }

  if (!open) return null
  return (
    <section
      role="dialog"
      aria-label={labels.cookieTitle}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink bg-paper print:hidden"
    >
      <div className="container-max flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="font-ui text-caption font-semibold">{labels.cookieTitle}</p>
          <p className="mt-1 font-ui text-caption text-charcoal">
            {labels.cookieBody}{' '}
            <a href={privacyHref} className="text-fjord underline">
              {labels.privacyPolicy}
            </a>
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          {/* Equal weight for both buttons: refusing must be as easy as accepting. */}
          <button
            type="button"
            onClick={() => choose('necessary')}
            className="min-h-11 border border-ink px-4 font-ui text-caption font-semibold"
          >
            {labels.cookieReject}
          </button>
          <button
            type="button"
            onClick={() => choose('stats')}
            className="min-h-11 border border-ink bg-ink px-4 font-ui text-caption font-semibold text-snow"
          >
            {labels.cookieAccept}
          </button>
        </div>
      </div>
    </section>
  )
}

/** Footer link that reopens the notice so visitors can change their mind. */
export function CookieSettingsLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="meta text-ink/80 hover:text-ink"
    >
      {label}
    </button>
  )
}
