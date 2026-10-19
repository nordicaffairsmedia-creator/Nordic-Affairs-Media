'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { bookingApiUrl } from '@/lib/booking'
import { formatMinor, type PublicOrder } from '@/lib/bookingTypes'

export type AccountLabels = {
  myBookingsIntro: string
  emailLabel: string
  sendCode: string
  codeSent: string
  enterCode: string
  verify: string
  invalidCode: string
  signOut: string
  noBookings: string
  downloadTickets: string
  downloadReceipt: string
  resendTickets: string
  sent: string
  requestCancellation: string
  cancellationRequested: string
  statusPaid: string
  statusRefunded: string
  statusPartiallyRefunded: string
  orderRef: string
  ticketsCount: string
  total: string
  processing: string
  errGeneric: string
}

const TOKEN_KEY = 'nam-bookings-token'

// Browser storage can be unavailable (private mode, blocked cookies) — never let that break the page.
const store = {
  get: () => {
    try {
      return window.localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (v: string) => {
    try {
      window.localStorage.setItem(TOKEN_KEY, v)
    } catch {
      /* stays signed in for this visit only */
    }
  },
  clear: () => {
    try {
      window.localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* nothing to clear */
    }
  },
}

/**
 * "My bookings" (PRD B-01, B-08): sign in with a one-time code sent by email, then
 * view, download, re-send or ask to cancel bookings. No passwords to remember.
 */
export function MyBookings({
  locale,
  intlLocale,
  labels,
}: {
  locale: string
  intlLocale: string
  labels: AccountLabels
}) {
  const [token, setToken] = useState<string | null>(null)
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [orders, setOrders] = useState<PublicOrder[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, string>>({})

  const api = useCallback(
    async (path: string, init: RequestInit = {}) =>
      fetch(`${bookingApiUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
        cache: 'no-store',
      }),
    [token],
  )

  // Restore a sign-in from an earlier visit.
  useEffect(() => {
    setToken(store.get())
  }, [])

  useEffect(() => {
    if (!token) return
    api('/me/orders')
      .then(async (r) => {
        if (r.status === 401) {
          store.clear()
          setToken(null)
          return
        }
        const data = (await r.json()) as { orders: PublicOrder[]; email: string }
        setOrders(data.orders)
        setEmail(data.email)
      })
      .catch(() => setMessage(labels.errGeneric))
  }, [token, api, labels.errGeneric])

  async function requestCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const r = await api('/auth/code', {
      method: 'POST',
      body: JSON.stringify({ email, locale }),
    }).catch(() => null)
    setBusy(false)
    if (r?.ok) {
      setStep('code')
      setMessage(labels.codeSent)
    } else setMessage(labels.errGeneric)
  }

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const code = String(new FormData(e.currentTarget).get('code') ?? '').trim()
    setBusy(true)
    setMessage(null)
    const r = await api('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }).catch(() => null)
    setBusy(false)
    if (r?.ok) {
      const data = (await r.json()) as { token: string }
      store.set(data.token)
      setToken(data.token)
    } else setMessage(labels.invalidCode)
  }

  async function signOut() {
    await api('/auth/signout', { method: 'POST' }).catch(() => null)
    store.clear()
    setToken(null)
    setOrders(null)
    setStep('email')
  }

  async function download(ref: string, file: 'tickets.pdf' | 'receipt.pdf') {
    const r = await api(`/orders/${encodeURIComponent(ref)}/${file}`).catch(() => null)
    if (!r?.ok) return setMessage(labels.errGeneric)
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = `${file.replace('.pdf', '')}-${ref}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function action(ref: string, path: 'resend' | 'cancel-request', okText: string) {
    const r = await api(`/orders/${encodeURIComponent(ref)}/${path}`, { method: 'POST' }).catch(
      () => null,
    )
    setDone((d) => ({ ...d, [`${ref}:${path}`]: r?.ok ? okText : labels.errGeneric }))
  }

  const inputCls =
    'min-h-12 w-full border border-rule bg-snow px-3 font-ui text-body focus-visible:border-fjord'
  const btn =
    'inline-flex min-h-11 items-center bg-ink px-5 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep disabled:opacity-40'
  const linkBtn = 'font-ui text-meta font-semibold text-fjord hover:underline'

  if (!token) {
    return (
      <div className="max-w-md">
        <p className="text-charcoal">{labels.myBookingsIntro}</p>
        {step === 'email' ? (
          <form onSubmit={requestCode} className="mt-6 space-y-4">
            <label className="block">
              <span className="meta mb-1 block">{labels.emailLabel}</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </label>
            <button type="submit" disabled={busy} className={btn}>
              {busy ? labels.processing : labels.sendCode}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <label className="block">
              <span className="meta mb-1 block">{labels.enterCode}</span>
              <input
                name="code"
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                className={`${inputCls} tracking-[0.4em]`}
              />
            </label>
            <button type="submit" disabled={busy} className={btn}>
              {busy ? labels.processing : labels.verify}
            </button>
          </form>
        )}
        {message ? (
          <p role="status" className="meta mt-4 border-l-2 border-fjord pl-3">
            {message}
          </p>
        ) : null}
      </div>
    )
  }

  const statusText = (s: PublicOrder['status']) =>
    s === 'refunded'
      ? labels.statusRefunded
      : s === 'partially_refunded'
        ? labels.statusPartiallyRefunded
        : labels.statusPaid

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-4">
        <p className="meta">{email}</p>
        <button type="button" onClick={signOut} className={linkBtn}>
          {labels.signOut}
        </button>
      </div>
      {message ? <p className="meta mt-4">{message}</p> : null}
      {orders && orders.length === 0 ? (
        <p className="mt-8 text-slate">{labels.noBookings}</p>
      ) : null}
      <ul className="mt-6 space-y-6">
        {(orders ?? []).map((o) => {
          const upcoming = new Date(o.event.startsAt) > new Date()
          const live = o.tickets.filter((tk) => tk.status !== 'cancelled').length
          return (
            <li key={o.ref} className="border border-rule bg-snow p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-h3">{o.event.title}</p>
                <span className="eyebrow text-brass-text">{statusText(o.status)}</span>
              </div>
              <p className="meta mt-1">
                {new Intl.DateTimeFormat(intlLocale, {
                  dateStyle: 'full',
                  timeStyle: 'short',
                  timeZone: 'Europe/Stockholm',
                }).format(new Date(o.event.startsAt))}
                {o.event.venue ? ` · ${o.event.venue}` : ''}
              </p>
              <p className="meta mt-1">
                {labels.orderRef} {o.ref} · {live} {labels.ticketsCount} · {labels.total}{' '}
                {formatMinor(o.total, o.currency, intlLocale)}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {live > 0 ? (
                  <button
                    type="button"
                    onClick={() => download(o.ref, 'tickets.pdf')}
                    className={linkBtn}
                  >
                    {labels.downloadTickets}
                  </button>
                ) : null}
                {o.total > 0 ? (
                  <button
                    type="button"
                    onClick={() => download(o.ref, 'receipt.pdf')}
                    className={linkBtn}
                  >
                    {labels.downloadReceipt}
                  </button>
                ) : null}
                {live > 0 ? (
                  <button
                    type="button"
                    onClick={() => action(o.ref, 'resend', labels.sent)}
                    className={linkBtn}
                  >
                    {done[`${o.ref}:resend`] ?? labels.resendTickets}
                  </button>
                ) : null}
                {upcoming && o.status === 'paid' ? (
                  o.cancelRequested || done[`${o.ref}:cancel-request`] ? (
                    <span className="meta">
                      {done[`${o.ref}:cancel-request`] ?? labels.cancellationRequested}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => action(o.ref, 'cancel-request', labels.cancellationRequested)}
                      className="font-ui text-meta font-semibold text-alert hover:underline"
                    >
                      {labels.requestCancellation}
                    </button>
                  )
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
