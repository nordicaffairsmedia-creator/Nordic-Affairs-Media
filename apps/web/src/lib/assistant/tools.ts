import 'server-only'
import type { Knowledge } from './knowledge'

/**
 * What Nora can DO, as OpenAI function tools. Every tool only produces a card or a
 * button in the chat — nothing is sent, booked or paid without the visitor pressing it.
 */

export type ChatAction =
  | { type: 'cards'; items: { title: string; subtitle?: string; url: string; image?: string | null; cta?: string }[] }
  | { type: 'whatsapp'; url: string; message: string }
  | { type: 'enquiry'; draft: { type: string; name: string; email: string; subject: string; message: string } }
  | { type: 'remember'; fact: string }
  | { type: 'link'; url: string; label: string }

export const ENQUIRY_TYPES = ['general', 'editorial', 'press', 'events', 'artist', 'advertising', 'partnerships'] as const

export const toolSpecs = [
  {
    type: 'function',
    function: {
      name: 'show_galleries',
      description:
        'Show photo gallery cards (cover, title, date, photo count) the visitor can tap to open. Use whenever galleries are relevant — never just list their names.',
      parameters: {
        type: 'object',
        properties: { slugs: { type: 'array', items: { type: 'string' }, maxItems: 6, description: 'Gallery slugs from the knowledge list, best match first' } },
        required: ['slugs'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_event',
      description: 'Show an upcoming event card with a "Book tickets" button that opens its booking page.',
      parameters: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_whatsapp',
      description:
        'Offer a button that opens a WhatsApp chat with the Nordic Affairs Media team, pre-filled with a short message you write for the visitor (in their language, first person, signed with their name if known).',
      parameters: { type: 'object', properties: { message: { type: 'string', maxLength: 600 } }, required: ['message'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_enquiry',
      description:
        'Prepare a written enquiry to the team (coverage request, press, partnership, booking question). The visitor sees an editable form and must press Send themselves. Ask for their name and email first if you do not know them.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...ENQUIRY_TYPES] },
          name: { type: 'string', maxLength: 80 },
          email: { type: 'string', maxLength: 200 },
          subject: { type: 'string', maxLength: 150 },
          message: { type: 'string', maxLength: 3000 },
        },
        required: ['type', 'subject', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description:
        'Save one short, useful fact the visitor told you about themselves (name, organisation, interests, language preference) so you can greet them personally next time. Never store sensitive data (health, religion, politics, ID or payment numbers, passwords).',
      parameters: { type: 'object', properties: { fact: { type: 'string', maxLength: 120 } }, required: ['fact'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_page',
      description: 'Offer a button to a page on this website (about, galleries, media, events, contact, privacy).',
      parameters: {
        type: 'object',
        properties: {
          section: { type: 'string', enum: ['home', 'about-us', 'gallery', 'media', 'events', 'contact', 'privacy', 'terms'] },
          label: { type: 'string', maxLength: 60 },
        },
        required: ['section', 'label'],
      },
    },
  },
] as const

type Args = Record<string, unknown>
const s = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Runs one tool call. Returns what to tell the model and, if any, the card/button for the visitor. */
export function runTool(
  name: string,
  rawArgs: string,
  ctx: { knowledge: Knowledge; locale: string; labels: { photos: string; book: string; open: string } },
): { result: string; action?: ChatAction } {
  let args: Args = {}
  try {
    args = JSON.parse(rawArgs || '{}') as Args
  } catch {
    return { result: 'Error: arguments were not valid JSON.' }
  }
  const { knowledge, locale, labels } = ctx

  switch (name) {
    case 'show_galleries': {
      const slugs = Array.isArray(args.slugs) ? [...new Set(args.slugs.map((x) => s(x, 200)))].slice(0, 6) : []
      const items = slugs
        .map((slug) => knowledge.galleries.find((g) => g.slug === slug))
        .filter((g): g is NonNullable<typeof g> => Boolean(g))
        .map((g) => ({
          title: g.title,
          subtitle: [g.date, g.photos ? `${g.photos} ${labels.photos}` : ''].filter(Boolean).join(' · '),
          url: g.url,
          image: g.cover,
          cta: labels.open,
        }))
      if (!items.length) return { result: 'None of those slugs exist. Use slugs exactly as listed.' }
      return { result: `Shown to the visitor: ${items.map((i) => i.title).join('; ')}.`, action: { type: 'cards', items } }
    }
    case 'show_event': {
      const e = knowledge.events.find((x) => x.slug === s(args.slug, 200))
      if (!e) return { result: 'No upcoming event with that slug.' }
      return {
        result: `Shown event card for ${e.title} with a Book tickets button.`,
        action: {
          type: 'cards',
          items: [{ title: e.title, subtitle: [e.when, e.venue].filter(Boolean).join(' · '), url: e.url, image: e.cover, cta: labels.book }],
        },
      }
    }
    case 'open_whatsapp': {
      if (!knowledge.whatsapp) return { result: 'WhatsApp is not configured; offer the contact page instead.' }
      const message = s(args.message, 600)
      return {
        result: 'WhatsApp button shown (opens with the drafted message).',
        action: { type: 'whatsapp', message, url: `https://wa.me/${knowledge.whatsapp}?text=${encodeURIComponent(message)}` },
      }
    }
    case 'draft_enquiry': {
      const type = (ENQUIRY_TYPES as readonly string[]).includes(s(args.type)) ? s(args.type) : 'general'
      const draft = {
        type,
        name: s(args.name, 80),
        email: s(args.email, 200),
        subject: s(args.subject, 150),
        message: s(args.message, 3000),
      }
      return {
        result: 'Editable enquiry form shown. It is NOT sent until the visitor presses Send — say so.',
        action: { type: 'enquiry', draft },
      }
    }
    case 'remember': {
      const fact = s(args.fact, 120)
      if (!fact) return { result: 'Nothing to remember.' }
      return { result: 'Saved in this visitor’s browser.', action: { type: 'remember', fact } }
    }
    case 'open_page': {
      const section = s(args.section, 20)
      const allowed = ['home', 'about-us', 'gallery', 'media', 'events', 'contact', 'privacy', 'terms']
      if (!allowed.includes(section)) return { result: 'Unknown section.' }
      const path = section === 'home' ? '' : `/${section}`
      return {
        result: 'Button shown.',
        action: { type: 'link', url: `/${locale}${path}`, label: s(args.label, 60) || section },
      }
    }
    default:
      return { result: `Unknown tool ${name}.` }
  }
}
