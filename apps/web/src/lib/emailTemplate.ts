import 'server-only'
import { createHmac } from 'node:crypto'
import { escapeHtml } from '@/lib/mail'
import { siteUrl } from '@/lib/site'

/*
 * Campaign emails have two layouts:
 *  - Plain email: your words, one button, files.
 *  - Template: a picture or document uploaded in the Templates library is shown at the top of the email.
 *    The words (headline, message, button) stay editable per campaign.
 * Both can carry files (download buttons for many people, real attachments for one person),
 * and an optional star and tag feedback block.
 */

type Upload = { url?: string | null; filename?: string | null; filesize?: number | null; mimeType?: string | null } | string | number | null | undefined

export type TemplateDoc = {
  picture?: Upload
  document?: Upload
  headline?: string | null
  buttonLabel?: string | null
  buttonUrl?: string | null
}

export type TemplateCampaign = {
  id: string | number
  subject?: string | null
  preheader?: string | null
  body: string
  layout?: 'plain' | 'template' | null
  template?: TemplateDoc | string | number | null
  headline?: string | null
  ctaLabel?: string | null
  feedbackOn?: boolean | null
  feedbackEyebrow?: string | null
  feedbackTitle?: string | null
  feedbackText?: string | null
  tags?: { label?: string | null; emoji?: string | null }[] | null
  attachments?: unknown[] | null
}

export const DEFAULTS = {
  button: 'Learn more',
  feedbackEyebrow: 'Your feedback',
  feedbackTitle: 'How did you like this email?',
  feedbackText: 'Tap below to rate it (1 click):',
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

/** Relative links ("/en/contact") get the real website address in front. */
export function abs(u: string) {
  const v = u.trim()
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v
  return `${siteUrl}${v.startsWith('/') ? '' : '/'}${v}`
}

function fileOf(u: unknown): AttachmentInfo | null {
  if (!u || typeof u !== 'object') return null
  const d = u as { url?: string | null; filename?: string | null; filesize?: number | null; mimeType?: string | null }
  if (!d.url || !d.filename) return null
  return { url: abs(d.url), filename: d.filename, size: d.filesize ?? 0, mime: d.mimeType ?? '' }
}

const templateOf = (c: TemplateCampaign): TemplateDoc | null =>
  c.layout === 'template' && c.template && typeof c.template === 'object' ? c.template : null

/** The picture shown at the top: the template's picture, or its document when that is itself a picture. */
function templatePicture(c: TemplateCampaign): AttachmentInfo | null {
  const t = templateOf(c)
  if (!t) return null
  const pic = fileOf(t.picture)
  if (pic) return pic
  const doc = fileOf(t.document)
  return doc && doc.mime.startsWith('image/') ? doc : null
}

/** Every file that goes with the email: the template's document first, then the files added to the campaign. */
export function attachmentList(c: { attachments?: unknown[] | null } & Partial<TemplateCampaign>): AttachmentInfo[] {
  const out: AttachmentInfo[] = []
  const t = templateOf(c as TemplateCampaign)
  const doc = t ? fileOf(t.document) : null
  if (doc && !doc.mime.startsWith('image/')) out.push(doc)
  for (const row of c.attachments ?? []) {
    const f = (row as { file?: unknown } | null)?.file
    const info = fileOf(f && typeof f === 'object' && 'value' in f ? (f as { value?: unknown }).value : f)
    if (info) out.push(info)
  }
  return out
}

const fill = (t: string, first: string) => t.replace(/\{\{\s*firstName\s*\}\}/g, first)
const paras = (t: string) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
const sizeLabel = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n ? `${Math.max(1, Math.round(n / 1024))} KB` : '')
const nonEmpty = (v: string | null | undefined) => (v && v.trim() ? v.trim() : '')

export type TemplateOpts = {
  first: string
  unsubscribeUrl: string
  /** Button address (a tracking link when one is chosen). */
  cta: string
  footer: string
  test?: boolean
  /** Feedback links are added when we know who is reading ('test' = shown but not recorded). */
  feedbackBase?: { email: string } | null
  /** Bulk sends show files as download buttons. One-to-one sends attach them and only mention it. */
  attachmentsAsLinks?: boolean
}

export function renderTemplate(c: TemplateCampaign, o: TemplateOpts) {
  const first = o.first
  const t = templateOf(c)
  const headline = fill(nonEmpty(c.headline) || nonEmpty(t?.headline), first)
  const bodyParas = paras(fill(c.body || '', first))
  const label = nonEmpty(c.ctaLabel) || nonEmpty(t?.buttonLabel)
  const url = o.cta || nonEmpty(t?.buttonUrl)
  const buttonUrl = url ? abs(url) : ''
  const picture = templatePicture(c)
  const files = attachmentList(c)
  const showFeedback = c.feedbackOn === true && o.feedbackBase

  const fbBase = showFeedback ? `${siteUrl}/api/marketing/feedback?c=${encodeURIComponent(String(c.id))}&e=${encodeURIComponent(o.feedbackBase!.email)}&s=${feedbackSig(c.id, o.feedbackBase!.email)}` : ''
  const stars = ['Poor', 'Fair', 'Good', 'Very Good', 'Outstanding']
  const tagList = (c.tags && c.tags.length ? c.tags : DEFAULTS.tags).filter((x) => x?.label?.trim())

  const starCell = (n: number) =>
    `<td align="center" style="padding:0 4px"><a href="${escapeHtml(fbBase)}&score=${n}" target="_blank" title="${n} - ${stars[n - 1]}" style="display:block;width:52px;height:54px;background:#ffffff;border:1.5px solid #cbd5e1;border-radius:8px;text-align:center;text-decoration:none;box-sizing:border-box"><span style="display:block;font-size:20px;line-height:26px;color:#f59e0b">&#9733;</span><span style="display:block;font-size:12px;font-weight:700;line-height:14px;color:#334155">${n}</span></a></td>`
  const pill = (x: { label?: string | null; emoji?: string | null }) =>
    `<a href="${escapeHtml(fbBase)}&tag=${encodeURIComponent(slugTag(x.label || ''))}" target="_blank" style="display:inline-block;padding:8px 16px;margin:4px;background:#ffffff;border:1px solid #cbd5e1;border-radius:9999px;font-size:12px;font-weight:600;color:#334155;text-decoration:none">${x.emoji ? `${escapeHtml(x.emoji)} ` : ''}${escapeHtml(x.label || '')}</a>`

  const feedback = fbBase
    ? `<tr><td align="center" style="padding:28px 36px;text-align:center;border-top:1px solid #e2e8f0">
<span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;color:#005293">${escapeHtml(nonEmpty(c.feedbackEyebrow) || DEFAULTS.feedbackEyebrow)}</span>
<h4 style="margin:8px 0 6px;font-size:18px;font-weight:700;color:#0f172a">${escapeHtml(nonEmpty(c.feedbackTitle) || DEFAULTS.feedbackTitle)}</h4>
<p style="margin:0 0 18px;font-size:13px;color:#64748b">${escapeHtml(nonEmpty(c.feedbackText) || DEFAULTS.feedbackText)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px"><tr>${[1, 2, 3, 4, 5].map(starCell).join('')}</tr></table>
<div>${tagList.map(pill).join('')}</div></td></tr>`
    : ''

  const downloads =
    files.length && o.attachmentsAsLinks !== false
      ? `<tr><td align="center" style="padding:24px 36px;text-align:center;border-top:1px solid #e2e8f0"><span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;color:#005293">Files for you</span><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:14px auto 0">${files
          .map(
            (f) =>
              `<tr><td align="center" style="padding:5px 0"><a href="${escapeHtml(f.url)}" target="_blank" style="display:inline-block;background:#ffffff;border:1.5px solid #005293;color:#005293;font-weight:700;font-size:13px;padding:10px 22px;border-radius:4px;text-decoration:none">&#8595; ${escapeHtml(f.filename)}${f.size ? ` <span style="font-weight:400;color:#64748b">(${sizeLabel(f.size)})</span>` : ''}</a></td></tr>`,
          )
          .join('')}</table></td></tr>`
      : files.length
        ? `<tr><td align="center" style="padding:20px 36px;text-align:center;border-top:1px solid #e2e8f0;font-size:13px;color:#475569">&#128206; ${files.length === 1 ? 'A file is attached' : `${files.length} files are attached`} to this email.</td></tr>`
        : ''

  const pictureHtml = picture
    ? `<tr><td align="center" style="padding:0;line-height:0">${buttonUrl ? `<a href="${escapeHtml(buttonUrl)}" target="_blank" style="display:block">` : ''}<img src="${escapeHtml(picture.url)}" width="600" alt="${escapeHtml(picture.filename)}" style="width:100%;max-width:600px;height:auto;display:block;border:0">${buttonUrl ? '</a>' : ''}</td></tr>`
    : ''

  const button =
    buttonUrl && label
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0"><tr><td align="center" bgcolor="#005293" style="background-color:#005293;border-radius:4px"><a href="${escapeHtml(buttonUrl)}" target="_blank" style="display:inline-block;background-color:#005293;color:#ffffff;font-weight:700;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;padding:13px 30px;border-radius:4px;text-decoration:none">${escapeHtml(label.toUpperCase())}</a></td></tr></table>`
      : ''

  // A template email is the template itself: no headline, message or button of its own.
  const textBlock = t
    ? ''
    : `<tr><td class="mp" style="padding:30px 36px 28px;color:#334155">
${headline ? `<h2 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:800;color:#0f172a">${escapeHtml(headline)}</h2>` : ''}
${bodyParas.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')}
${button}</td></tr>`

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><title>Nordic Affairs Media</title>
<style>@media only screen and (max-width:600px){.email-container{width:100%!important;max-width:100%!important}.mp{padding-left:20px!important;padding-right:20px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${c.preheader ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(fill(c.preheader, first))}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9"><tr><td align="center" style="padding:24px 12px 40px">
<table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e2e8f0">
${o.test ? '<tr><td style="background:#fef3c7;color:#92400e;font-size:12px;padding:8px 16px;text-align:center">This is a test email.</td></tr>' : ''}
${pictureHtml}
${textBlock}
${downloads}
${feedback}
<tr><td class="mp" style="padding:22px 36px 26px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:19px;color:#64748b">
<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#334155">${escapeHtml(o.footer).replace(/\n/g, '<br>')}</p>
<p style="margin:0;font-size:11px;color:#64748b"><a href="${escapeHtml(o.unsubscribeUrl)}" target="_blank" style="color:#005293;text-decoration:underline">Unsubscribe</a> &nbsp;|&nbsp; <a href="${escapeHtml(`${siteUrl}/en/privacy`)}" target="_blank" style="color:#005293;text-decoration:underline">Privacy Policy</a></p></td></tr>
</table></td></tr></table></body></html>`

  const text = [
    t ? (buttonUrl ? `${picture?.filename || 'Nordic Affairs Media'}: ${buttonUrl}` : '') : headline,
    t ? '' : bodyParas.join('\n\n'),
    !t && buttonUrl && label ? `${label}: ${buttonUrl}` : '',
    files.length && o.attachmentsAsLinks !== false ? `Files:\n${files.map((f) => `${f.filename}: ${f.url}`).join('\n')}` : '',
    '--',
    o.footer,
    `Unsubscribe: ${o.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  return { html, text }
}
