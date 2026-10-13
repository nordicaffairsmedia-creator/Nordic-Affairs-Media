import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

/**
 * Breaks one long text into readable paragraphs: keeps the editor's own blank lines,
 * otherwise groups whole sentences into paragraphs of roughly 300+ characters.
 */
export function toParagraphs(text: string): string[] {
  const clean = text.replace(/\r/g, '').trim()
  const own = clean.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (own.length > 1 || clean.length < 450) return own
  const sentences = clean.replace(/\s+/g, ' ').split(/(?<=[.!?][\"”’)]?)\s+(?=[\"“‘(]?[A-ZÅÄÖÉ0-9])/)
  const out: string[] = []
  let cur = ''
  for (const s of sentences) {
    cur = cur ? `${cur} ${s}` : s
    if (cur.length >= 300) {
      out.push(cur)
      cur = ''
    }
  }
  if (cur) {
    // A short tail joins the previous paragraph instead of standing alone.
    if (cur.length < 140 && out.length) out[out.length - 1] += ` ${cur}`
    else out.push(cur)
  }
  return out
}

/** Small uppercase label above headlines. `tone="brass"` is the warm cultural accent. */
export function Eyebrow({
  children,
  href,
  tone = 'fjord',
}: {
  children: ReactNode
  href?: string
  tone?: 'fjord' | 'brass' | 'slate'
}) {
  const color = { fjord: 'text-fjord', brass: 'text-brass-text', slate: 'text-slate' }[tone]
  const cls = `eyebrow ${color}`
  return href ? (
    <Link href={href} className={`${cls} hover:underline`}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  )
}

/** Section heading with a heavy top rule — the backbone of the editorial grid. */
export function SectionHeading({
  title,
  href,
  linkLabel,
  as: Tag = 'h2',
}: {
  title: string
  href?: string
  linkLabel?: string
  as?: 'h2' | 'h3'
}) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-4 border-t-2 border-rule-strong pt-3">
      <Tag className="font-ui text-meta font-bold uppercase tracking-[0.12em] text-ink">
        {title}
      </Tag>
      {href && linkLabel ? <TextLink href={href}>{linkLabel}</TextLink> : null}
    </div>
  )
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 font-ui text-meta font-semibold text-fjord hover:text-fjord-deep"
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className="size-3.5 transition-transform duration-(--duration-quick) group-hover:translate-x-0.5"
      />
    </Link>
  )
}

type ButtonProps = {
  href: string
  children: ReactNode
  variant?: 'solid' | 'outline'
}

export function ButtonLink({ href, children, variant = 'solid' }: ButtonProps) {
  const base =
    'inline-flex min-h-11 items-center justify-center gap-2 px-5 font-ui text-caption font-semibold transition-colors duration-(--duration-quick)'
  const styles =
    variant === 'solid'
      ? 'bg-ink text-snow hover:bg-fjord-deep'
      : 'border border-ink text-ink hover:bg-ink hover:text-snow'
  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  )
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <div className="border-y border-rule py-16 text-center">
      <p className="font-display text-h3">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-slate">{body}</p>
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  )
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Structured data must be raw JSON; escaping "<" prevents breaking out of the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

/** Top of a listing or profile page: small label, big title, optional intro. */
export function PageHeader({
  eyebrow,
  title,
  intro,
  children,
  centered = false,
}: {
  eyebrow?: string
  title: string
  intro?: string | null
  children?: ReactNode
  /** Title in the middle, intro justified with its last line centred (galleries). */
  centered?: boolean
}) {
  return (
    <header
      className={`border-b border-rule-strong pt-10 pb-8 md:pt-16 md:pb-10${centered ? ' text-center' : ''}`}
    >
      {eyebrow ? <span className="eyebrow text-brass-text">{eyebrow}</span> : null}
      <h1 className="mt-3 text-h1 md:text-display">{title}</h1>
      {intro ? (
        centered ? (
          <div className="mx-auto mt-6 max-w-3xl space-y-4 text-left">
            {toParagraphs(intro).map((para, i) => (
              <p key={i} className="text-justify font-text text-deck text-charcoal [hyphens:manual]">
                {para}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-5 max-w-2xl font-text text-deck text-charcoal">{intro}</p>
        )
      ) : null}
      {children}
    </header>
  )
}
