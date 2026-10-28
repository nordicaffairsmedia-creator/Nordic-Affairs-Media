'use client'

import { readTrackingSource } from '@/lib/trackingSource'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { bookingApiUrl, checkoutDestination, errorText } from '@/lib/booking'
import type { CheckoutLabels } from '@/lib/checkoutLabels'
import { COUNTRIES, countryName } from '@/lib/countries'
import { readCart, saveCart } from '@/lib/cart'
import { SeatMap, type Seating } from '@/components/account/SeatMap'
import { PaymentMethods, type PayMethod } from '@/components/account/PaymentMethods'
import { WalletPay, type Wallet } from '@/components/account/WalletPay'

type Tier = { tierId: string; name: string; description?: string | null; price: number }
type ServiceKey = 'smsTickets' | 'refundProtection' | 'reminder'
type Offered = { key: ServiceKey; name: string; price: number }
type Availability = {
  seating?: Seating | null
  onSale: boolean
  paymentsReady: boolean
  demoPayments?: boolean
  promoCodes: boolean
  maxPerOrder: number
  holdMinutes: number
  serviceFeePercent: number
  services: Offered[]
  tiers: { tierId: string; onSale: boolean; remaining: number }[]
}
type Quote = {
  subtotal: number
  discount: number
  fees: number
  servicesTotal: number
  total: number
  currency: string
  promoCode: string | null
  services: Offered[]
}
type Buyer = {
  name: string
  email: string
  dial: string
  phone: string
  country: string
  postalCode: string
  company: boolean
  companyName: string
  marketing: boolean
  promoter: boolean
  terms: boolean
}

type Props = {
  event: { id: string; slug: string; title: string; currency: string; tiers: Tier[] }
  locale: string
  intlLocale: string
  termsHref: string
  privacyHref: string
  cartHref: string
  eventHref: string
  dateLabel: string
  labels: CheckoutLabels
  /** Swish button on the payment step (Site settings > Feature switches > swish). */
  swish?: boolean
}

const emptyBuyer: Buyer = {
  name: '',
  email: '',
  dial: '+46',
  phone: '',
  country: 'SE',
  postalCode: '',
  company: false,
  companyName: '',
  marketing: false,
  promoter: false,
  terms: false,
}

/**
 * The My Booking checkout, in four steps: Tickets → Buyer's information → Services → Payment.
 * Every amount shown comes from the booking API (/quote); the server re-checks everything at /checkout.
 */
export function CheckoutFlow({
  event,
  locale,
  intlLocale,
  termsHref,
  privacyHref,
  cartHref,
  eventHref,
  dateLabel,
  labels: l,
  swish,
}: Props) {
  const [avail, setAvail] = useState<Availability | null>(null)
  const [availStatus, setAvailStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errHint, setErrHint] = useState('')
  const [reload, setReload] = useState(0)
  const [step, setStep] = useState<'tickets' | 'buyer' | 'services' | 'payment'>('tickets')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [seatSel, setSeatSel] = useState<string[]>([])
  const [promoText, setPromoText] = useState('')
  const [promo, setPromo] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [buyer, setBuyer] = useState<Buyer>(emptyBuyer)
  const [services, setServices] = useState<Record<ServiceKey, boolean>>({
    smsTickets: false,
    refundProtection: false,
    reminder: false,
  })
  const [busy, setBusy] = useState(false)
  const [wallet, setWallet] = useState<{ method: Wallet; clientSecret: string; publishableKey: string; returnUrl: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const restored = useRef(false)

  const money = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency: event.currency,
        minimumFractionDigits: 2,
      }),
    [intlLocale, event.currency],
  )
  const fmt = (minor: number) => money.format(minor / 100)

  // Live availability.
  useEffect(() => {
    const ctrl = new AbortController()
    setAvailStatus('loading')
    fetch(`${bookingApiUrl}/events/${event.id}/availability?locale=${encodeURIComponent(locale)}`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<Availability>
      })
      .then((a) => {
        setAvail(a)
        setAvailStatus('ready')
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Shown under the error so a wrong server setting can be found in seconds.
        setErrHint(`${window.location.origin} → ${bookingApiUrl} (${e instanceof Error ? e.message : 'error'})`)
        setAvailStatus('error')
      })
    return () => ctrl.abort()
  }, [event.id, reload, locale])

  const remainingOf = useCallback(
    (tierId: string) => {
      const a = avail?.tiers.find((t) => t.tierId === tierId)
      return a && a.onSale ? a.remaining : 0
    },
    [avail],
  )

  // Pick up a saved cart for this event (from the Cart tab or an earlier visit).
  useEffect(() => {
    if (!avail || restored.current) return
    restored.current = true
    if (avail.seating) return // seats are picked on the map, never restored from a saved cart
    const c = readCart()
    if (!c || c.eventId !== event.id) return
    const next: Record<string, number> = {}
    for (const line of c.lines) {
      const q = Math.min(line.quantity, remainingOf(line.tierId), avail.maxPerOrder)
      if (q > 0 && event.tiers.some((t) => t.tierId === line.tierId)) next[line.tierId] = q
    }
    setQty(next)
    if (c.promoCode && avail.promoCodes) {
      setPromoText(c.promoCode)
      setPromo(c.promoCode)
    }
  }, [avail, event.id, event.tiers, remainingOf])

  // Reserved seating: the ticket count per tier is simply the seats picked in that tier's sections.
  const seatTier = useMemo(() => {
    const m = new Map<string, string>()
    for (const sec of avail?.seating?.sections ?? [])
      for (const r of sec.rows) for (const s of r.seats) if (sec.tierId) m.set(s.id, sec.tierId)
    return m
  }, [avail])
  const seated = Boolean(avail?.seating)
  useEffect(() => {
    if (!seated) return
    const q: Record<string, number> = {}
    for (const id of seatSel) {
      const t = seatTier.get(id)
      if (t) q[t] = (q[t] ?? 0) + 1
    }
    setQty(q)
  }, [seated, seatSel, seatTier])

  const lines = useMemo(
    () =>
      event.tiers
        .filter((t) => (qty[t.tierId] ?? 0) > 0)
        .map((t) => ({ tier: t, quantity: qty[t.tierId] ?? 0 })),
    [event.tiers, qty],
  )
  const totalQty = lines.reduce((s, x) => s + x.quantity, 0)
  const max = avail?.maxPerOrder ?? 10

  // Authoritative totals from the server whenever tickets, promo or services change.
  const quoteBody = useMemo(
    () =>
      JSON.stringify({
        eventId: event.id,
        locale,
        promoCode: promo ?? undefined,
        items: lines.map((x) => ({ tierId: x.tier.tierId, quantity: x.quantity })),
        services,
      }),
    [event.id, locale, promo, lines, services],
  )
  useEffect(() => {
    if (totalQty === 0) {
      setQuote(null)
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch(`${bookingApiUrl}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: quoteBody,
        signal: ctrl.signal,
      })
        .then(async (r) => {
          const data = (await r.json().catch(() => ({}))) as Quote & { error?: string }
          if (r.ok) setQuote(data)
          else {
            if (data.error === 'invalid_promo') {
              setPromo(null)
              setError(errorText(data.error, l))
            }
          }
        })
        .catch(() => undefined)
    }, 120)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [quoteBody, totalQty, l])

  // Order countdown (steps 2-4).
  useEffect(() => {
    if (!expiresAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  useEffect(() => {
    if (expiresAt && now >= expiresAt) {
      setExpiresAt(null)
      setStep('tickets')
      setError(l.hubExpired)
    }
  }, [now, expiresAt, l.hubExpired])
  const left = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0
  const clock = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`

  const change = (tierId: string, delta: number) => {
    setError(null)
    setNotice(null)
    setQty((q) => {
      const cur = q[tierId] ?? 0
      const others = totalQty - cur
      const next = Math.max(0, Math.min(cur + delta, remainingOf(tierId), max - others))
      return { ...q, [tierId]: next }
    })
  }

  const toggleSeat = (id: string) => {
    setError(null)
    setNotice(null)
    setSeatSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= max ? cur : [...cur, id]))
  }

  const persistCart = (code: string | null) =>
    seated ? undefined : saveCart({
      eventId: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      currency: event.currency,
      locale,
      lines: lines.map((x) => ({
        tierId: x.tier.tierId,
        name: x.tier.name,
        unitPrice: Math.round(x.tier.price * 100),
        quantity: x.quantity,
      })),
      ...(code ? { promoCode: code } : {}),
    })

  /** Checks a promo code on the server. Returns true when it is valid for this order. */
  async function checkPromo(code: string): Promise<boolean> {
    const res = await fetch(`${bookingApiUrl}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        locale,
        promoCode: code,
        items: lines.map((x) => ({ tierId: x.tier.tierId, quantity: x.quantity })),
        services,
      }),
    }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as Quote & { error?: string }
    if (res?.ok) {
      setQuote(data)
      return true
    }
    setError(errorText(data?.error, l))
    return false
  }

  function startOrderTimer() {
    setExpiresAt(Date.now() + (avail?.holdMinutes ?? 15) * 60_000)
    setNow(Date.now())
  }

  async function goNextFromTickets(addToCart: boolean) {
    if (totalQty === 0) return setError(l.chooseTickets)
    setBusy(true)
    setError(null)
    const code = promoText.trim().toUpperCase()
    let applied = promo
    if (code && code !== promo) {
      if (!(await checkPromo(code))) {
        setBusy(false)
        return
      }
      applied = code
      setPromo(code)
    }
    if (addToCart && !applied) {
      setBusy(false)
      return setError(l.errPromo)
    }
    persistCart(applied)
    setBusy(false)
    startOrderTimer()
    setStep('buyer')
  }

  const fullPhone = buyer.phone.trim()
    ? `${buyer.dial}${buyer.phone.replace(/\D/g, '').replace(/^0+/, '')}`
    : ''
  const phoneOk = !fullPhone || /^\+[1-9]\d{6,14}$/.test(fullPhone)
  const hasPhone = Boolean(fullPhone) && phoneOk
  const smsKeys: ServiceKey[] = ['smsTickets', 'reminder']

  function submitBuyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!phoneOk) return setError(l.errPhone)
    setError(null)
    // SMS services need a phone number; drop them if the buyer removed it.
    if (!hasPhone)
      setServices((s) => ({ ...s, smsTickets: false, reminder: false }))
    setStep(avail && avail.services.length > 0 ? 'services' : 'payment')
  }

  async function buyNow(method?: PayMethod) {
    // Apple Pay only exists in Safari with a card in Wallet. Check first, so no tickets are held for nothing.
    if (
      method === 'applepay' &&
      !(typeof window !== 'undefined' && (window as unknown as { ApplePaySession?: { canMakePayments(): boolean } }).ApplePaySession?.canMakePayments())
    ) {
      setError(
        locale === 'sv'
          ? 'Apple Pay finns i Safari på iPhone, iPad och Mac med ett kort i Wallet. Välj en annan betalningsmetod.'
          : 'Apple Pay is available in Safari on iPhone, iPad and Mac with a card in Wallet. Please choose another payment method.',
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${bookingApiUrl}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          locale,
          name: buyer.name.trim(),
          email: buyer.email.trim(),
          ...(hasPhone ? { phone: fullPhone } : {}),
          country: buyer.country,
          ...(buyer.postalCode.trim() ? { postalCode: buyer.postalCode.trim() } : {}),
          ...(buyer.company && buyer.companyName.trim() ? { companyName: buyer.companyName.trim() } : {}),
          consent: { marketing: buyer.marketing, promoter: buyer.promoter },
          promoCode: promo ?? undefined,
          services,
          acceptTerms: buyer.terms,
          webOrigin: window.location.origin,
          trackingSource: readTrackingSource(),
          ...(method ? { paymentMethod: method } : {}),
          returnTo: 'account',
          items: lines.map((x) => ({ tierId: x.tier.tierId, quantity: x.quantity })),
          ...(seated ? { seats: seatSel } : {}),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        error?: string
        seats?: string[]
        seat?: string
        wallet?: { clientSecret: string; publishableKey: string }
      }
      if (res.ok && data.url && data.wallet && (method === 'googlepay' || method === 'applepay')) {
        // The wallet sheet opens on this page; paying sends the buyer to the confirmation page.
        setWallet({ method, ...data.wallet, returnUrl: checkoutDestination(data.url) })
        setBusy(false)
        return
      }
      if (res.ok && data.url) {
        window.location.assign(checkoutDestination(data.url))
        return
      }
      if (data.error === 'seat_taken' || data.error === 'seat_unavailable') {
        const gone = new Set(data.seats ?? (data.seat ? [data.seat] : []))
        setSeatSel((cur) => cur.filter((id) => !gone.has(id)))
        setStep('tickets')
        setExpiresAt(null)
        setReload((n) => n + 1)
      }
      if (data.error === 'sold_out') {
        setQty({})
        setStep('tickets')
        setExpiresAt(null)
        setReload((n) => n + 1)
      }
      setError(errorText(data.error, l))
    } catch {
      setError(l.errGeneric)
    }
    setBusy(false)
  }

  // ---------- rendering ----------
  const card = 'border border-rule bg-snow p-5 sm:p-6'
  const input =
    'min-h-12 w-full border border-rule bg-snow px-3 font-ui text-body text-ink focus-visible:border-fjord'
  const primary =
    'inline-flex min-h-12 w-full items-center justify-center bg-fjord px-6 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep disabled:opacity-40'
  const outline =
    'inline-flex min-h-12 shrink-0 items-center justify-center border border-fjord px-4 font-ui text-caption font-semibold text-fjord hover:bg-fjord hover:text-snow disabled:opacity-40'

  if (availStatus === 'error')
    return (
      <div role="alert" className="space-y-3">
        <p className="font-ui text-caption font-semibold text-alert">{l.hubAvailError}</p>
        <p className="meta break-all" data-testid="avail-error-hint">{errHint}</p>
        <button type="button" onClick={() => setReload((n) => n + 1)} className={outline}>
          {l.hubRetry}
        </button>
      </div>
    )
  if (avail && (!avail.onSale || !avail.paymentsReady))
    return (
      <p className="font-ui text-caption font-semibold text-alert">
        {avail.onSale ? l.errPayments : l.errUnavailable}
      </p>
    )

  const stepList: { id: typeof step; label: string }[] = [
    { id: 'tickets', label: l.hubStepTickets },
    { id: 'buyer', label: l.hubStepBuyer },
    ...(avail && avail.services.length > 0 ? [{ id: 'services' as const, label: l.hubStepServices }] : []),
    { id: 'payment', label: l.hubStepPayment },
  ]
  const stepIndex = stepList.findIndex((s) => s.id === step)
  const free = quote !== null && quote.total === 0
  const offeredByKey = (k: ServiceKey) => avail?.services.find((s) => s.key === k)

  const svcText: Record<ServiceKey, { title: string; text: string; no: string }> = {
    smsTickets: { title: l.hubSvcSms, text: l.hubSvcSmsText, no: l.hubNoNeed },
    refundProtection: { title: l.hubSvcRefund, text: l.hubSvcRefundText, no: l.hubNoRisk },
    reminder: { title: l.hubSvcReminder, text: l.hubSvcReminderText, no: l.hubNoNeed },
  }

  const nextButton =
    step === 'tickets' ? (
      <button type="button" disabled={busy || totalQty === 0} onClick={() => void goNextFromTickets(false)} className={primary}>
        {busy ? l.processing : l.hubNext}
      </button>
    ) : step === 'buyer' ? (
      <button type="submit" form="buyer-form" disabled={busy} className={primary}>
        {l.hubNext}
      </button>
    ) : step === 'services' ? (
      <button type="button" onClick={() => setStep('payment')} className={primary}>
        {l.hubNext}
      </button>
    ) : (
      <button type="button" disabled={busy || totalQty === 0} onClick={() => void buyNow()} className={primary}>
        {busy ? l.processing : free ? l.hubConfirmFree : l.hubBuyNow}
      </button>
    )

  return (
    <div aria-busy={busy}>
      {wallet ? (
        <WalletPay
          wallet={wallet.method}
          clientSecret={wallet.clientSecret}
          publishableKey={wallet.publishableKey}
          returnUrl={wallet.returnUrl}
          locale={locale}
          onClose={() => setWallet(null)}
          onFallback={() => {
            setWallet(null)
            void buyNow('card')
          }}
        />
      ) : null}
      {/* Stepper */}
      <ol className="mb-8 flex items-start justify-between gap-2" aria-label="Checkout steps">
        {stepList.map((s, i) => (
          <li key={s.id} className="flex flex-1 flex-col items-center gap-2 text-center" aria-current={i === stepIndex ? 'step' : undefined}>
            <span
              className={`flex size-9 items-center justify-center rounded-pill border font-ui text-caption font-semibold ${
                i === stepIndex
                  ? 'border-fjord bg-fjord text-snow'
                  : i < stepIndex
                    ? 'border-fjord text-fjord'
                    : 'border-rule text-slate'
              }`}
            >
              {i + 1}
            </span>
            <span className={`font-ui text-meta ${i === stepIndex ? 'font-semibold text-ink' : 'text-slate'}`}>{s.label}</span>
          </li>
        ))}
      </ol>

      <h1 className="font-display text-h2">{event.title}</h1>
      <p className="meta mb-6 mt-1">{dateLabel}</p>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left column: the current step */}
        <div className="space-y-4">
          {availStatus === 'loading' ? (
            <p role="status" className="meta">
              {l.hubChecking}
            </p>
          ) : null}

          {step === 'tickets' ? (
            seated && avail?.seating ? (
              <SeatMap
                seating={avail.seating}
                selected={seatSel}
                onToggle={toggleSeat}
                max={max}
                format={(minor) => money.format(minor / 100)}
                disabled={busy}
                labels={l.seatLabels}
              />
            ) : (
            <ul className="space-y-4" aria-label={l.hubStepTickets}>
              {event.tiers.map((tier) => {
                const n = qty[tier.tierId] ?? 0
                const a = avail?.tiers.find((x) => x.tierId === tier.tierId)
                const rem = remainingOf(tier.tierId)
                const closed = avail !== null && a !== undefined && !a.onSale
                const soldOut = avail !== null && rem === 0 && !closed
                const feeEach = avail && avail.serviceFeePercent > 0 ? (tier.price * avail.serviceFeePercent) / 100 : 0
                return (
                  <li key={tier.tierId} className={`${card} ${n > 0 ? 'border-fjord' : ''}`}>
                    <p className="font-ui text-caption font-bold uppercase tracking-wide">{tier.name}</p>
                    <div className="mt-3 flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        {tier.description ? <p className="font-ui text-caption text-charcoal">{tier.description}</p> : null}
                        <p className="mt-3 font-ui text-body">
                          <span className="font-semibold text-fjord">{tier.price === 0 ? l.hubFree : money.format(tier.price)}</span>
                          {feeEach > 0 ? <span className="meta"> | {l.hubFee}: {money.format(feeEach)}</span> : null}
                        </p>
                        {closed || soldOut || (avail && rem <= 20) ? (
                          <p className={`meta mt-1 ${closed || soldOut ? 'text-alert' : ''}`}>
                            {closed ? l.hubNotOnSale : soldOut ? l.soldOut : `${rem} ${l.left}`}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center" role="group" aria-label={tier.name}>
                        <button
                          type="button"
                          onClick={() => change(tier.tierId, -1)}
                          disabled={n === 0 || busy}
                          className="inline-flex size-11 items-center justify-center bg-fjord/20 text-ink disabled:opacity-30"
                        >
                          <Minus aria-hidden="true" className="size-4" />
                          <span className="sr-only">{l.removeOne}</span>
                        </button>
                        <output aria-live="polite" className="w-12 bg-fjord text-center font-ui text-body font-semibold leading-[2.75rem] text-snow">
                          {n}
                        </output>
                        <button
                          type="button"
                          onClick={() => change(tier.tierId, 1)}
                          disabled={soldOut || closed || n >= rem || totalQty >= max || busy || !avail}
                          className="inline-flex size-11 items-center justify-center bg-fjord text-snow disabled:opacity-30"
                        >
                          <Plus aria-hidden="true" className="size-4" />
                          <span className="sr-only">{l.addOne}</span>
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )) : null}

          {step === 'buyer' ? (
            <form id="buyer-form" onSubmit={submitBuyer} className={`${card} space-y-5`}>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-h3">{l.hubStepBuyer}</h2>
              </div>
              <p className="meta">{l.hubBuyerNote}</p>
              <label className="block">
                <span className="meta mb-1 block">{l.fullName}</span>
                <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={input}
                  value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="meta mb-1 block">{l.emailLabel}</span>
                <input name="email" type="email" required maxLength={200} autoComplete="email" className={input}
                  value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} />
              </label>
              <div>
                <span className="meta mb-1 block">{l.hubPhone}</span>
                <div className="grid grid-cols-[9rem_1fr] gap-2">
                  <select aria-label="Dial code" className={input} value={buyer.dial}
                    onChange={(e) => setBuyer({ ...buyer, dial: e.target.value })}>
                    {COUNTRIES.map(([code, dial]) => (
                      <option key={code} value={dial}>{code} ({dial})</option>
                    ))}
                  </select>
                  <input name="phone" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16} className={input}
                    value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="meta mb-1 block">{l.hubCountry}</span>
                  <select name="country" autoComplete="country" className={input} value={buyer.country}
                    onChange={(e) => setBuyer({ ...buyer, country: e.target.value })}>
                    {COUNTRIES.map(([code]) => (
                      <option key={code} value={code}>{countryName(code, intlLocale)}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="meta mb-1 block">{l.hubPostal}</span>
                  <input name="postal" maxLength={12} autoComplete="postal-code" className={input}
                    value={buyer.postalCode} onChange={(e) => setBuyer({ ...buyer, postalCode: e.target.value })} />
                </label>
              </div>
              <label className="flex items-center gap-3 font-ui text-caption">
                <input type="checkbox" className="size-5 accent-[var(--color-fjord)]" checked={buyer.company}
                  onChange={(e) => setBuyer({ ...buyer, company: e.target.checked })} />
                {l.hubCompany}
              </label>
              {buyer.company ? (
                <label className="block">
                  <span className="meta mb-1 block">{l.hubCompanyName}</span>
                  <input name="companyName" maxLength={80} autoComplete="organization" className={input}
                    value={buyer.companyName} onChange={(e) => setBuyer({ ...buyer, companyName: e.target.value })} />
                </label>
              ) : null}
              <div className="space-y-3 border-t border-rule pt-4">
                <label className="flex items-start gap-3 font-ui text-caption">
                  <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-fjord)]" checked={buyer.marketing}
                    onChange={(e) => setBuyer({ ...buyer, marketing: e.target.checked })} />
                  <span>{l.hubConsentMarketing}</span>
                </label>
                <label className="flex items-start gap-3 font-ui text-caption">
                  <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-fjord)]" checked={buyer.promoter}
                    onChange={(e) => setBuyer({ ...buyer, promoter: e.target.checked })} />
                  <span>{l.hubConsentPromoter}</span>
                </label>
                <label className="flex items-start gap-3 font-ui text-caption">
                  <input name="terms" type="checkbox" required className="mt-1 size-5 shrink-0 accent-[var(--color-fjord)]" checked={buyer.terms}
                    onChange={(e) => setBuyer({ ...buyer, terms: e.target.checked })} />
                  <span>
                    {l.acceptTerms}{' '}
                    <a href={termsHref} target="_blank" className="text-fjord underline">{l.terms}</a> ·{' '}
                    <a href={privacyHref} target="_blank" className="text-fjord underline">{l.privacyPolicy}</a>
                  </span>
                </label>
              </div>
            </form>
          ) : null}

          {step === 'services' ? (
            <section className={`${card} space-y-5`} aria-label={l.hubServicesTitle}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-h3">{l.hubServicesTitle}</h2>
                <button
                  type="button"
                  className="font-ui text-meta font-semibold text-fjord hover:underline"
                  onClick={() =>
                    setServices({
                      smsTickets: hasPhone && Boolean(offeredByKey('smsTickets')),
                      refundProtection: Boolean(offeredByKey('refundProtection')),
                      reminder: hasPhone && Boolean(offeredByKey('reminder')),
                    })
                  }
                >
                  {l.hubAddAll}
                </button>
              </div>
              {(avail?.services ?? []).map((svc) => {
                const needsPhone = smsKeys.includes(svc.key)
                const blocked = needsPhone && !hasPhone
                const txt = svcText[svc.key]
                const on = services[svc.key]
                return (
                  <fieldset key={svc.key} className="space-y-3 border border-rule p-4">
                    <legend className="sr-only">{txt.title}</legend>
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="font-ui text-body font-semibold">{txt.title}</p>
                      <p className="font-ui text-body font-semibold">{fmt(svc.price)}</p>
                    </div>
                    <p className="font-ui text-caption text-charcoal">{txt.text}</p>
                    {blocked ? <p className="meta text-alert">{l.hubSvcPhoneNeeded}</p> : null}
                    <div className="grid grid-cols-2 gap-2 font-ui text-caption">
                      <label className={`flex items-center gap-2 border p-3 ${on ? 'border-fjord bg-fjord/15' : 'border-rule'} ${blocked ? 'opacity-40' : ''}`}>
                        <input type="radio" name={`svc-${svc.key}`} checked={on} disabled={blocked}
                          onChange={() => setServices((s) => ({ ...s, [svc.key]: true }))} />
                        {l.hubYes}
                      </label>
                      <label className={`flex items-center gap-2 border p-3 ${!on ? 'border-fjord bg-fjord/15' : 'border-rule'}`}>
                        <input type="radio" name={`svc-${svc.key}`} checked={!on}
                          onChange={() => setServices((s) => ({ ...s, [svc.key]: false }))} />
                        {txt.no}
                      </label>
                    </div>
                  </fieldset>
                )
              })}
            </section>
          ) : null}

          {step === 'payment' ? (
            <section className={`${card} space-y-4`} aria-label={l.hubPaymentTitle}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-h3">{l.hubPaymentTitle}</h2>
                <span className="meta">{l.hubSafe}</span>
              </div>
              {free ? (
                <p className="font-ui text-caption text-charcoal">{l.hubConfirmFree}</p>
              ) : (
                <label className="flex items-start gap-3 border border-fjord p-4 font-ui text-caption">
                  <input type="radio" checked readOnly className="mt-1" />
                  <span>
                    <span className="block text-body font-semibold">{l.hubPayCard}</span>
                    <span className="meta">{l.hubPayCardText}</span>
                  </span>
                </label>
              )}
              {!free ? <PaymentMethods swish={swish} title={l.hubPayMethods} note={l.hubPayMethodsNote} disabled={busy || totalQty === 0} onPick={(m) => void buyNow(m)} /> : null}
              {!free && avail?.demoPayments ? (
                <p className="font-ui text-caption text-brass-text">{l.payDemoNote}</p>
              ) : null}
            </section>
          ) : null}

          {step !== 'tickets' ? (
            <button
              type="button"
              className="font-ui text-meta font-semibold text-fjord hover:underline"
              onClick={() =>
                setStep(step === 'payment' ? (avail && avail.services.length > 0 ? 'services' : 'buyer') : step === 'services' ? 'buyer' : 'tickets')
              }
            >
              ← {l.hubBackStep}
            </button>
          ) : null}
        </div>

        {/* Right column: order summary */}
        <aside className="space-y-4" aria-label={l.hubOrderSummary}>
          {step !== 'tickets' && expiresAt ? (
            <p className="flex items-center justify-center gap-2 bg-fjord-deep px-4 py-3 font-ui text-caption text-snow" role="timer">
              {l.hubOrderExpires} <span className="font-semibold tabular-nums">{clock}</span>
            </p>
          ) : null}
          <div className={card}>
            <h2 className="font-display text-h3">{l.hubOrderSummary}</h2>

            {step === 'tickets' && avail?.promoCodes ? (
              <div className="mt-4">
                <p className="font-ui text-caption font-semibold text-fjord">{l.hubPromoPrompt}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    id="promo-code"
                    aria-label={l.promoCode}
                    value={promoText}
                    onChange={(e) => {
                      setPromoText(e.target.value)
                      if (promo && e.target.value.trim().toUpperCase() !== promo) setPromo(null)
                    }}
                    maxLength={40}
                    autoComplete="off"
                    className={`${input} uppercase`}
                  />
                  <button
                    type="button"
                    disabled={busy || !promoText.trim() || totalQty === 0}
                    hidden={seated}
                    onClick={() => void goNextFromTickets(true)}
                    className={outline}
                  >
                    {l.hubAddToCart}
                  </button>
                </div>
                {promo ? (
                  <p role="status" className="meta mt-2 text-fjord">
                    {l.hubDiscount}: {promo}
                  </p>
                ) : null}
              </div>
            ) : null}

            <dl className="mt-4 space-y-3 border-t border-rule pt-4 font-ui text-caption">
              {lines.map((x) => (
                <div key={x.tier.tierId} className="flex justify-between gap-4">
                  <dt>
                    {x.quantity} × {event.title} - {x.tier.name}
                  </dt>
                  <dd className="shrink-0 font-semibold">{money.format(x.tier.price * x.quantity)}</dd>
                </div>
              ))}
              {quote && quote.fees > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt>{l.hubTicketFee}</dt>
                  <dd className="shrink-0 font-semibold">{fmt(quote.fees)}</dd>
                </div>
              ) : null}
              {quote && quote.discount > 0 ? (
                <div className="flex justify-between gap-4 text-fjord">
                  <dt>
                    {l.hubDiscount}
                    {quote.promoCode ? ` (${quote.promoCode})` : ''}
                  </dt>
                  <dd className="shrink-0 font-semibold">−{fmt(quote.discount)}</dd>
                </div>
              ) : null}
              {quote?.services.map((s) => (
                <div key={s.key} className="flex justify-between gap-4">
                  <dt>{svcText[s.key].title}</dt>
                  <dd className="shrink-0 font-semibold">{fmt(s.price)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-rule pt-4">
              <span className="font-ui text-body font-semibold">{l.hubOrderAmount}</span>
              <span data-testid="order-amount" className="font-display text-h3">
                {fmt(quote?.total ?? 0)}
              </span>
            </div>
            {totalQty > 0 && step === 'tickets' ? <p className="meta mt-3">{l.hubCartNote}</p> : null}
          </div>

          {error ? (
            <p role="alert" className="border-l-2 border-alert bg-snow p-3 font-ui text-caption text-alert">
              {error}
            </p>
          ) : null}
          {notice ? <p role="status" className="meta">{notice}</p> : null}
          {nextButton}
          <a href={cartHref} className="block text-center font-ui text-meta font-semibold text-fjord hover:underline">
            {l.hubViewCart}
          </a>
          <a href={eventHref} className="block text-center font-ui text-meta text-slate hover:underline">
            {l.hubBack}
          </a>
        </aside>
      </div>
    </div>
  )
}
