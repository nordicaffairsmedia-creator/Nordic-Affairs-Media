# Accepted payment methods on checkout

The payment step shows "Accepted payment methods" (Swish, Apple Pay, Google Pay, Visa, Mastercard, Klarna)
before the buyer is sent to Stripe.

## 1. Add the logo files
The logos belong to each brand, so they are not in the repo. Download the official SVG for each from the
brand's own asset page (search "<brand> brand assets") and save them in `apps/web/public/payment-logos/`:

    swish.svg  apple-pay.svg  google-pay.svg  visa.svg  mastercard.svg  klarna.svg

Missing file = the badge shows the plain name, so nothing breaks.

## 2. Make Stripe really offer them (important: do not show a logo for a method that is off)
Stripe Dashboard → Settings → Payment methods. Switch on:
- Cards (Visa, Mastercard) - on by default. Apple Pay and Google Pay come with cards automatically
  (Apple Pay needs the domain registered under Settings → Payment methods → Apple Pay).
- Klarna - turn on and complete Stripe's activation.
- Swish - turn on; needs a Swedish business entity and SEK. If Stripe will not enable it for the account,
  remove `swish` from `PAYMENT_METHODS` in `components/account/PaymentMethods.tsx`.

The booking API lets Stripe choose from what is enabled. To force a list instead, set on Render
`STRIPE_PAYMENT_METHODS=card,klarna,swish` (leave empty normally).
Klarna and Swish also depend on currency (SEK) and the buyer's country.
