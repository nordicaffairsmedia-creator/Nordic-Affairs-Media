'use client'

import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowRight, ArrowUp, Check, Images, MessageCircle, RotateCcw, Send, Sparkles, Ticket, X } from 'lucide-react'
import type { ChatAction } from '@/lib/assistant/tools'

export type ChatLabels = {
  chatOpen: string
  chatTitle: string
  chatSubtitle: string
  chatPlaceholder: string
  chatSend: string
  chatError: string
  chatClose: string
  chatDisclaimer: string
  chatForget: string
  chatGreeting: string
  chatWelcomeBack: string
  chatNoted: string
  chatWhatsapp: string
  chatEnquiryTitle: string
  chatName: string
  chatEmail: string
  chatSubject: string
  chatMessage: string
  chatConsent: string
  chatEnquirySend: string
  chatEnquirySent: string
  chatSuggest1: string
  chatSuggest2: string
  chatSuggest3: string
  teaserHome: string
  teaserGallery: string
  teaserGalleryOne: string
  teaserEvents: string
  teaserAbout: string
  teaserContact: string
  teaserMedia: string
  chatWaking: string
  chatOnline: string
  chatHello: string
}

type Msg = { role: 'user' | 'assistant'; content: string; actions?: ChatAction[] }
type Memory = { messages: Msg[]; profile: string[]; lastSeen: number }

const STORE = 'nam-nora'

function load(): Memory {
  try {
    const m = JSON.parse(localStorage.getItem(STORE) || 'null') as Memory | null
    if (m && Array.isArray(m.messages) && Array.isArray(m.profile))
      return {
        lastSeen: typeof m.lastSeen === 'number' ? m.lastSeen : 0,
        profile: m.profile.filter((f): f is string => typeof f === 'string'),
        messages: m.messages.filter(
          (x): x is Msg => Boolean(x) && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string',
        ),
      }
  } catch {
    /* blocked or corrupt — start fresh */
  }
  return { messages: [], profile: [], lastSeen: 0 }
}
function save(m: Memory) {
  try {
    // A drafted enquiry is not kept: after a reload it must not come back as an unsent form.
    const messages = m.messages
      .slice(-30)
      .map((x) => (x.actions ? { ...x, actions: x.actions.filter((a) => a.type !== 'enquiry') } : x))
    localStorage.setItem(STORE, JSON.stringify({ ...m, messages, profile: m.profile.slice(-12) }))
  } catch {
    /* not remembered, still works */
  }
}

/** Tiny safe formatter: **bold**, links (this site or https), line breaks, "- " bullets. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  const inline = (s: string, k: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)]+)/g).map((part, i) => {
      const key = `${k}-${i}`
      const bold = part.match(/^\*\*([^*]+)\*\*$/)
      if (bold) return <strong key={key}>{bold[1]}</strong>
      const md = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      const url = md ? md[2] : /^https?:\/\//.test(part) ? part : null
      if (url && /^(https:\/\/|\/(?!\/))/.test(url)) {
        const internal = url.startsWith('/') || (typeof window !== 'undefined' && url.startsWith(window.location.origin))
        return (
          <a key={key} href={url} className="font-medium text-[#e9cf8a] underline decoration-[#c9a24b]/50 underline-offset-2 hover:text-white" {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
            {md ? md[1] : url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
          </a>
        )
      }
      return <Fragment key={key}>{part}</Fragment>
    })
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*[-•*]\s+/.test(l)))
          return (
            <ul key={bi} className="my-1.5 list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-•*]\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ul>
          )
        return (
          <p key={bi} className="my-1.5 first:mt-0 last:mb-0">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 ? <br /> : null}
                {inline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </>
  )
}

const GOLD_GRADIENT = 'bg-[linear-gradient(135deg,#f1dca0_0%,#c9a24b_55%,#9c7426_100%)]'

/** Nora's badge: the Nordic Affairs Media gold mark in a navy medallion, with a slowly turning gold ring. */
function Avatar({ size = 36, ring = true, glow = false }: { size?: number; ring?: boolean; glow?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${glow ? 'nora-breathe' : ''}`}
    >
      {ring ? (
        <span className="nora-ring absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#f1dca0,#9c7426,#1b3566,#c9a24b,#f1dca0)]" />
      ) : null}
      <span className="absolute inset-[2px] flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#1f3d70_0%,#0a1730_70%)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/nam-mark-gold.png" alt="" width={256} height={256} className="w-[66%] select-none" draggable={false} />
      </span>
    </span>
  )
}

function EnquiryCard({ draft, labels, locale }: { draft: Extract<ChatAction, { type: 'enquiry' }>['draft']; labels: ChatLabels; locale: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setState('sending')
    const res = await fetch('/api/assistant/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: draft.type,
        name: f.get('name'),
        email: f.get('email'),
        subject: f.get('subject'),
        message: f.get('message'),
        consent: f.get('consent') === 'on',
        website: f.get('website') || undefined,
        locale,
      }),
    }).catch(() => null)
    setState(res?.ok ? 'sent' : 'error')
  }
  if (state === 'sent')
    return (
      <p className="mt-2 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-[13px] text-emerald-100">
        <Check aria-hidden="true" className="size-4 text-emerald-300" /> {labels.chatEnquirySent}
      </p>
    )
  const field =
    'w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-[13px] text-white placeholder:text-white/40 focus:border-[#c9a24b] focus:outline-none focus:ring-2 focus:ring-[#c9a24b]/25'
  return (
    <form onSubmit={submit} className="mt-2 space-y-2.5 rounded-2xl border border-[#c9a24b]/30 bg-[#0b1730]/80 p-4 shadow-xl">
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-[#e9cf8a] uppercase">
        <Sparkles aria-hidden="true" className="size-3.5" /> {labels.chatEnquiryTitle}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input name="name" required minLength={2} maxLength={80} defaultValue={draft.name} placeholder={labels.chatName} aria-label={labels.chatName} className={field} />
        <input name="email" type="email" required maxLength={200} defaultValue={draft.email} placeholder={labels.chatEmail} aria-label={labels.chatEmail} className={field} />
      </div>
      <input name="subject" required minLength={3} maxLength={150} defaultValue={draft.subject} placeholder={labels.chatSubject} aria-label={labels.chatSubject} className={field} />
      <textarea name="message" required minLength={10} maxLength={5000} rows={5} defaultValue={draft.message} aria-label={labels.chatMessage} className={field} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-2 text-[12px] leading-snug text-white/60">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-[#c9a24b]" /> {labels.chatConsent}
      </label>
      <button
        type="submit"
        disabled={state === 'sending'}
        className={`${GOLD_GRADIENT} inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-[13px] font-semibold text-[#0a1426] shadow-lg transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:opacity-60`}
      >
        <Send aria-hidden="true" className="size-4" /> {labels.chatEnquirySend}
      </button>
      {state === 'error' ? <p className="text-[12px] text-rose-300">{labels.chatError}</p> : null}
    </form>
  )
}

function Actions({ actions, labels, locale }: { actions: ChatAction[]; labels: ChatLabels; locale: string }) {
  return (
    <div className="mt-2.5 space-y-2.5">
      {actions.map((a, i) => {
        if (a.type === 'cards')
          return (
            <ul key={i} className="nora-scroll -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
              {a.items.map((c) => (
                <li key={c.url} className="w-52 shrink-0 snap-start">
                  <a
                    href={c.url}
                    className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-[#0b1730] shadow-lg transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-[#c9a24b]/60"
                  >
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
                    ) : (
                      <span className="flex aspect-[4/5] items-center justify-center bg-[radial-gradient(circle,#1f3d70,#0a1730)] text-[#e9cf8a]">
                        <Sparkles aria-hidden="true" className="size-6" />
                      </span>
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-[#050b18] via-[#050b18]/40 to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 block p-3.5">
                      <span className="line-clamp-2 font-display text-[15px] leading-snug text-white">{c.title}</span>
                      {c.subtitle ? <span className="mt-1 block text-[11px] text-white/65">{c.subtitle}</span> : null}
                      {c.cta ? (
                        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.12em] text-[#e9cf8a] uppercase">
                          {c.cta} <ArrowRight aria-hidden="true" className="size-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )
        if (a.type === 'whatsapp')
          return (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1fa855] px-5 text-[13px] font-semibold text-white shadow-lg transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
            >
              <MessageCircle aria-hidden="true" className="size-4" /> {labels.chatWhatsapp}
            </a>
          )
        if (a.type === 'link')
          return (
            <a
              key={i}
              href={a.url}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#c9a24b]/60 bg-white/[0.04] px-5 text-[13px] font-semibold text-[#e9cf8a] transition-colors hover:bg-[#c9a24b] hover:text-[#0a1426]"
            >
              {a.label} <ArrowRight aria-hidden="true" className="size-4" />
            </a>
          )
        if (a.type === 'enquiry') return <EnquiryCard key={i} draft={a.draft} labels={labels} locale={locale} />
        if (a.type === 'remember')
          return (
            <p key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/60">
              <Check aria-hidden="true" className="size-3.5 text-[#e9cf8a]" /> {labels.chatNoted}
            </p>
          )
        return null
      })}
    </div>
  )
}

/**
 * Nora — the website's AI host. Starts the conversation (a page-aware hello), takes
 * actions (gallery cards, booking buttons, WhatsApp, drafted enquiries the visitor
 * sends), and remembers returning visitors in this browser only ("Forget me" clears it).
 */
export function ChatWidget({ locale, labels, whatsappHref }: { locale: string; labels: ChatLabels; whatsappHref?: string }) {
  const pathname = usePathname() || `/${locale}`
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [mem, setMem] = useState<Memory>({ messages: [], profile: [], lastSeen: 0 })
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMem(load())
    fetch('/api/assistant')
      .then((r) => (r.ok ? (r.json() as Promise<{ enabled?: boolean }>) : null))
      .then((c) => setEnabled(Boolean(c?.enabled)))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [mem.messages, busy, slow])
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const name = mem.profile.map((f) => f.match(/^name:\s*(.+)$/i)?.[1]).find(Boolean)

  function openChat(withLine?: string) {
    setOpen(true)
    setMem((m) => {
      const returning = m.messages.length > 0 && Date.now() - m.lastSeen > 6 * 3600_000
      const opener = withLine ?? (returning ? labels.chatWelcomeBack.replace('{name}', name ? `, ${name}` : '') : m.messages.length ? null : labels.chatGreeting)
      if (!opener) return m
      const next = { ...m, messages: [...m.messages, { role: 'assistant' as const, content: opener }], lastSeen: Date.now() }
      save(next)
      return next
    })
  }

  async function ask(question: string) {
    const q = question.trim().slice(0, 2000)
    if (!q || busy) return
    setError(false)
    setBusy(true)
    setSlow(false)
    // A sleeping server can take a while to answer the first time: say so, and never wait forever.
    const slowTimer = window.setTimeout(() => setSlow(true), 5000)
    const controller = new AbortController()
    const stopTimer = window.setTimeout(() => controller.abort(), 75_000)
    const history: Msg[] = [...mem.messages, { role: 'user', content: q }]
    let current: Memory = { ...mem, messages: [...history, { role: 'assistant', content: '', actions: [] }], lastSeen: Date.now() }
    setMem(current)

    const update = (fn: (last: Msg, m: Memory) => Memory) => {
      const last = current.messages[current.messages.length - 1]!
      current = fn(last, current)
      setMem(current)
    }

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          page: `${pathname}${typeof document !== 'undefined' && document.title ? ` (“${document.title}”)` : ''}`,
          profile: current.profile,
          messages: history.map(({ role, content }) => ({ role, content })).filter((m) => m.content),
        }),
      })
      if (!res.ok || !res.body) throw new Error(String(res.status))
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        window.clearTimeout(slowTimer)
        setSlow(false)
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          let ev: { type: string; delta?: string; action?: ChatAction; code?: string }
          try {
            ev = JSON.parse(line) as typeof ev
          } catch {
            continue
          }
          if (ev.type === 'text' && ev.delta) {
            const delta = ev.delta
            update((last, m) => ({ ...m, messages: [...m.messages.slice(0, -1), { ...last, content: last.content + delta }] }))
          } else if (ev.type === 'action' && ev.action) {
            const action = ev.action
            update((last, m) => ({
              ...m,
              profile: action.type === 'remember' && !m.profile.includes(action.fact) ? [...m.profile, action.fact] : m.profile,
              messages: [...m.messages.slice(0, -1), { ...last, actions: [...(last.actions ?? []), action] }],
            }))
          } else if (ev.type === 'error') {
            if (ev.code) console.warn('[Nora]', ev.code)
            setError(true)
          }
        }
      }
    } catch {
      setError(true)
    } finally {
      window.clearTimeout(slowTimer)
      window.clearTimeout(stopTimer)
      // Drop an empty reply, keep everything else, and remember the conversation.
      update((last, m) => ({
        ...m,
        messages: last.content.trim() || last.actions?.length ? m.messages.map((x) => ({ ...x, content: x.content.trim() })) : m.messages.slice(0, -1),
      }))
      save(current)
      setSlow(false)
      setBusy(false)
    }
  }

  function forget() {
    const fresh: Memory = { messages: [{ role: 'assistant', content: labels.chatGreeting }], profile: [], lastSeen: Date.now() }
    try {
      localStorage.removeItem(STORE)
    } catch {
      /* ignore */
    }
    setMem(fresh)
  }

  if (!enabled) return null

  const suggestions: { text: string; icon: typeof Images }[] = [
    { text: labels.chatSuggest1, icon: Images },
    { text: labels.chatSuggest2, icon: Ticket },
    { text: labels.chatSuggest3, icon: Sparkles },
  ]
  const onlyGreeting = mem.messages.filter((m) => m.role === 'user').length === 0

  return (
    <>
      {!open && whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={labels.chatWhatsapp}
          title={labels.chatWhatsapp}
          className="fixed right-4 bottom-[5.75rem] z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_14px_35px_-10px_rgba(0,0,0,.6)] transition-transform duration-300 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:right-6 sm:bottom-[6.25rem]"
        >
          <svg viewBox="0 0 32 32" className="size-8" fill="currentColor" aria-hidden="true">
            <path d="M16.04 3C9.4 3 4 8.39 4 15.03c0 2.12.55 4.19 1.6 6.01L4 29l8.13-1.56a12.03 12.03 0 0 0 3.9.65h.01C22.68 28.1 28 22.7 28 16.06 28 9.41 22.69 3 16.04 3Zm0 22.05h-.01c-1.2 0-2.38-.32-3.4-.93l-.24-.15-4.83.93.98-4.7-.16-.25a9.93 9.93 0 0 1-1.52-5.3c0-5.5 4.48-9.97 9.99-9.97 5.5 0 9.96 4.47 9.97 9.97 0 5.5-4.47 10.4-10.78 10.4Zm5.47-7.46c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.41-1.49-.89-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z" />
          </svg>
        </a>
      ) : null}
      {!open ? (
        <button
          type="button"
          onClick={() => openChat()}
          aria-label={labels.chatOpen}
          title={labels.chatOpen}
          className="fixed right-4 bottom-4 z-40 rounded-full shadow-[0_18px_45px_-12px_rgba(0,0,0,.75)] transition-transform duration-300 hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6"
        >
          <Avatar size={62} glow />
        </button>
      ) : (
        <section
          role="dialog"
          aria-label={labels.chatTitle}
          className="nora-in fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[radial-gradient(120%_70%_at_100%_0%,#1d3a70_0%,#0b1730_48%,#060d1c_100%)] text-white sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(720px,calc(100vh-3rem))] sm:w-[420px] sm:rounded-[28px] sm:border sm:border-white/10 sm:shadow-[0_40px_100px_-25px_rgba(0,0,0,.8)]"
        >
          {/* Gold hairline and a faint light across the top */}
          <span aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#e9cf8a] to-transparent" />
          <span aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[#c9a24b]/10 blur-3xl" />

          <header className="relative flex items-center gap-3 px-5 pt-5 pb-4">
            <Avatar size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[20px] leading-tight text-white">{labels.chatTitle}</p>
              <p className="truncate text-[12px] text-white/55">{labels.chatSubtitle}</p>
            </div>
            <button type="button" onClick={forget} disabled={busy} title={labels.chatForget} aria-label={labels.chatForget} className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40">
              <RotateCcw aria-hidden="true" className="size-4" />
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label={labels.chatClose} className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:border-white/25 hover:text-white">
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>
          <span aria-hidden="true" className="mx-5 h-px bg-white/10" />

          <div ref={listRef} aria-live="polite" className="nora-scroll relative flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {onlyGreeting ? (
              <div className="nora-in flex flex-col items-center pt-2 pb-1 text-center">
                <Avatar size={76} glow />
                <p className="mt-4 text-[11px] font-semibold tracking-[0.22em] text-[#e9cf8a] uppercase">{labels.chatHello}</p>
              </div>
            ) : null}

            {mem.messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="nora-in ml-12 flex justify-end">
                  <p className={`${GOLD_GRADIENT} rounded-[20px] rounded-tr-md px-4 py-2.5 text-[14px] leading-relaxed font-medium whitespace-pre-line text-[#0a1426] shadow-lg`}>
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="nora-in flex gap-2.5">
                  {onlyGreeting && i === 0 ? null : <Avatar size={30} ring={false} />}
                  <div className="min-w-0 flex-1 text-[14px] leading-relaxed">
                    {m.content ? (
                      <div
                        className={`rounded-[20px] border border-white/10 bg-white/[0.06] px-4 py-3 text-white/90 shadow-sm backdrop-blur ${
                          onlyGreeting && i === 0 ? 'rounded-t-[20px] text-center' : 'rounded-tl-md'
                        }`}
                      >
                        <Rich text={m.content} />
                      </div>
                    ) : busy && i === mem.messages.length - 1 ? (
                      <div className="inline-flex items-center gap-3 rounded-[20px] rounded-tl-md border border-white/10 bg-white/[0.06] px-4 py-3">
                        <span className="flex gap-1" aria-hidden="true">
                          <span className="nora-dot size-1.5 rounded-full bg-[#e9cf8a]" />
                          <span className="nora-dot size-1.5 rounded-full bg-[#e9cf8a] [animation-delay:0.15s]" />
                          <span className="nora-dot size-1.5 rounded-full bg-[#e9cf8a] [animation-delay:0.3s]" />
                        </span>
                        {slow ? <span className="nora-shimmer text-[12px] font-medium">{labels.chatWaking}</span> : null}
                      </div>
                    ) : null}
                    {m.actions?.length ? <Actions actions={m.actions} labels={labels} locale={locale} /> : null}
                  </div>
                </div>
              ),
            )}
            {onlyGreeting && !busy ? (
              <div className="space-y-2.5">
                {suggestions.map(({ text, icon: I }, i) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => void ask(text)}
                    style={{ animationDelay: `${120 + i * 80}ms` }}
                    className="nora-in group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[#c9a24b]/60 hover:bg-white/[0.08]"
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#c9a24b]/15 text-[#e9cf8a]">
                      <I aria-hidden="true" className="size-4" />
                    </span>
                    <span className="flex-1 text-[13px] leading-snug text-white/85">{text}</span>
                    <ArrowRight aria-hidden="true" className="size-4 text-white/40 transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-[#e9cf8a]" />
                  </button>
                ))}
              </div>
            ) : null}
            {error ? (
              <p className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3.5 py-2.5 text-[12px] text-rose-200">{labels.chatError}</p>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (busy) return // keep what they typed until Nora has finished
              const v = inputRef.current?.value ?? ''
              if (inputRef.current) inputRef.current.value = ''
              void ask(v)
            }}
            className="relative px-4 pt-2 pb-3"
          >
            <div className="flex items-end gap-2 rounded-[26px] border border-white/12 bg-white/[0.06] py-2 pr-2 pl-5 shadow-inner backdrop-blur transition-[border-color,box-shadow] focus-within:border-[#c9a24b]/70 focus-within:shadow-[0_0_0_4px_rgba(201,162,75,0.15)]">
              <textarea
                ref={inputRef}
                rows={1}
                maxLength={2000}
                placeholder={labels.chatPlaceholder}
                aria-label={labels.chatPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
                className="max-h-32 min-h-6 flex-1 resize-none self-center bg-transparent py-1.5 text-[14px] text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                aria-label={labels.chatSend}
                className={`${GOLD_GRADIENT} inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[#0a1426] shadow-lg transition-[filter,transform] hover:brightness-110 active:scale-95 disabled:opacity-40`}
              >
                <ArrowUp aria-hidden="true" className="size-5" strokeWidth={2.25} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10.5px] leading-snug text-white/40">{labels.chatDisclaimer}</p>
          </form>
        </section>
      )}
    </>
  )
}
