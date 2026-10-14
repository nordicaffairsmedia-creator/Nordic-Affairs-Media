import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { PlaceholderBadge } from '@/components/ui/PlaceholderBadge'
import { ButtonLink, Eyebrow, SectionHeading, TextLink } from '@/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
}

/**
 * Living design-system reference for the team (master prompt §33). Hidden from search
 * engines. All text here is typographic specimen copy, not editorial content.
 */
const colors = [
  { name: 'paper', hex: '#F7F5F0', use: 'Page background' },
  { name: 'snow', hex: '#FFFFFF', use: 'Raised surfaces, event band' },
  { name: 'ink', hex: '#121414', use: 'Headlines, body, dark bands' },
  { name: 'charcoal', hex: '#2B2F31', use: 'Article body, decks' },
  { name: 'slate', hex: '#5C6366', use: 'Meta, secondary text' },
  { name: 'rule', hex: '#DCD8CF', use: 'Hairlines, dividers' },
  { name: 'fjord', hex: '#1F4E68', use: 'Links, focus, interaction' },
  { name: 'fjord-wash', hex: '#E6EDF0', use: 'Newsletter band, selection' },
  { name: 'brass', hex: '#A87A32', use: 'Warm accent — rules, markers only' },
  { name: 'brass-text', hex: '#835C20', use: 'Warm accent text (AA on paper)' },
]

const typeScale = [
  { token: 'display', className: 'text-display font-display', sample: 'Stories from the North' },
  { token: 'h1', className: 'text-h1 font-display', sample: 'Specimen headline, set large' },
  { token: 'h2', className: 'text-h2 font-display', sample: 'Section-level specimen headline' },
  { token: 'h3', className: 'text-h3 font-display', sample: 'Card headline specimen' },
  {
    token: 'deck',
    className: 'text-deck font-text text-charcoal',
    sample: 'A deck summarises the story in one or two calm sentences.',
  },
  {
    token: 'article',
    className: 'text-article font-text text-charcoal',
    sample:
      'Article body copy is set in Newsreader at a comfortable measure of roughly sixty-five characters.',
  },
  {
    token: 'body',
    className: 'text-body font-ui',
    sample: 'Interface copy uses Hanken Grotesk for clarity at small sizes.',
  },
  { token: 'meta', className: 'meta', sample: 'By Specimen Author · 8 October 2026 · 6 min read' },
]

export default async function StyleguidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)

  return (
    <div className="container-wide space-y-20 py-14">
      <header>
        <Eyebrow tone="brass">Internal</Eyebrow>
        <h1 className="mt-3 text-h1">Design system</h1>
        <p className="mt-4 max-w-2xl text-slate">
          Tokens live in <code>src/styles/globals.css</code>. Components live in{' '}
          <code>src/components</code>. Change a token once and every page follows.
        </p>
      </header>

      <section>
        <SectionHeading title="Colour" />
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {colors.map((c) => (
            <li key={c.name}>
              <div className="aspect-[4/3] border border-rule" style={{ backgroundColor: c.hex }} />
              <p className="mt-2 font-ui text-caption font-semibold">{c.name}</p>
              <p className="meta">
                {c.hex} — {c.use}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading title="Type scale" />
        <ul className="space-y-8">
          {typeScale.map((s) => (
            <li key={s.token} className="grid gap-2 md:grid-cols-[8rem_1fr] md:gap-8">
              <span className="meta pt-2">{s.token}</span>
              <p className={s.className}>{s.sample}</p>
            </li>
          ))}
        </ul>
        <p className="meta mt-8">
          Tamil and Malayalam pages switch automatically to Noto Serif / Noto Sans in those scripts,
          with taller line height and no letter-spacing on labels. View this page at /ta/styleguide
          or /ml/styleguide to check.
        </p>
      </section>

      <section>
        <SectionHeading title="Labels, links and actions" />
        <div className="flex flex-wrap items-center gap-6">
          <Eyebrow>Fjord eyebrow</Eyebrow>
          <Eyebrow tone="brass">Brass eyebrow</Eyebrow>
          <Eyebrow tone="slate">Slate eyebrow</Eyebrow>
          <TextLink href={`/${locale}`}>Text link</TextLink>
          <PlaceholderBadge label={t.placeholder} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={`/${locale}`}>Primary action</ButtonLink>
          <ButtonLink href={`/${locale}`} variant="outline">
            Secondary action
          </ButtonLink>
        </div>
      </section>

      <section>
        <SectionHeading title="Rules of the system" />
        <ul className="grid gap-6 md:grid-cols-3">
          {[
            [
              'Square corners',
              'Images, buttons and panels are square-cut. Only small badges are rounded.',
            ],
            [
              'One cold, one warm',
              'Fjord blue means "you can act here". Brass is decoration — thin rules and date markers.',
            ],
            [
              'Rules, not boxes',
              'Sections are separated by a heavy top rule and whitespace, not cards and shadows.',
            ],
            ['Light only', 'No dark mode: the brand is print-led and photography-led.'],
            [
              'Calm motion',
              '420 ms ease-out underline and a 2% image zoom on hover. Nothing moves by itself.',
            ],
            [
              'Honest placeholders',
              'Development content always carries the orange Placeholder badge.',
            ],
          ].map(([title, body]) => (
            <li key={title} className="border-t border-rule pt-4">
              <p className="font-ui text-caption font-semibold">{title}</p>
              <p className="mt-1 text-caption text-slate">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
