'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { bookingApiUrl } from '@/lib/booking'
import { clearCart, readCart, type Cart } from '@/lib/cart'
import type { CheckoutLabels } from '@/lib/checkoutLabels'

type Quote = { subtotal: number; discount: number; fees: number; total: number; promoCode: string | null }

/** The Cart tab: tickets chosen but not paid yet, kept in this browser. */
export function CartView({
  labels: l,
  intlLocale,
  checkoutBase,
  browseHref,
}: {
  labels: CheckoutLabels
  intlLocale: string
  checkoutBase: string
  browseHref: string
}) {
  const [cart, setCart] = useState<Cart | null | undefined>(undefined)
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    const read = () => setCart(readCart())
    read()
    window.addEventListener('nam-cart', read)
    return () => window.removeEventListener('nam-cart', read)
  }, [])

  useEffect(() => {
    if (!cart) return setQuote(null)
    const ctrl = new AbortController()
    fetch(`${bookingApiUrl}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        eventId: cart.eventId,
        locale: cart.locale,
        promoCode: cart.promoCode,
        items: cart.lines.map((x) => ({ tierId: x.tierId, quantity: x.quantity })),
      }),
    })
      .then(async (r) => (r.ok ? ((await r.json()) as Quote) : null))
      .then(setQuote)
      .catch(() => undefined)
    return () => ctrl.abort()
  }, [cart])

  if (cart === undefined) return <p className="meta">{l.hubChecking}</p>
  if (!cart)
    return (
      <div className="max-w-md space-y-4">
        <p className="text-charcoal">{l.hubCartEmpty}</p>
        <Link href={browseHref} className="inline-flex min-h-11 items-center bg-fjord px-5 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep">
          {l.hubCartBrowse}
        </Link>
      </div>
    )

  const money = new Intl.NumberFormat(intlLocale, { style: 'currency', currency: cart.currency, minimumFractionDigits: 2 })
  const fmt = (minor: number) => money.format(minor / 100)
  return (
    <section aria-label={l.hubCart} className="max-w-2xl border border-rule bg-snow p-5 sm:p-6">
      <h2 className="font-display text-h3">{cart.eventTitle}</h2>
      <dl className="mt-4 space-y-3 border-t border-rule pt-4 font-ui text-caption">
        {cart.lines.map((x) => (
          <div key={x.tierId} className="flex justify-between gap-4">
            <dt>{x.quantity} × {x.name}</dt>
            <dd className="font-semibold">{fmt(x.unitPrice * x.quantity)}</dd>
          </div>
        ))}
        {quote && quote.fees > 0 ? (
          <div className="flex justify-between gap-4">
            <dt>{l.hubTicketFee}</dt>
            <dd className="font-semibold">{fmt(quote.fees)}</dd>
          </div>
        ) : null}
        {quote && quote.discount > 0 ? (
          <div className="flex justify-between gap-4 text-fjord">
            <dt>{l.hubDiscount}{quote.promoCode ? ` (${quote.promoCode})` : ''}</dt>
            <dd className="font-semibold">−{fmt(quote.discount)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-rule pt-4">
        <span className="font-ui text-body font-semibold">{l.hubOrderAmount}</span>
        <span data-testid="cart-amount" className="font-display text-h3">{fmt(quote?.total ?? cart.lines.reduce((s, x) => s + x.unitPrice * x.quantity, 0))}</span>
      </div>
      <p className="meta mt-3">{l.hubCartNote}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link href={`${checkoutBase}/${encodeURIComponent(cart.eventSlug)}/tickets`} className="inline-flex min-h-12 items-center bg-fjord px-6 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep">
          {l.hubCartCheckout}
        </Link>
        <button type="button" onClick={() => clearCart()} className="font-ui text-meta font-semibold text-alert hover:underline">
          {l.hubCartRemove}
        </button>
      </div>
    </section>
  )
}
