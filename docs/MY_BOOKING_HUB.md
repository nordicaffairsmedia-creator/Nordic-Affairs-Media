# My Booking hub (events, tickets, payments)

The existing **My bookings** link in the header (label, look and address `/[locale]/account`) opens one place for
discovering events and buying tickets. Events & Concerts (`/[locale]/events`), the homepage, articles, the header and
the Admin/Staff portals are unchanged. **There is no customer signup or login.**

## Routes (all inside My Booking)

| Address | What it is |
|---|---|
| `/[locale]/account` | **Discover events**: search, date chips, city, categories, list/map, "Coming up" |
| `/[locale]/account/events/[slug]` | Event page: poster, **From price + Get tickets** button, location, date, map, description |
| `/[locale]/account/events/[slug]/tickets` | **Get tickets**: the 4-step checkout (Tickets, Buyer's information, Services, Payment) |
| `/[locale]/account?view=cart` | **Cart** tab: tickets (and promo code) saved in this browser, with a Checkout button |
| `/[locale]/account?view=tickets` | **My tickets**: the original My Bookings (email one-time code, order history, ticket + receipt PDFs, re-send, cancellation request), unchanged |
| `/[locale]/booking/confirmation` | Stripe success page (unchanged) |

## How buying works now

1. **Event page -> Get tickets** opens the checkout.
2. **Step 1 Tickets:** `+` / `-` per ticket type. The Order Summary on the right updates automatically (tickets, ticket fee,
   discount, **Order Amount**), always calculated by the booking API (`POST /quote`), never in the browser.
   Promo code: type it and press **Add to cart** (checked by the server, saved in the Cart tab, then on to step 2).
   Without a code, just choose the count and press **Next**.
3. **Step 2 Buyer's information:** name, email, phone (country code), country, postal code, "I buy as a company",
   marketing consents (both unticked by default) and the terms box. A 10-minute order countdown starts
   (the hold length from Settings; the tickets themselves are reserved when the buyer presses Buy now).
4. **Step 3 Services** (only offered services appear): tickets by SMS, money back in case of illness, event reminder.
   Yes/No for each, or **Add all services**. The price of each Yes is added to the Order Amount.
5. **Step 4 Payment:** "Pay by card" then **Buy now** -> Stripe's secure payment page (cards, Apple Pay, Google Pay).
   Free orders show **Confirm booking** instead and skip Stripe.
6. After payment: **"Your tickets are booked successfully"**, QR tickets on screen, PDF and email, and the cart is emptied.
   The same email can open **My tickets** later with a one-time code (still no accounts or passwords).
7. If payment is cancelled the buyer returns to the event page.

Buyer details from step 2 are stored on the order (`phone`, `country`, `postalCode`, `companyName`, `consent`) and the phone is
returned to authorised staff in the event order list. The older Events & Concerts page keeps its own flow (Stripe collects the details).

## The three services (Admin -> Settings -> Platform settings -> "Checkout services")

Each can be switched on/off and priced (event currency, defaults 15 / 13 / 15). Defaults were taken from your reference screenshots; change them to your own prices.

| Service | What it does |
|---|---|
| **Tickets by SMS** | After payment, a text message with the link to the QR tickets is sent to the buyer's phone. |
| **Money back in case of illness** | If the buyer presses "Request cancellation" in My tickets before the event starts, the tickets and fees are refunded to the card automatically and the tickets are cancelled. The price of this service is not refunded. **This is our own guarantee, not an insurance product, and nobody checks for illness. Switch it off if you do not want that risk.** |
| **Event reminder** | One SMS with the event details within 24 hours before the start (sent by a check that runs every 5 minutes while the API is awake; on Render's free plan the API sleeps, so use a paid instance or an uptime pinger). |

**SMS needs Twilio.** Without these three settings on the Render API the two SMS services are not offered to buyers (nobody pays for
something we cannot send): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (your Twilio number or sender name).
Only refund protection is shown until then.

## Why ticket selection failed (diagnosis from the code)

The "+" button is disabled until the booking API answers `GET /events/:id/availability`. If that call failed
(wrong/missing `NEXT_PUBLIC_BOOKING_API_URL` at build time, `ALLOWED_ORIGINS` on Render not matching the Vercel address,
Render free tier still waking up, or the event not in the API's database) the button stayed disabled silently.
A missing `STRIPE_SECRET_KEY` on Render shows "payments unavailable". The picker now shows "Checking availability…",
a clear error with **Try again**, and per-tier "Not on sale".

## What you must configure

**Stripe (payments)**
1. Stripe Dashboard -> Developers -> API keys -> **Secret key** (`sk_test_...` first, `sk_live_...` later).
2. Developers -> Webhooks -> Add endpoint `https://<your-render-api>/webhooks/stripe` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `charge.refunded`. Copy the **Signing secret** (`whsec_...`).
3. Render -> nam-api -> Environment: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Redeploy.
4. `https://<api>/health` must show `"payments": true`. Test card `4242 4242 4242 4242`.

**Render API:** `ALLOWED_ORIGINS` = your Vercel address (https, no trailing slash; several allowed, comma separated).
**Vercel:** `NEXT_PUBLIC_BOOKING_API_URL` = the Render API address, then redeploy (baked in at build time).
**Email:** `RESEND_API_KEY` and `EMAIL_FROM` (domain verified in Resend) - needed for ticket emails and the My tickets code.
**Map pins:** enter each venue's real latitude and longitude in the CMS; events without them stay in the list only.

## Notes

- Promo codes are validated server-side: dates, event, usage limit, minimum spend, maximum discount, per-buyer limit
  (the per-buyer limit only applies where the email is known before payment, i.e. free orders).
- Gift cards and a cash/stored-value wallet are not built (they need a separate approval).
- Organiser names are not publicly searchable; search covers title, summary, venue, city and line-up names.
- Swedish, Tamil and Malayalam text is a draft for native review.

## Deploy and roll back

Deploy: push to GitHub (Vercel rebuilds the website), redeploy the Render API, set the variables above.
Roll back: redeploy the previous Git commit on both. No existing data was modified; no migration involved.


## Event map location (admin)

When creating or editing an event in the admin, open **Details → Map location**:

1. Optionally fill **Place name** and **Address** (shown to buyers).
2. Type an address in the search box and press **Find on map**, or click the map to drop the pin.
   Latitude and longitude fill in automatically (you can also type them). **Remove pin** clears it.
3. **Publish changes.** The event now appears on the **My Booking → Map** view and its page shows
   a map with a Directions link.

The event's own location wins; if it is empty the venue's coordinates (Venues → latitude/longitude)
are used; with neither, the event stays in the list but is not pinned. Map tiles and the address
search use OpenStreetMap (no key). Note: the address search needs the browser to reach
nominatim.openstreetmap.org; if it is blocked, click the map instead.

## Dummy payment gateway, ticket images and gate approval

**Dummy payments.** While the Stripe keys are not set, set `PAYMENT_MODE=demo` on the booking API (Render).
Checkout then sends the buyer to `/[locale]/account/pay/[ref]`, a practice payment page (fixed test card
values, nothing is collected, no money moves). "Pay" calls `POST /demo/pay`, which runs the same
`fulfilOrder` as a real payment (tickets issued, email, SMS). Orders paid this way carry `demo: true` and
show "Demo payment" on the confirmation page, the ticket image and the gate scanner. The moment
`STRIPE_SECRET_KEY` exists the dummy gateway switches itself off and Stripe is used. To go live: add the
Stripe keys and webhook, then delete `PAYMENT_MODE`.

**Ticket image.** Every ticket has its own picture with its own QR: `GET /orders/:ref/tickets/:code.svg?t=…`
(SVG). The confirmation page shows it and offers a PNG download (drawn in the browser from the SVG).

**Gate.** The scanner reads the QR (`NAM1:<code>`), calls `/internal/checkin` and shows a full-screen green
**TICKET APPROVED** with holder, ticket type, event and order, then keeps a list of approved tickets. A second
scan of the same ticket shows "Already checked in" with the time. Gate staff only see events assigned to them
(Events → Gate staff); admins see all published events.

**Why an event may not show / show "Get tickets".** The event must be *Published* (Publish changes). Discover
lists today and later plus undated events; finished events are under "Past events". Get tickets needs Sales
status *On sale*, a future date and at least one ticket type that is on sale; otherwise the button is greyed out
with the exact reason.

## Dates, selling window, speed, redirects

- **Times in the admin are Swedish time** (Europe/Stockholm) whatever country the editor is in; the website shows exactly that value.
- **Selling window:** tickets stay on sale until the event's *Ends At*; if empty (or not after the start), until midnight Stockholm at the end of the start day. The booking API and the website use the same rule.
- **Speed:** event lists, event pages and header/footer data are cached for a minute and cleared the moment an editor publishes (tag `content`), so new events appear straight away and pages answer fast. Open pages show a skeleton at once; opening My Booking wakes the (free-tier) booking API in the background.
- **Redirects:** checkout sends the buyer back to the website address they ordered from (`webOrigin`, validated against `ALLOWED_ORIGINS`); the browser never follows an API-supplied foreign address. On Render set `ALLOWED_ORIGINS` to your real site first, e.g. `https://nordic-affairs-media.vercel.app`.

## Now lives under Concerts & Events

The hub (Discover / Cart / My tickets, search, map, event page, checkout, pay, thank-you) is the Concerts & Events page: `/<lang>/events`, `/<lang>/events/<slug>`, `/<lang>/events/<slug>/tickets`, `/<lang>/events/pay/<order>`. Old `/account…` links redirect there. The separate "My bookings" header link is gone.

## Real Stripe payments

Buy now → Stripe's hosted payment page → back to `/<lang>/booking/confirmation?order=…&session_id=…`. The thank-you page asks the booking server to check the payment with Stripe (`POST /orders/:ref/confirm`), so tickets show at once; Stripe's webhook does the same job if the buyer closes the tab. Both use one routine (`settle.ts`) and are safe to run twice. The charged amount must equal the order total. Demo payments switch off by themselves as soon as `STRIPE_SECRET_KEY` is set.
Env on Render (nam-api): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ALLOWED_ORIGINS`. Webhook: `https://<api>.onrender.com/webhooks/stripe` with events checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, charge.refunded.
