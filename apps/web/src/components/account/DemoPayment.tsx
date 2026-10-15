'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Labels = {
  badge: string
  note: string
  title: string
  card: string
  wallet: string
  bank: string
  cardNumber: string
  expiry: string
  cvc: string
  pay: string
  cancel: string
  processing: string
  cancelled: string
  failed: string
  soldOut: string
  back: string
}
type Method = 'card' | 'wallet' | 'bank'

/**
 * Dummy payment form. The card fields are fixed, read-only test values: nothing a person types
 * is ever collected here, and "Pay" only tells our own booking API to mark the order paid.
 */
export function DemoPayment(props: {
  apiUrl: string
  orderRef: string
  token: string
  amount: string
  confirmationHref: string
  eventHref: string
  labels: Labels
}) {
  const { labels: l } = props
  const router = useRouter()
  const [method, setMethod] = useState<Method>('card')
  const [state, setState] = useState<'idle' | 'paying' | 'cancelled' | 'error' | 'soldout'>('idle')

  async function call(path: 'pay' | 'cancel') {
    const res = await fetch(`${props.apiUrl}/demo/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ref: props.orderRef, t: props.token, method }),
    })
    return res
  }

  async function pay() {
    setState('paying')
    try {
      const res = await call('pay')
      if (res.ok) return router.push(props.confirmationHref)
      setState(res.status === 409 ? 'soldout' : 'error')
    } catch {
      setState('error')
    }
  }

  async function cancel() {
    setState('paying')
    try {
      const res = await call('cancel')
      setState(res.ok ? 'cancelled' : 'error')
    } catch {
      setState('error')
    }
  }

  const input = 'min-h-12 w-full border border-rule bg-paper px-3 font-ui text-body text-charcoal'
  const methods: [Method, string][] = [
    ['card', l.card],
    ['wallet', l.wallet],
    ['bank', l.bank],
  ]

  if (state === 'cancelled')
    return (
      <div className="space-y-4">
        <p role="status" className="font-ui text-caption font-semibold text-charcoal">
          {l.cancelled}
        </p>
        <a href={props.eventHref} className="inline-flex min-h-11 items-center bg-ink px-5 font-ui text-caption font-semibold text-snow">
          {l.back}
        </a>
      </div>
    )

  return (
    <div className="space-y-5 border border-rule bg-snow p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-h3">{l.title}</h2>
        <span className="bg-brass-text px-2 py-1 font-ui text-meta font-semibold text-snow">{l.badge}</span>
      </div>
      <p className="font-ui text-caption text-charcoal">{l.note}</p>

      <div role="radiogroup" aria-label={l.title} className="grid gap-2 sm:grid-cols-3">
        {methods.map(([id, label]) => (
          <label
            key={id}
            className={`flex cursor-pointer items-center gap-2 border p-3 font-ui text-caption font-semibold ${method === id ? 'border-fjord bg-fjord/15' : 'border-rule'}`}
          >
            <input type="radio" name="method" checked={method === id} onChange={() => setMethod(id)} />
            {label}
          </label>
        ))}
      </div>

      {method === 'card' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="meta">{l.cardNumber}</span>
            <input readOnly value="4242 4242 4242 4242" className={`${input} mt-1`} />
          </label>
          <label>
            <span className="meta">{l.expiry}</span>
            <input readOnly value="12 / 34" className={`${input} mt-1`} />
          </label>
          <label>
            <span className="meta">{l.cvc}</span>
            <input readOnly value="123" className={`${input} mt-1`} />
          </label>
        </div>
      ) : null}

      <button
        type="button"
        data-testid="pay-now"
        disabled={state === 'paying'}
        onClick={() => void pay()}
        className="inline-flex min-h-12 w-full items-center justify-center bg-fjord px-6 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep disabled:opacity-40"
      >
        {state === 'paying' ? l.processing : `${l.pay} ${props.amount}`}
      </button>
      <button
        type="button"
        data-testid="pay-cancel"
        disabled={state === 'paying'}
        onClick={() => void cancel()}
        className="font-ui text-meta font-semibold text-fjord hover:underline disabled:opacity-40"
      >
        {l.cancel}
      </button>
      {state === 'error' ? (
        <p role="alert" className="font-ui text-caption font-semibold text-alert">
          {l.failed}
        </p>
      ) : null}
      {state === 'soldout' ? (
        <p role="alert" className="font-ui text-caption font-semibold text-alert">
          {l.soldOut}
        </p>
      ) : null}
    </div>
  )
}
