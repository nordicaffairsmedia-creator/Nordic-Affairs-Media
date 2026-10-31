import 'server-only'
import { createHmac } from 'node:crypto'
import { escapeHtml } from '@/lib/mail'
import { siteUrl } from '@/lib/site'

/*
 * The "Clean Blue" email template (email-template-1). The logo, the banner picture, the colours and the layout
 * are fixed. Only the words and the three button links are edited, per campaign, in the admin.
 * Anything left empty falls back to the template's own wording, so an email always looks finished.
 */

export type TemplateCampaign = {
  id: string | number
  subject?: string | null
  preheader?: string | null
  body: string
  intro?: string | null
  headline?: string | null
  ctaLabel?: string | null
  button2Label?: string | null
  button2Url?: string | null
  headline2?: string | null
  text2?: string | null
  button3Label?: string | null
  button3Url?: string | null
  feedbackOn?: boolean | null
  feedbackEyebrow?: string | null
  feedbackTitle?: string | null
  feedbackText?: string | null
  tags?: { label?: string | null; emoji?: string | null }[] | null
  attachments?: unknown[] | null
}

export const DEFAULTS = {
  button1: 'Request coverage',
  button1Url: '/en/contact',
  intro:
    'Nordic Affairs Media is a Sweden-based media organization specializing in diplomatic events, official visits, international summits, royal ceremonies, and sports coverage across Sweden and worldwide.',
  headline: 'Authoritative Coverage for High-Level Global Affairs',
  body:
    'From high-level multilateral summits in Stockholm to bilateral state visits across Europe and the globe, our team delivers accredited photography, real-time editorial pool feeds, and broadcast-ready video assets. We work closely with embassies, diplomatic missions, and international press delegations to ensure total compliance with state protocol.\n\nWhether you need dedicated pool camera positions at the Royal Palace, red-carpet arrival documentation for head-of-state visits, or high-definition syndication feeds, our experienced crews provide seamless end-to-end media production.',
  button2: 'Access press archive',
  button2Url: '/en/media',
  headline2: 'Elite Sports & Outside Broadcast Operations',
  text2:
    'In addition to state affairs, Nordic Affairs Media deploys specialized 4K camera units and live broadcast infrastructure for major Scandinavian sports championships, arena ice hockey tournaments, and international athletic competitions.',
  button3: 'View sports wire',
  button3Url: '/en/events',
  feedbackEyebrow: 'Executive media feedback',
  feedbackTitle: 'How was your experience working with our press pool?',
  feedbackText: 'Tap below to submit your rating instantly (1 click):',
  tags: [
    { emoji: '⚡', label: 'Rapid Delivery' },
    { emoji: '🎥', label: '4K Broadcast Quality' },
    { emoji: '📜', label: 'Strict Protocol Compliance' },
    { emoji: '🤝', label: 'Dedicated Press Liaison' },
  ],
}

export const slugTag = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')

/** Signs a feedback click, so only the real email can record one. */
export const feedbackSig = (campaignId: string | number, email: string) =>
  createHmac('sha256', process.env.INTERNAL_API_KEY ?? 'no-key').update(`fb|${campaignId}|${email.toLowerCase()}`).digest('hex').slice(0, 32)

export type AttachmentInfo = { url: string; filename: string; size: number; mime: string }

/** Turns the attachments chosen in the admin (loaded with depth 1) into plain file facts. */
export function attachmentList(c: { attachments?: unknown[] | null }): AttachmentInfo[] {
  const out: AttachmentInfo[] = []
  for (const row of c.attachments ?? []) {
    const f = (row as { file?: { value?: unknown } | null })?.file
    const doc = (f && typeof f === 'object' && 'value' in f ? f.value : f) as { url?: string; filename?: string; filesize?: number; mimeType?: string } | string | number | null | undefined
    if (!doc || typeof doc !== 'object' || !doc.url || !doc.filename) continue
    out.push({ url: abs(doc.url), filename: doc.filename, size: doc.filesize ?? 0, mime: doc.mimeType ?? '' })
  }
  return out
}

/** Relative links ("/en/contact") get the real website address in front. */
export function abs(u: string) {
  const v = u.trim()
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v
  return `${siteUrl}${v.startsWith('/') ? '' : '/'}${v}`
}

const pick = (v: string | null | undefined, d: string) => (v && v.trim() ? v.trim() : d)
const fill = (t: string, first: string) => t.replace(/\{\{\s*firstName\s*\}\}/g, first)
const paras = (t: string) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
const sizeLabel = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n ? `${Math.max(1, Math.round(n / 1024))} KB` : '')

const btn = (href: string, label: string) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr><td align="center" bgcolor="#005293" style="background-color:#005293;border-radius:4px"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;background-color:#005293;color:#ffffff;font-weight:700;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;padding:13px 30px;border-radius:4px;text-decoration:none">${escapeHtml(label.toUpperCase())}</a></td></tr></table>`

export type TemplateOpts = {
  first: string
  unsubscribeUrl: string
  /** Button 1 address (a tracking link when one is chosen). */
  cta: string
  footer: string
  test?: boolean
  /** Feedback links are only added when we know who is reading. */
  feedbackBase?: { email: string } | null
  /** Bulk sends show attachments as download buttons. Real attachments (one-to-one) are listed as a note. */
  attachmentsAsLinks?: boolean
}

export function renderTemplate(c: TemplateCampaign, o: TemplateOpts) {
  const first = o.first
  const t = (v: string | null | undefined, d: string) => fill(pick(v, d), first)
  const intro = t(c.intro, DEFAULTS.intro)
  const headline = t(c.headline, DEFAULTS.headline)
  const bodyParas = paras(t(c.body, DEFAULTS.body))
  const headline2 = t(c.headline2, DEFAULTS.headline2)
  const text2 = t(c.text2, DEFAULTS.text2)
  const url1 = abs(o.cta || DEFAULTS.button1Url)
  const url2 = abs(pick(c.button2Url, DEFAULTS.button2Url))
  const url3 = abs(pick(c.button3Url, DEFAULTS.button3Url))
  const label1 = pick(c.ctaLabel, DEFAULTS.button1)
  const label2 = pick(c.button2Label, DEFAULTS.button2)
  const label3 = pick(c.button3Label, DEFAULTS.button3)
  const files = attachmentList(c)
  const img = (name: string) => `${siteUrl}/email/${name}`
  const home = siteUrl

  const fbBase = o.feedbackBase && c.feedbackOn !== false ? `${siteUrl}/api/marketing/feedback?c=${encodeURIComponent(String(c.id))}&e=${encodeURIComponent(o.feedbackBase.email)}&s=${feedbackSig(c.id, o.feedbackBase.email)}` : ''
  const stars = ['Poor', 'Fair', 'Good', 'Very Good', 'Outstanding']
  const tagList = (c.tags && c.tags.length ? c.tags : DEFAULTS.tags).filter((x) => x?.label?.trim())

  const starCell = (n: number) =>
    `<td align="center" style="padding:0 4px"><a href="${escapeHtml(fbBase)}&score=${n}" target="_blank" title="${n} - ${stars[n - 1]}" style="display:block;width:52px;height:54px;background:#ffffff;border:1.5px solid #cbd5e1;border-radius:8px;text-align:center;text-decoration:none;box-sizing:border-box"><span style="display:block;font-size:20px;line-height:26px;color:#f59e0b">&#9733;</span><span style="display:block;font-size:12px;font-weight:700;line-height:14px;color:#334155">${n}</span></a></td>`
  const pill = (x: { label?: string | null; emoji?: string | null }) =>
    `<a href="${escapeHtml(fbBase)}&tag=${encodeURIComponent(slugTag(x.label || ''))}" target="_blank" style="display:inline-block;padding:8px 16px;margin:4px;background:#ffffff;border:1px solid #cbd5e1;border-radius:9999px;font-size:12px;font-weight:600;color:#334155;text-decoration:none">${x.emoji ? `${escapeHtml(x.emoji)} ` : ''}${escapeHtml(x.label || '')}</a>`

  const feedback = fbBase
    ? `<tr><td align="center" style="padding:32px 36px 28px;text-align:center">
<span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;color:#005293">${escapeHtml(t(c.feedbackEyebrow, DEFAULTS.feedbackEyebrow))}</span>
<h4 style="margin:8px 0 6px;font-size:18px;font-weight:700;color:#0f172a">${escapeHtml(t(c.feedbackTitle, DEFAULTS.feedbackTitle))}</h4>
<p style="margin:0 0 18px;font-size:13px;color:#64748b">${escapeHtml(t(c.feedbackText, DEFAULTS.feedbackText))}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px"><tr>${[1, 2, 3, 4, 5].map(starCell).join('')}</tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 20px;width:100%;max-width:290px"><tr><td align="left" style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase">1 &bull; Poor</td><td align="right" style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase">5 &bull; Outstanding</td></tr></table>
<div>${tagList.map(pill).join('')}</div></td></tr>`
    : ''

  const downloads =
    files.length && o.attachmentsAsLinks !== false
      ? `<tr><td align="center" style="padding:28px 36px;text-align:center;border-top:1px solid #e2e8f0"><span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;color:#005293">Files for you</span><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:14px auto 0">${files
          .map(
            (f) =>
              `<tr><td align="center" style="padding:5px 0"><a href="${escapeHtml(f.url)}" target="_blank" style="display:inline-block;background:#ffffff;border:1.5px solid #005293;color:#005293;font-weight:700;font-size:13px;padding:10px 22px;border-radius:4px;text-decoration:none">&#8595; ${escapeHtml(f.filename)}${f.size ? ` <span style="font-weight:400;color:#64748b">(${sizeLabel(f.size)})</span>` : ''}</a></td></tr>`,
          )
          .join('')}</table></td></tr>`
      : files.length
        ? `<tr><td align="center" style="padding:20px 36px;text-align:center;border-top:1px solid #e2e8f0;font-size:13px;color:#475569">&#128206; ${files.length === 1 ? 'A file is attached' : `${files.length} files are attached`} to this email.</td></tr>`
        : ''

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><title>Nordic Affairs Media</title>
<style>@media only screen and (max-width:600px){.email-container{width:100%!important;max-width:100%!important}.mp{padding-left:20px!important;padding-right:20px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${c.preheader ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(fill(c.preheader, first))}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9"><tr><td align="center" style="padding:24px 12px 40px">
<table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e2e8f0">
${o.test ? '<tr><td style="background:#fef3c7;color:#92400e;font-size:12px;padding:8px 16px;text-align:center">This is a test email.</td></tr>' : ''}
<tr><td align="center" style="background-color:#0e233f;padding:22px 20px;text-align:center"><a href="${escapeHtml(home)}" target="_blank" style="display:inline-block;text-decoration:none"><img src="${img('logo.png')}" width="190" alt="Nordic Affairs Media" style="width:190px;max-width:100%;height:auto;display:block;margin:0 auto;border:0"></a></td></tr>
<tr><td align="center" style="padding:0;background-color:#ffffff;line-height:0"><a href="${escapeHtml(home)}" target="_blank" style="display:block"><img src="${img('hero-banner.jpg')}" width="600" alt="Nordic Affairs Media - Diplomacy, Royalty, State Affairs, Sports Coverage" style="width:100%;max-width:600px;height:auto;display:block;border:0"></a></td></tr>
<tr><td align="center" class="mp" style="padding:34px 36px 26px;text-align:center"><div style="margin:0 auto 22px">${btn(url1, label1)}</div>
<p style="margin:0 auto;font-size:15px;line-height:24px;color:#475569;max-width:480px">${escapeHtml(intro).replace(/\n/g, '<br>')}</p></td></tr>
<tr><td align="center" class="mp" style="padding:10px 36px 28px;text-align:center"><div style="width:48px;height:3px;background-color:#005293;margin:0 auto 24px"></div>
<h2 style="margin:0 0 16px;font-size:26px;line-height:34px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">${escapeHtml(headline)}</h2>
${bodyParas.map((p, i) => `<p style="margin:0 auto ${i === bodyParas.length - 1 ? 24 : 16}px;font-size:14px;line-height:23px;color:#334155;max-width:500px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')}
${btn(url2, label2)}</td></tr>
<tr><td align="center" class="mp" style="padding:10px 36px 32px;text-align:center;background-color:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
<h3 style="margin:10px 0 14px;font-size:22px;line-height:30px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">${escapeHtml(headline2)}</h3>
<p style="margin:0 auto 22px;font-size:14px;line-height:22px;color:#475569;max-width:480px">${escapeHtml(text2).replace(/\n/g, '<br>')}</p>${btn(url3, label3)}</td></tr>
${downloads}
${feedback}
<tr><td class="mp" style="padding:26px 36px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:19px;color:#64748b">
<p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#334155">${escapeHtml(o.footer).replace(/\n/g, '<br>')}</p>
<p style="margin:0 0 16px;font-size:11px;color:#94a3b8;line-height:16px">Diplomacy &bull; Royalty &bull; State Affairs &bull; Sports Coverage across Sweden and Worldwide.<br>Official Website: <a href="${escapeHtml(home)}" target="_blank" style="color:#005293;font-weight:600">${escapeHtml(home.replace(/^https?:\/\//, ''))}</a></p>
<p style="margin:0;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:14px"><a href="${escapeHtml(o.unsubscribeUrl)}" target="_blank" style="color:#005293;text-decoration:underline">Unsubscribe</a> &nbsp;|&nbsp; <a href="${escapeHtml(`${siteUrl}/en/privacy`)}" target="_blank" style="color:#005293;text-decoration:underline">Privacy Policy</a></p></td></tr>
</table></td></tr></table></body></html>`

  const text = [
    intro,
    `${label1}: ${url1}`,
    headline,
    bodyParas.join('\n\n'),
    `${label2}: ${url2}`,
    headline2,
    text2,
    `${label3}: ${url3}`,
    files.length && o.attachmentsAsLinks !== false ? `Files:\n${files.map((f) => `${f.filename}: ${f.url}`).join('\n')}` : '',
    '--',
    o.footer,
    `Unsubscribe: ${o.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  return { html, text }
}
