'use client'

import { useState } from 'react'

/**
 * "Accepted payment methods" strip shown on the payment step, before the buyer is sent to Stripe.
 *
 * Each badge uses the brand's own logo file from /public/payment-logos/<file>. Those logo files are
 * the property of Swish, Apple, Google, Visa, Mastercard and Klarna, so they are NOT bundled here:
 * download each one from the brand's official asset page and drop it into that folder
 * (see docs/PAYMENT_LOGOS.md). Until a file exists the badge shows the plain name instead, so the
 * page never has a broken image.
 */
export const PAYMENT_METHODS = [
  { key: 'swish', name: 'Swish', file: 'swish.svg' },
  { key: 'apple-pay', name: 'Apple Pay', file: 'apple-pay.svg' },
  { key: 'google-pay', name: 'Google Pay', file: 'google-pay.svg' },
  { key: 'visa', name: 'Visa', file: 'visa.svg' },
  { key: 'mastercard', name: 'Mastercard', file: 'mastercard.svg' },
  { key: 'klarna', name: 'Klarna', file: 'klarna.svg' },
] as const

function Badge({ name, file }: { name: string; file: string }) {
  const [missing, setMissing] = useState(false)
  return (
    <li
      data-testid={`paymethod-${file.replace('.svg', '')}`}
      className="flex h-10 min-w-16 items-center justify-center rounded-sm border border-rule bg-white px-3"
    >
      {missing ? (
        <span className="font-ui text-meta font-semibold text-black">{name}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/payment-logos/${file}`}
          alt={name}
          height={24}
          className="h-6 w-auto max-w-24 object-contain"
          onError={() => setMissing(true)}
        />
      )}
    </li>
  )
}

export function PaymentMethods({ title, note }: { title: string; note: string }) {
  return (
    <div data-testid="payment-methods" className="space-y-3 border-t border-rule pt-4">
      <p className="font-ui text-caption font-semibold text-ink">{title}</p>
      <ul className="flex flex-wrap gap-2" aria-label={title}>
        {PAYMENT_METHODS.map((m) => (
          <Badge key={m.key} name={m.name} file={m.file} />
        ))}
      </ul>
      <p className="meta">{note}</p>
    </div>
  )
}
