'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { localeMeta, switcherOrder, type Locale } from '@/i18n/config'

/** Swaps the locale prefix of the current URL, keeping the reader on the same page. */
export function LanguageSwitcher({
  current,
  label,
  className = '',
}: {
  current: Locale
  label: string
  className?: string
}) {
  const pathname = usePathname() ?? `/${current}`
  const rest = pathname.split('/').slice(2).join('/')

  return (
    <nav aria-label={label} className={className}>
      <ul className="flex items-center gap-1">
        {switcherOrder.map((code) => {
          const active = code === current
          return (
            <li key={code}>
              <Link
                href={`/${code}${rest ? `/${rest}` : ''}`}
                hrefLang={localeMeta[code].htmlLang}
                lang={localeMeta[code].htmlLang}
                aria-current={active ? 'true' : undefined}
                className={`inline-flex min-h-8 items-center px-2 font-ui text-meta ${
                  active
                    ? 'font-semibold text-ink underline decoration-brass decoration-2 underline-offset-[6px]'
                    : 'text-slate hover:text-ink'
                }`}
              >
                {localeMeta[code].nativeLabel}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
