'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Menu, Search, X } from 'lucide-react'
import type { Locale } from '@/i18n/config'
import { LanguageSwitcher } from './LanguageSwitcher'

type NavLink = { label: string; href: string }

type Props = {
  links: NavLink[]
  searchHref: string
  locale: Locale
  enquireHref: string
  labels: { menu: string; close: string; search: string; language: string; enquire: string }
}

/** Full-screen menu for phones and small tablets (master prompt §49). */
export function MobileNav({ links, searchHref, locale, enquireHref, labels }: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  // Close when the route changes (a link was followed).
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  // Escape closes; body scroll is locked while open. Both are browser side-effects, so an effect is the right tool.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="relative z-50 inline-flex size-11 items-center justify-center text-ink"
      >
        {open ? (
          <X aria-hidden="true" className="size-6" />
        ) : (
          <Menu aria-hidden="true" className="size-6" />
        )}
        <span className="sr-only">{open ? labels.close : labels.menu}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="fixed inset-0 z-40 overflow-y-auto bg-paper px-4 pt-20 pb-10 motion-safe:animate-[fade-in_var(--duration-calm)_var(--ease-editorial)]"
      >
        <Link
          href={searchHref}
          className="flex min-h-12 items-center gap-3 border-b border-rule font-ui text-body text-slate"
        >
          <Search aria-hidden="true" className="size-5" />
          {labels.search}
        </Link>
        <nav aria-label={labels.menu} className="mt-4">
          <ul>
            {links.map((link) => (
              <li key={link.href} className="border-b border-rule">
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className={`flex min-h-14 items-center font-display text-h3 ${
                    pathname === link.href
                      ? 'underline decoration-brass decoration-2 underline-offset-8'
                      : ''
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href={enquireHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 flex min-h-12 items-center justify-center border border-fjord-deep bg-fjord-wash font-ui text-caption font-semibold uppercase tracking-[0.06em] text-ink"
        >
          {labels.enquire}
        </a>
        <div className="mt-8">
          <p className="eyebrow text-slate">{labels.language}</p>
          <LanguageSwitcher current={locale} label={labels.language} className="mt-2 -ml-2" />
        </div>
      </div>
    </div>
  )
}
