'use client'

import { useLocale, useTheme, useTranslation } from '@payloadcms/ui'
import { useEffect } from 'react'

/*
 * Top-bar tools of the content manager:
 *  · Sun / moon button — light or navy look (remembered per person).
 *  · Content language has real effect: choosing Svenska also turns the panel's own
 *    buttons and menus Swedish (English otherwise), and for Svenska / தமிழ் / മലയാളം a
 *    "Translate" shortcut appears that fills that language automatically from English.
 */
const NAMES: Record<string, string> = { sv: 'Svenska', ta: 'தமிழ்', ml: 'മലയാളം' }

export function HeaderTools() {
  const { theme, setTheme } = useTheme()
  const locale = useLocale()
  const { i18n, switchLanguage } = useTranslation()
  const code = locale?.code ?? 'en'

  useEffect(() => {
    const want = code === 'sv' ? 'sv' : 'en'
    if (switchLanguage && i18n?.language !== want) void switchLanguage(want as never)
  }, [code, i18n?.language, switchLanguage])

  const dark = theme !== 'light'
  return (
    <span className="nam-howdy">
      {NAMES[code] ? (
        <a href="/staff/translate" className="nam-lang-hint" title="Fill this language automatically from English">
          Translate to {NAMES[code]} →
        </a>
      ) : null}
      <button
        type="button"
        className="nam-theme-toggle"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        aria-label={dark ? 'Switch to light look' : 'Switch to navy look'}
        title={dark ? 'Light look' : 'Navy look'}
      >
        {dark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        )}
      </button>
    </span>
  )
}
