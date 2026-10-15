import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { bookingApiUrl } from '@/lib/booking'
import { formatMinor, type PublicOrder } from '@/lib/bookingTypes'
import { formatEventDate, intlLocales } from '@/lib/format'
import { textParam } from '@/lib/listings'
import { href } from '@/lib/site'
import { DemoPayment } from '@/components/account/DemoPayment'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = {
  params: Promise<{ locale: string; ref: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function loadOrder(ref: string, token: string): Promise<PublicOrder | null> {
  if (!bookingApiUrl || !ref || !token) return null
  const res = await fetch(`${bookingApiUrl}/orders/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`, {
    cache: 'no-store',
    headers: process.env.INTERNAL_API_KEY ? { 'x-internal-key': process.env.INTERNAL_API_KEY } : {},
  }).catch(() => null)
  return res?.ok ? ((await res.json()) as PublicOrder) : null
}

/** Dummy payment page (PAYMENT_MODE=demo). Stripe's own page replaces it once keys are added. */
export default async function PayPage({ params, searchParams }: Props) {
  const { locale, ref } = await params
  if (!isLocale(locale) || !bookingApiUrl) notFound()
  const token = textParam((await searchParams).t, 64)
  const order = await loadOrder(ref, token)
  if (!order) notFound()
  const t = getDictionary(locale)
  const confirmation = `/${locale}/booking/confirmation?order=${encodeURIComponent(order.ref)}&t=${encodeURIComponent(token)}`
  if (order.status === 'paid' || order.status === 'partially_refunded') redirect(confirmation)

  const eventHref = href(locale, `/events/${order.event.slug}`)
  const money = (n: number) => formatMinor(n, order.currency, intlLocales[locale])
  const date = formatEventDate(order.event.startsAt, locale)
  const closed = order.status !== 'pending'

  return (
    <div className="container-max pb-20 pt-8">
      <Link href={eventHref} className="font-ui text-meta font-semibold text-fjord hover:underline">
        {t.payBackToEvent}
      </Link>
      <h1 className="mt-4 text-h1">{t.payPageTitle}</h1>
      {closed ? (
        <div className="mt-8 space-y-4">
          <p role="alert" className="font-ui text-caption font-semibold text-alert">
            {order.status === 'cancelled' ? t.payCancelled : t.payExpired}
          </p>
          <Link href={eventHref} className="inline-flex min-h-11 items-center bg-ink px-5 font-ui text-caption font-semibold text-snow">
            {order.event.title}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <DemoPayment
              apiUrl={bookingApiUrl}
              orderRef={order.ref}
              token={token}
              amount={money(order.total)}
              confirmationHref={confirmation}
              eventHref={eventHref}
              labels={{
                badge: t.payDemoBadge,
                note: t.payDemoNote,
                title: t.hubPaymentTitle,
                card: t.payMethodCard,
                wallet: t.payMethodWallet,
                bank: t.payMethodBank,
                cardNumber: t.payCardNumber,
                expiry: t.payCardExpiry,
                cvc: t.payCardCvc,
                pay: t.payNow,
                cancel: t.payCancel,
                processing: t.payProcessing,
                cancelled: t.payCancelled,
                failed: t.payFailed,
                soldOut: t.paySoldOut,
                back: t.payBackToEvent,
              }}
            />
          </div>
          <aside className="lg:col-span-5" aria-label={t.payOrderSummary}>
            <div className="border border-rule bg-snow p-5">
              <h2 className="font-display text-h3">{t.payOrderSummary}</h2>
              <p className="meta mt-2">
                {order.event.title} · {date.full}
              </p>
              <p className="meta">
                {t.orderRef}: {order.ref}
              </p>
              <dl className="mt-4 space-y-2 border-t border-rule pt-4 font-ui text-caption">
                {order.items.map((it) => (
                  <div key={it.tierId} className="flex justify-between gap-4">
                    <dt>
                      {it.quantity} × {it.name}
                    </dt>
                    <dd>{money(it.unitPrice * it.quantity)}</dd>
                  </div>
                ))}
                {order.discount ? (
                  <div className="flex justify-between gap-4">
                    <dt>{t.discount}</dt>
                    <dd>−{money(order.discount)}</dd>
                  </div>
                ) : null}
                {order.fees ? (
                  <div className="flex justify-between gap-4">
                    <dt>{t.fees}</dt>
                    <dd>{money(order.fees)}</dd>
                  </div>
                ) : null}
                {order.servicesTotal ? (
                  <div className="flex justify-between gap-4">
                    <dt>{t.hubServicesTitle}</dt>
                    <dd>{money(order.servicesTotal)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-rule pt-2 font-semibold">
                  <dt>{t.total}</dt>
                  <dd data-testid="pay-total">{money(order.total)}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
