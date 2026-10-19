# Move the booking API from Render to Vercel

The code is ready (`apps/api`): `src/app.ts` is the API, `api/index.js` is the Vercel entry,
`vercel.json` sets region (Frankfurt), time limit and the two scheduled jobs. Render keeps working
with the same code (`src/index.ts`), so you can go back at any time.

You need: Vercel **Pro** (the Hobby plan forbids shops and runs jobs only once a day).

## 1. MongoDB Atlas
Network Access → add `0.0.0.0/0` (Vercel has no fixed address). Keep the database user password strong.

## 2. New Vercel project
1. Vercel → Add New → Project → pick the same GitHub repository `Nordic-Affairs-Media`.
2. Name it `nam-api`. **Root Directory: `apps/api`**. Framework Preset: **Other**.
3. Leave "Include source files outside of the Root Directory" **on**.
4. Settings → General → Node.js Version **22.x**.

## 3. Environment variables (Settings → Environment Variables, Production)
Copy the values from the Render service `nam-api`:
`DATABASE_URI`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL`,
`PAYMENT_MODE` (same as on Render), `INTERNAL_API_KEY` (same value as in both websites),
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `OPENAI_API_KEY`, `OPENAI_MODEL`,
`ENTRAIOT_COMMISSION_PERCENT` (and `ENTRAIOT_COMMISSION_FIXED` if used).
Also set:
- `ALLOWED_ORIGINS` = both website addresses, comma-separated, e.g.
  `https://frontend-nordic-affairs-media.vercel.app,https://nordic-affairs-media.vercel.app`
  (the first one is used in email links and Stripe redirects).
- `CRON_SECRET` = any random text, 24+ characters (new).
- `STRIPE_WEBHOOK_SECRET` — filled in at step 5.
Mark secrets as Sensitive. Never put them in the chat or in GitHub.

## 4. Deploy and check
Deploy, then open `https://<nam-api address>/health`. Expected: `{"ok":true,"service":"nam-booking-api",...}`.
Then set `PUBLIC_API_URL` = that address (no slash at the end) and redeploy once.

## 5. Stripe webhook (new address, new secret)
Stripe Dashboard → Developers → Webhooks → Add endpoint `https://<nam-api address>/webhooks/stripe`, events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
Copy its **new** signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` on Vercel → redeploy.
Keep the old Render endpoint until step 7 is done.

## 6. Point both websites at the new API
In **both** website projects set `NEXT_PUBLIC_BOOKING_API_URL` and `BOOKING_API_URL` to the new
address, then **redeploy both** (the first one is read at build time).

## 7. Test, then retire Render
- Ticket picker shows availability; a test purchase (Stripe test card) gives the confirmation page, email, ticket PDF and QR.
- Staff → gate scanner and dashboard load.
- Vercel → `nam-api` → Settings → Cron Jobs shows `/cron/sweep` and `/cron/reminders`; press **Run** on each (answer `{"ok":true}`).
- Leave Render running 1–2 weeks. Then disable the old Stripe webhook and delete the Render `nam-api` service.

## Going back
Set the two website variables back to the Render address and redeploy both websites.

## Good to know
- One request can run up to 60 s; the first request after a quiet period takes about a second longer.
- Per-visitor request limits and the hold sweeper now use MongoDB / Vercel Cron instead of server memory.
- If both Render and Vercel run at the same time, the sweepers are safe (each hold and reminder is claimed atomically).
