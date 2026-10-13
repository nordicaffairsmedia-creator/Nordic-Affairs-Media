import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { bookingApiUrl } from '@/lib/booking'
import { intlLocales } from '@/lib/format'
import { PageHeader } from '@/components/ui/primitives'
import { MyBookings } from '@/components/account/MyBookings'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return { title: getDictionary(locale).myBookings, robots: { index: false, follow: false } }
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale) || !bookingApiUrl) notFound()
  const t = getDictionary(locale)
  return (
    <div className="container-wide pb-20">
      <PageHeader title={t.myBookings} />
      <div className="mt-10">
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
    </div>
  )
}
