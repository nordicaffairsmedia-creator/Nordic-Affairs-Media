import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale } from './i18n/config'

/**
 * Language routing.
 * - "/" → English, always (client request). The language switcher changes it.
 * - "/en/…", "/sv/…" etc. pass straight through.
 * - Any other path (typically an old WordPress URL) is rewritten internally to the
 *   English catch-all, which issues one clean 301 to the new address — one redirect
 *   hop instead of two, which matters for SEO.
 */
const LOCALE_COOKIE = 'nam-locale'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const first = pathname.split('/')[1]

  if (isLocale(first)) {
    const res = NextResponse.next()
    res.cookies.set(LOCALE_COOKIE, first, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    return res
  }

  // The site always opens in English; visitors switch language with the switcher.
  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = `/${defaultLocale}`
    return NextResponse.redirect(url, 307)
  }

  const url = req.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Skip the CMS, its API, the staff area, Next internals and any file with an extension.
  matcher: ['/((?!admin|api|staff|_next|.*\\..*).*)'],
}
