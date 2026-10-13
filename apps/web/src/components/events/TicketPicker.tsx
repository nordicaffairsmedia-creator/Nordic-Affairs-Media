'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { bookingApiUrl, errorText, type BookingLabels } from '@/lib/booking'

type TierView = { tierId: string; name: string; description?: string | null; price: number }

type Availability = {
  onSale: boolean
  paymentsReady: boolean
  promoCodes: boolean
  maxPerOrder: number
  holdMinutes: number
  tiers: { tierId: string; onSale: boolean; remaining: number }[]
}

type Props = {
  eventId: string
  tiers: TierView[]
  currency: string
  locale: string
  intlLocale: string
  termsHref: string
  privacyHref: string
  labels: BookingLabels
}

/**
 * Choose tickets → enter name and email → go to Stripe to pay (PRD B-02..B-05).
 * Live availability comes from the booking API; the server re-checks everything,
 * so nothing here can be tampered with to get cheaper or extra tickets.
 */
export function TicketPicker({
  eventId,
  tiers,
  currency,
  locale,
  intlLocale,
  termsHref,
  privacyHref,
  labels,
}: Props) {
  const [avail, setAvail] = useState<Availability | null>(null)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)

  // Fetch live availability once on mount (and after a sold-out answer).
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`${bookingApiUrl}/events/${eventId}/availability`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
      .then((r) => (r.ok ? (r.json() as Promise<Availability>) : null))
      .then(setAvail)
      .catch(() => undefined)
    return () => ctrl.abort()
  }, [eventId, reload])

  // Stripe sends the buyer back with ?checkout=cancelled when they abandon payment.
  useEffect(() => {
    setCancelled(new URLSearchParams(window.location.search).get('checkout') === 'cancelled')
  }, [])

  const money = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, { style: 'currency', currency, maximumFractionDigits: 2 }),
    [intlLocale, currency],
  )
  const remainingOf = (tierId: string) => {
    const a = avail?.tiers.find((t) => t.tierId === tierId)
    return a && a.onSale ? a.remaining : 0
  }
  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0)
  const total = tiers.reduce((sum, t) => sum + t.price * (qty[t.tierId] ?? 0), 0)
  const max = avail?.maxPerOrder ?? 10

  const change = (tierId: string, delta: number) => {
    setError(null)
    setQty((q) => {
      const next = Math.max(0, Math.min((q[tierId] ?? 0) + delta, remainingOf(tierId)))
      const others = totalQty - (q[tierId] ?? 0)
      return { ...q, [tierId]: Math.min(next, max - others) }
    })
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (totalQty === 0) return setError(labels.chooseTickets)
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${bookingApiUrl}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          locale,
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          promoCode: String(form.get('promo') ?? '').trim() || undefined,
          acceptTerms: form.get('terms') === 'on',
          items: Object.entries(qty)
            .filter(([, n]) => n > 0)
            .map(([tierId, quantity]) => ({ tierId, quantity })),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (res.ok && data.url) {
        window.location.assign(data.url)
        return
      }
      if (data.error === 'sold_out') {
        setQty({})
        setReload((n) => n + 1)
      }
      setError(errorText(data.error, labels))
    } catch {
      setError(labels.errGeneric)
    }
    setBusy(false)
  }

  if (avail && (!avail.onSale || !avail.paymentsReady)) {
    return (
      <p className="font-ui text-caption font-semibold text-alert">
        {avail.onSale ? labels.errPayments : labels.errUnavailable}
      </p>
    )
  }

  const inputCls =
    'min-h-12 w-full border border-rule bg-snow px-3 font-ui text-body text-ink focus-visible:border-fjord'

  return (
    <form onSubmit={submit} className="space-y-8" aria-busy={busy}>
      {cancelled ? (
        <p className="border-l-2 border-brass bg-snow p-3 font-ui text-caption">
          {labels.checkoutCancelled}
        </p>
      ) : null}

      <ul className="divide-y divide-rule border-y border-rule">
        {tiers.map((tier) => {
          const left = remainingOf(tier.tierId)
          const n = qty[tier.tierId] ?? 0
          const soldOut = avail !== null && left === 0
          return (
            <li key={tier.tierId} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="font-ui text-body font-semibold">{tier.name}</p>
                {tier.description ? <p className="meta">{tier.description}</p> : null}
                <p className="mt-1 font-display text-h3">{money.format(tier.price)}</p>
                <p className={`meta ${soldOut ? 'text-alert' : ''}`}>
                  {soldOut
                    ? labels.soldOut
                    : avail && left <= 20
                      ? `${left} ${labels.left}`
                      : labels.incVat}
                </p>
              </div>
              <div className="flex items-center gap-1" role="group" aria-label={tier.name}>
                <button
                  type="button"
                  onClick={() => change(tier.tierId, -1)}
                  disabled={n === 0 || busy}
                  className="inline-flex size-11 items-center justify-center border border-rule disabled:opacity-30"
                >
                  <Minus aria-hidden="true" className="size-4" />
                  <span className="sr-only">{labels.removeOne}</span>
                </button>
                <output
                  aria-live="polite"
                  className="w-10 text-center font-ui text-body font-semibold"
                >
                  {n}
                </output>
                <button
                  type="button"
                  onClick={() => change(tier.tierId, 1)}
                  disabled={soldOut || n >= left || totalQty >= max || busy || !avail}
                  className="inline-flex size-11 items-center justify-center border border-ink disabled:border-rule disabled:opacity-30"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  <span className="sr-only">{labels.addOne}</span>
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex items-baseline justify-between">
        <span className="font-ui text-caption font-semibold">{labels.ticketsTotal}</span>
        <span className="font-display text-h2">{money.format(total)}</span>
      </div>

      {totalQty > 0 ? (
        <fieldset className="space-y-4">
          <legend className="eyebrow mb-2 text-slate">{labels.yourDetails}</legend>
          <label className="block">
            <span className="meta mb-1 block">{labels.fullName}</span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="meta mb-1 block">{labels.emailLabel}</span>
            <input
              name="email"
              type="email"
              required
              maxLength={200}
              autoComplete="email"
              className={inputCls}
            />
          </label>
          {avail?.promoCodes ? (
            <label className="block">
              <span className="meta mb-1 block">{labels.promoCode}</span>
              <input
                name="promo"
                maxLength={40}
                autoComplete="off"
                className={`${inputCls} uppercase`}
              />
            </label>
          ) : null}
          <label className="flex items-start gap-3 font-ui text-caption">
            <input
              name="terms"
              type="checkbox"
              required
              className="mt-1 size-5 accent-[var(--color-fjord)]"
            />
            <span>
              {labels.acceptTerms}{' '}
              <a href={termsHref} target="_blank" className="text-fjord underline">
                {labels.terms}
              </a>{' '}
              ·{' '}
              <a href={privacyHref} target="_blank" className="text-fjord underline">
                {labels.privacyPolicy}
              </a>
            </span>
          </label>
        </fieldset>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="border-l-2 border-alert bg-snow p-3 font-ui text-caption text-alert"
        >
          {error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={busy || totalQty === 0}
          className="inline-flex min-h-12 w-full items-center justify-center bg-ink px-6 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep disabled:opacity-40 sm:w-auto"
        >
          {busy ? labels.processing : labels.continueToPayment}
        </button>
        <p className="meta mt-3">
          {avail ? labels.holdNote.replace('{n}', String(avail.holdMinutes)) : null}{' '}
          {labels.feesNote}
        </p>
      </div>
    </form>
  )
}
