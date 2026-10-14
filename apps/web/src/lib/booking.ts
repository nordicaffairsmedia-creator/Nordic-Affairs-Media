import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * Address of the booking API. It is public (browsers call it directly for the
 * ticket picker and My Bookings), so it lives in a NEXT_PUBLIC_ variable that Render
 * bakes in at build time. Empty = booking switched off on the website.
 */
export const bookingApiUrl = (process.env.NEXT_PUBLIC_BOOKING_API_URL ?? '').replace(/\/$/, '')

/** The subset of interface text the booking widgets need (keeps the browser bundle small). */
export function bookingLabels(t: Dictionary) {
  return {
    buyTickets: t.buyTickets,
    addOne: t.addOne,
    removeOne: t.removeOne,
    left: t.left,
    soldOut: t.soldOut,
    yourDetails: t.yourDetails,
    fullName: t.fullName,
    emailLabel: t.emailLabel,
    promoCode: t.promoCode,
    acceptTerms: t.acceptTerms,
    terms: t.terms,
    privacyPolicy: t.privacyPolicy,
    ticketsTotal: t.ticketsTotal,
    feesNote: t.feesNote,
    continueToPayment: t.continueToPayment,
    processing: t.processing,
    holdNote: t.holdNote,
    chooseTickets: t.chooseTickets,
    checkoutCancelled: t.checkoutCancelled,
    errSoldOut: t.errSoldOut,
    errPromo: t.errPromo,
    errTooMany: t.errTooMany,
    errUnavailable: t.errUnavailable,
    errPayments: t.errPayments,
    errGeneric: t.errGeneric,
    incVat: t.incVat,
    bookingSoon: t.bookingSoon,
    hubPayNote: t.hubPayNote,
    hubChecking: t.hubChecking,
    hubAvailError: t.hubAvailError,
    hubRetry: t.hubRetry,
    hubNotOnSale: t.hubNotOnSale,
    hubApply: t.hubApply,
    hubRemove: t.hubRemove,
    hubDiscount: t.hubDiscount,
    errPhone: t.errPhone,
  }
}
export type BookingLabels = ReturnType<typeof bookingLabels>

/** Maps the API's error codes to text the buyer understands. */
export function errorText(code: string | undefined, l: BookingLabels): string {
  switch (code) {
    case 'sold_out':
      return l.errSoldOut
    case 'invalid_promo':
      return l.errPromo
    case 'phone_required':
      return l.errPhone
    case 'too_many':
      return l.errTooMany
    case 'not_on_sale':
    case 'sales_closed':
    case 'tier_unavailable':
      return l.errUnavailable
    case 'payments_unavailable':
    case 'payment_provider_error':
      return l.errPayments
    default:
      return l.errGeneric
  }
}

/**
 * Where to send the browser after "checkout". Stripe's page is used as given. Anything else is one
 * of our own pages (payment, confirmation): always opened on the address the buyer is already on,
 * so a wrong website address configured on the API can never send them to another site.
 */
export function checkoutDestination(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('stripe.com')) return url
    return `${window.location.origin}${u.pathname}${u.search}`
  } catch {
    return url
  }
}
