import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Hanken_Grotesk, Inter, Newsreader } from 'next/font/google'
import '@/styles/globals.css'

const hanken = Hanken_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-hanken-src',
  display: 'swap',
})
const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-newsreader-src',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter-src',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Staff — Nordic Affairs Media', template: '%s — Staff' },
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/favicon-48.png', apple: '/icons/apple-touch-icon.png' },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#000000' }

/** Separate shell for the staff area (dashboard and gate scanner). English only, never indexed. */
export default function StaffRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${newsreader.variable} ${inter.variable}`}>
      <body className="min-h-dvh bg-black">{children}</body>
    </html>
  )
}
