import { Bebas_Neue, Inter, Oswald } from 'next/font/google'

/**
 * The old website's typography, used where the client wants the old look exactly
 * (landing slideshow, About page): Bebas Neue headings, Inter text, Oswald buttons.
 */
export const bebas = Bebas_Neue({ subsets: ['latin', 'latin-ext'], weight: '400', display: 'swap' })
export const inter = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], display: 'swap' })
export const oswald = Oswald({ subsets: ['latin', 'latin-ext'], weight: ['400'], display: 'swap' })
