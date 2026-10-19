import localFont from 'next/font/local'

/**
 * The old website's typography, used where the client wants the old look exactly
 * (landing slideshow, About page): Bebas Neue headings, Inter text, Oswald buttons.
 * Bundled with the project (no download from Google at build time, so deploys cannot fail
 * when Google Fonts is slow or changes its answer). Latin letters only, which covers
 * English and Swedish; other scripts fall back to the site's own fonts.
 */
export const bebas = localFont({
  src: [{ path: './fonts/bebas-neue-latin-400-normal.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  fallback: ['Impact', 'sans-serif'],
})
export const inter = localFont({
  src: [
    { path: './fonts/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
export const oswald = localFont({
  src: [{ path: './fonts/oswald-latin-400-normal.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  fallback: ['Arial Narrow', 'sans-serif'],
})
