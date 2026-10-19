import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ApiWarmup } from '@/components/account/ApiWarmup'
import { MyBookings } from '@/components/account/MyBookings'
import { MyTickets } from '@/components/account/MyTickets'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { bookingApiUrl } from '@/lib/booking'
import { intlLocales } from '@/lib/format'
import { buildMetadata } from '@/lib/seo'
import { PageHeader } from '@/components/ui/primitives'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return buildMetadata({ locale, path: '/account', title: getDictionary(locale).myBookings })
}

/**
 * "My bookings": only the tickets this visitor bought — the ones kept on this device, and
 * (after an email code) the ones bought with their email address. Nothing about concerts
 * and events to browse; that stays under Concerts & Events.
 */
export default async function AccountPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale) || !bookingApiUrl) notFound()
  const t = getDictionary(locale)
  return (
    <div className="container-wide pb-20">
      <ApiWarmup />
      <PageHeader title={t.myBookings} />
      <div className="mt-8 grid gap-16">
        <MyTickets
          intlLocale={intlLocales[locale]}
          labels={{
            title: t.hubMyTicketsTitle,
            intro: t.hubMyTicketsIntro,
            loading: t.hubMyTicketsLoading,
            empty: t.hubMyTicketsEmpty,
            error: t.hubMyTicketsError,
            retry: t.hubMyTicketsRetry,
            orderRef: t.orderRef,
            total: t.total,
            pdf: t.downloadTickets,
            imageAlt: t.hubTicketImage,
            ticketWord: t.hubMyTicketsWord,
            pngLabel: t.hubTicketDownloadPng,
            openLabel: t.hubTicketOpen,
            remove: t.hubMyTicketsRemove,
            demo: t.hubMyTicketsDemo,
          }}
        />
        <section aria-label={t.hubMyTicketsOther}>
          <h2 className="text-h3">{t.hubMyTicketsOther}</h2>
          <div className="mt-4">
            <MyBookings
              locale={locale}
              intlLocale={intlLocales[locale]}
              labels={{
                myBookingsIntro: t.myBookingsIntro,
                emailLabel: t.emailLabel,
                sendCode: t.sendCode,
                codeSent: t.codeSent,
                enterCode: t.enterCode,
                verify: t.verify,
                invalidCode: t.invalidCode,
                signOut: t.signOut,
                noBookings: t.noBookings,
                downloadTickets: t.downloadTickets,
                downloadReceipt: t.downloadReceipt,
                resendTickets: t.resendTickets,
                sent: t.sent,
                requestCancellation: t.requestCancellation,
                cancellationRequested: t.cancellationRequested,
                statusPaid: t.statusPaid,
                statusRefunded: t.statusRefunded,
                statusPartiallyRefunded: t.statusPartiallyRefunded,
                orderRef: t.orderRef,
                ticketsCount: t.ticketsCount,
                total: t.total,
                processing: t.processing,
                errGeneric: t.errGeneric,
              }}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
