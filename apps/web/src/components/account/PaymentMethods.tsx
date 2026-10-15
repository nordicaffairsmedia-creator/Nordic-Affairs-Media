'use client'

import type { ReactElement } from 'react'
import { Applepay, Googlepay, Klarna, Mastercard, Swish, Visa } from 'react-pay-icons'

/**
 * "Accepted payment methods" buttons on the payment step. Clicking one sends the buyer straight to
 * Stripe's secure payment page (the same as Buy now), narrowed to that method when Stripe offers it.
 *
 *   method 'card'   -> Apple Pay, Google Pay, Visa, Mastercard (Stripe shows the wallet when the device supports it)
 *   method 'klarna' -> Klarna
 *   method 'swish'  -> Swish
 *
 * The icons come from the MIT-licensed `react-pay-icons` package; the marks themselves belong to
 * Swish, Apple, Google, Visa, Mastercard and Klarna.
 */
export type PayMethod = 'card' | 'klarna' | 'swish'

const METHODS: { key: string; name: string; method: PayMethod; icon: ReactElement }[] = [
  { key: 'swish', name: 'Swish', method: 'swish', icon: <Swish /> },
  { key: 'apple-pay', name: 'Apple Pay', method: 'card', icon: <Applepay /> },
  { key: 'google-pay', name: 'Google Pay', method: 'card', icon: <Googlepay /> },
  { key: 'visa', name: 'Visa', method: 'card', icon: <Visa /> },
  { key: 'mastercard', name: 'Mastercard', method: 'card', icon: <Mastercard /> },
  { key: 'klarna', name: 'Klarna', method: 'klarna', icon: <Klarna /> },
]

export function PaymentMethods({
  title,
  note,
  disabled,
  onPick,
}: {
  title: string
  note: string
  disabled?: boolean
  onPick: (method: PayMethod) => void
}) {
  return (
    <div data-testid="payment-methods" className="space-y-3 border-t border-rule pt-4">
      <p className="font-ui text-caption font-semibold text-ink">{title}</p>
      <ul className="flex flex-wrap gap-3" aria-label={title}>
        {METHODS.map((m) => (
          <li key={m.key}>
            <button
              type="button"
              data-testid={`paymethod-${m.key}`}
              aria-label={m.name}
              title={m.name}
              disabled={disabled}
              onClick={() => onPick(m.method)}
              className="block h-11 w-[68px] overflow-hidden rounded-md bg-white transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fjord disabled:cursor-wait disabled:opacity-60 [&_svg]:size-full"
            >
              {m.icon}
            </button>
          </li>
        ))}
      </ul>
      <p className="meta">{note}</p>
    </div>
  )
}
