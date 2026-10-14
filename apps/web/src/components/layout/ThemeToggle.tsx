'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

import { THEME_KEY as KEY } from '@/lib/theme'

/**
 * Navy (default) ⇄ light. The choice is remembered in this browser only; the small
 * script in the page head applies it before the first paint, so there is no flash.
 */
export function ThemeToggle({
  labels,
  compact = false,
  className = '',
}: {
  labels: { light: string; dark: string }
  /** Smaller tap area for the slim utility row. */
  compact?: boolean
  className?: string
}) {
  const [light, setLight] = useState(false)

  useEffect(() => {
    setLight(document.documentElement.dataset.theme === 'light')
  }, [])

  const toggle = () => {
    const next = !light
    setLight(next)
    if (next) document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
    try {
      localStorage.setItem(KEY, next ? 'light' : 'navy')
    } catch {
      /* private mode — the choice just isn't remembered */
    }
  }

  const label = light ? labels.dark : labels.light
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`inline-flex ${compact ? 'size-8' : 'size-10'} items-center justify-center text-charcoal hover:text-fjord ${className}`}
    >
      {light ? (
        <Moon aria-hidden="true" className="size-4.5" />
      ) : (
        <Sun aria-hidden="true" className="size-4.5" />
      )}
    </button>
  )
}
