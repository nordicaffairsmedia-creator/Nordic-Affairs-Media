import Link from 'next/link'
import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * Previous / next links that keep the current filters. Plain links, no JavaScript,
 * so every page of a listing is crawlable.
 */
export function Pagination({
  basePath,
  page,
  totalPages,
  params = {},
  t,
}: {
  basePath: string
  page: number
  totalPages: number
  params?: Record<string, string | undefined>
  t: Dictionary
}) {
  if (totalPages <= 1) return null
  const url = (p: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
    if (p > 1) q.set('page', String(p))
    const s = q.toString()
    return s ? `${basePath}?${s}` : basePath
  }
  const linkCls =
    'inline-flex min-h-11 items-center font-ui text-caption font-semibold text-fjord hover:underline'
  return (
    <nav
      aria-label={t.page}
      className="mt-14 flex items-center justify-between border-t border-rule pt-6"
    >
      {page > 1 ? (
        <Link href={url(page - 1)} rel="prev" className={linkCls}>
          ← {t.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="meta">
        {t.page} {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={url(page + 1)} rel="next" className={linkCls}>
          {t.next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
