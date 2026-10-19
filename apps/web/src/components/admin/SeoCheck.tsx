'use client'

import { useDocumentInfo, useFormFields, useLocale } from '@payloadcms/ui'

/*
 * SEO checker in the spirit of Yoast on the old site: one coloured score, a Google preview
 * and a plain to-do list. It reads what is typed in the form right now, so the score
 * changes while you write. Empty SEO fields fall back to the title / summary, exactly as
 * the website does.
 */

const SITE = 'nordicaffairsmedia.com'
const PATHS: Record<string, string> = {
  pages: '',
  galleries: '/gallery',
  articles: '/news',
  events: '/events',
  publications: '/publications',
}

type Check = { ok: boolean; warn?: boolean; text: string }

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const plain = (v: unknown): string => {
  // Rich text (Lexical) → plain text, enough for a description fallback.
  if (!v || typeof v !== 'object') return str(v)
  const out: string[] = []
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return
    const o = n as { text?: unknown; children?: unknown[]; root?: unknown }
    if (typeof o.text === 'string') out.push(o.text)
    if (o.root) walk(o.root)
    if (Array.isArray(o.children)) o.children.forEach(walk)
  }
  walk(v)
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

export function SeoCheck() {
  const { collectionSlug } = useDocumentInfo()
  const locale = useLocale()
  const f = useFormFields(([fields]) => fields)
  const val = (path: string) => f[path]?.value

  const title = str(val('title'))
  const seoTitle = str(val('seo.title')) || title
  const summary =
    str(val('deck')) || str(val('summary')) || str(val('description')) || str(val('intro')) || plain(val('body'))
  const desc = str(val('seo.description')) || summary
  const slug = str(val('slug'))
  const kw = str(val('seo.focusKeyword')).toLowerCase()
  const hasImage = Boolean(
    val('seo.image') || val('heroImage') || val('cover') || val('poster') || val('photos.0.image'),
  )
  const hidden = Boolean(val('seo.noIndex'))

  const kwSlug = kw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const checks: Check[] = [
    kw
      ? { ok: true, text: `Focus keyword: “${kw}”.` }
      : { ok: false, warn: true, text: 'Add a focus keyword — the phrase people would search for.' },
    seoTitle.length >= 30 && seoTitle.length <= 60
      ? { ok: true, text: `Title length is good (${seoTitle.length} characters).` }
      : {
          ok: false,
          warn: seoTitle.length > 0,
          text: seoTitle.length
            ? `Title is ${seoTitle.length} characters — aim for 30 to 60.`
            : 'Add a title.',
        },
    desc.length >= 120 && desc.length <= 160
      ? { ok: true, text: `Description length is good (${desc.length} characters).` }
      : {
          ok: false,
          warn: desc.length > 0,
          text: desc.length
            ? `Description is ${desc.length} characters — aim for 120 to 160.`
            : 'Add a description (SEO → Description, or a summary).',
        },
    ...(kw
      ? [
          seoTitle.toLowerCase().includes(kw)
            ? { ok: true, text: 'The focus keyword is in the title.' }
            : { ok: false, warn: true, text: 'Put the focus keyword in the title.' },
          desc.toLowerCase().includes(kw)
            ? { ok: true, text: 'The focus keyword is in the description.' }
            : { ok: false, warn: true, text: 'Use the focus keyword in the description.' },
          kwSlug && slug.includes(kwSlug)
            ? { ok: true, text: 'The focus keyword is in the web address.' }
            : { ok: false, warn: true, text: 'The web address does not contain the focus keyword.' },
        ]
      : []),
    slug && slug.length <= 75
      ? { ok: true, text: 'Web address is short and clean.' }
      : { ok: false, warn: true, text: slug ? 'Web address is long — shorten it.' : 'Add a web address (slug).' },
    hasImage
      ? { ok: true, text: 'Has a sharing image for Google, Facebook and WhatsApp.' }
      : { ok: false, warn: true, text: 'Add an image so shared links show a picture.' },
    hidden
      ? { ok: false, text: '“Hide from search engines” is ticked — Google will not show this page.' }
      : { ok: true, text: 'Visible to search engines.' },
  ]

  const passed = checks.filter((c) => c.ok).length
  const score = Math.round((passed / checks.length) * 100)
  const level = hidden || score < 50 ? 'bad' : score < 80 ? 'ok' : 'good'
  const label = level === 'good' ? 'Good' : level === 'ok' ? 'Needs work' : 'Poor'
  const path = PATHS[collectionSlug ?? ''] ?? ''
  const url = `${SITE} › ${locale?.code ?? 'en'}${path ? ' › ' + path.slice(1) : ''}${slug ? ' › ' + slug : ''}`

  return (
    <div className="nam-seo">
      <div className="nam-seo__head">
        <span className={`nam-seo__dot nam-seo__dot--${level}`} aria-hidden="true" />
        <span className="nam-seo__score">
          SEO score: <strong>{label}</strong> · {score}/100
        </span>
      </div>

      <div className="nam-seo__preview" aria-label="Google preview">
        <p className="nam-seo__url">{url}</p>
        <p className="nam-seo__title">{(seoTitle || 'Page title').slice(0, 65)}</p>
        <p className="nam-seo__desc">
          {desc ? (desc.length > 160 ? desc.slice(0, 157) + '…' : desc) : 'Add a description to control what Google shows here.'}
        </p>
      </div>

      <ul className="nam-seo__list">
        {checks
          .slice()
          .sort((a, b) => Number(a.ok) - Number(b.ok))
          .map((c) => (
            <li key={c.text} className="nam-seo__item">
              <span
                className={`nam-seo__dot nam-seo__dot--${c.ok ? 'good' : c.warn ? 'ok' : 'bad'}`}
                aria-hidden="true"
              />
              {c.text}
            </li>
          ))}
      </ul>
    </div>
  )
}
