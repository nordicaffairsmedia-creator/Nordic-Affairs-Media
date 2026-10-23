'use client'

import { useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, ExpressCheckoutElement, useElements, useStripe } from '@stripe/react-stripe-js'

/**
 * Google Pay / Apple Pay on our own page: Stripe's Express Checkout button opens the wallet sheet
 * (with the amount), the buyer confirms there, and Stripe takes the payment. Afterwards the buyer goes to
 * the confirmation page, which asks the booking server to check the payment and issue the tickets.
 */
export type Wallet = 'googlepay' | 'applepay'

const TEXT = {
  en: {
    googlepay: 'Google Pay',
    applepay: 'Apple Pay',
    loading: 'Opening the secure payment…',
    paying: 'Processing your payment…',
    unavailable:
      'This wallet is not available on this device or browser. You can continue on the secure Stripe page instead.',
    close: 'Close',
    fallback: 'Continue on the secure payment page',
    failed: 'The payment did not go through. Please try again or choose another payment method.',
  },
  sv: {
    googlepay: 'Google Pay',
    applepay: 'Apple Pay',
    loading: 'Öppnar den säkra betalningen…',
    paying: 'Din betalning behandlas…',
    unavailable:
      'Den här plånboken finns inte på den här enheten eller webbläsaren. Du kan fortsätta på den säkra betalsidan i stället.',
    close: 'Stäng',
    fallback: 'Fortsätt på den säkra betalsidan',
    failed: 'Betalningen gick inte igenom. Försök igen eller välj en annan betalningsmetod.',
  },
} as const

type Props = {
  wallet: Wallet
  clientSecret: string
  publishableKey: string
  returnUrl: string
  locale: string
  onClose: () => void
  onFallback?: () => void
}

function Sheet({ wallet, clientSecret, returnUrl, locale, onClose, onFallback }: Omit<Props, 'publishableKey'>) {
  const t = locale === 'sv' ? TEXT.sv : TEXT.en
  const stripe = useStripe()
  const elements = useElements()
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'paying'>('loading')
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    if (!stripe || !elements) return
    setError(null)
    setState('paying')
    const { error: payError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })
    if (payError) {
      setError(payError.message ?? t.failed)
      setState('ready')
      return
    }
    // Paid. The confirmation page checks the payment with the booking server and shows the tickets.
    window.location.assign(returnUrl)
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-h3">{wallet === 'googlepay' ? t.googlepay : t.applepay}</h2>
      {state === 'loading' ? <p className="meta">{t.loading}</p> : null}
      {state === 'paying' ? <p className="meta">{t.paying}</p> : null}
      {state === 'unavailable' ? <p role="alert" className="font-ui text-caption text-alert">{t.unavailable}</p> : null}
      {state === 'unavailable' && onFallback ? <button type="button" className="btn btn-primary" onClick={onFallback}>{t.fallback}</button> : null}
      {error ? <p role="alert" className="font-ui text-caption text-alert">{error}</p> : null}
      <div className={state === 'unavailable' ? 'hidden' : state === 'paying' ? 'pointer-events-none opacity-60' : ''}>
        <ExpressCheckoutElement
          onConfirm={() => void onConfirm()}
          onReady={(e) => {
            const m = e.availablePaymentMethods
            const ok = wallet === 'googlepay' ? Boolean(m?.googlePay) : Boolean(m?.applePay)
            setState(ok ? 'ready' : 'unavailable')
          }}
          options={{
            buttonHeight: 48,
            paymentMethods: {
              googlePay: wallet === 'googlepay' ? 'auto' : 'never',
              applePay: wallet === 'applepay' ? 'auto' : 'never',
              link: 'never',
              amazonPay: 'never',
              paypal: 'never',
              klarna: 'never',
            },
          }}
        />
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={state === 'paying'}
        className="inline-flex min-h-11 items-center border border-ink px-5 font-ui text-caption font-semibold text-ink hover:bg-ink hover:text-snow disabled:opacity-60"
      >
        {t.close}
      </button>
    </div>
  )
}

export function WalletPay(props: Props) {
  const stripePromise = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey])
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-snow p-6 text-ink shadow-2xl">
        <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance: { theme: 'stripe' } }}>
          <Sheet {...props} />
        </Elements>
      </div>
    </div>
  )
}
