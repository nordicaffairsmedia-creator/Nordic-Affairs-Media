'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { Locale } from '@/i18n/config'
import { activeKey, type MainLink } from '@/lib/nav'

type Props = {
  locale: Locale
  links: MainLink[]
  galleries: { title: string; href: string }[]
  allGalleriesLabel: string
  menuLabel: string
}

/** Desktop menu. The current tab is underlined; Gallery opens a list of all galleries. */
export function PrimaryNav({ locale, links, galleries, allGalleriesLabel, menuLabel }: Props) {
  const current = activeKey(usePathname() ?? `/${locale}`, locale)
  const item =
    'inline-flex h-12 items-center gap-1 px-4 font-ui text-caption font-semibold uppercase tracking-[0.08em] text-ink hover:text-fjord'
  const underline = 'underline decoration-brass decoration-2 underline-offset-[10px]'

  return (
    <nav aria-label={menuLabel}>
      <ul className="flex flex-wrap items-center justify-center">
        {links.map((l) => {
          const isCurrent = current === l.key
          if (!l.dropdown) {
            return (
              <li key={l.key}>
                <Link
                  href={l.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`${item} ${isCurrent ? underline : ''}`}
                >
                  {l.label}
                </Link>
              </li>
            )
          }
          return (
            <li key={l.key} className="group relative">
              <Link
                href={l.href}
                aria-current={isCurrent ? 'page' : undefined}
                aria-haspopup={galleries.length > 0 ? 'true' : undefined}
                className={`${item} ${isCurrent ? underline : ''}`}
              >
                {l.label}
                {galleries.length > 0 ? (
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:rotate-180"
                  />
                ) : null}
              </Link>
              {galleries.length > 0 ? (
                <div className="invisible absolute top-full left-1/2 z-50 w-80 -translate-x-1/2 border border-rule bg-navy-deep opacity-0 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)] transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="max-h-[70vh] overflow-y-auto py-2">
                    {galleries.map((g) => (
                      <li key={g.href}>
                        <Link
                          href={g.href}
                          className="block px-4 py-2 font-ui text-caption text-charcoal hover:bg-fjord-wash hover:text-ink"
                        >
                          {g.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={l.href}
                    className="block border-t border-rule px-4 py-3 font-ui text-caption font-semibold text-fjord hover:text-ink"
                  >
                    {allGalleriesLabel} →
                  </Link>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
