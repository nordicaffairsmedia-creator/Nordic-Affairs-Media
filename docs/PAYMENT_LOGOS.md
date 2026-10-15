# Payment method buttons on checkout

The payment step shows "Accepted payment methods" as buttons: Swish, Apple Pay, Google Pay, Visa, Mastercard, Klarna.
Clicking one sends the buyer straight to Stripe's secure payment page (same as "Buy now").

- Visa, Mastercard, Apple Pay and Google Pay open Stripe's card page (Stripe shows Apple/Google Pay there when the
  buyer's device supports it).
- Klarna opens Stripe's page limited to Klarna. Swish opens it limited to Swish.
- If Stripe cannot offer that method (not switched on for the account, wrong currency/country), the API falls back
  to Stripe's normal page with every enabled method, so the click never dead-ends.

The icons come from the MIT-licensed npm package `react-pay-icons`. The marks belong to their owners.

## Make sure each method is really on in Stripe
Stripe Dashboard -> Settings -> Payment methods:
- Cards (Visa, Mastercard): on by default. Apple Pay needs the domain registered; Google Pay works with cards.
- Klarna: turn on and finish Stripe's activation (SEK is supported for Swedish buyers).
- Swish: turn on; needs a Swedish business entity and SEK. If Stripe will not enable it, delete the `swish` line in
  `apps/web/src/components/account/PaymentMethods.tsx` so you do not advertise a method buyers can't use.

Optional on Render: `STRIPE_PAYMENT_METHODS=card,klarna,swish` forces that exact list for every checkout
(then the clicked button is ignored). Leave it empty normally.
