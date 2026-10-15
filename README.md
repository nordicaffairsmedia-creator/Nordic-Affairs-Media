# Nordic Affairs Media — Platform

Editorial website + ticket booking platform for Nordic Affairs Media (Sweden).
Built by Entraiot Solutions. Scope: PRD `ENT-NAM-2026-PRD-01` v1.1, proposal `ENT-NAM-2026-Q01` v1.1.

```
apps/
  web/   Next.js (App Router) + Payload CMS — public site, content manager, Admin & SuperAdmin
  api/   Node.js + Express — booking engine: holds, Stripe, e-tickets, check-in
```

Both apps share one MongoDB database (Atlas, EU region).

---

## Getting started (local)

Requirements: Node 20.9+ (22 recommended), MongoDB 7+ running locally or an Atlas connection string.

```bash
npm install

cp apps/web/.env.example apps/web/.env      # set PAYLOAD_SECRET (openssl rand -hex 32)
cp apps/api/.env.example apps/api/.env

npm run dev                                  # website + CMS on http://localhost:3000
npm run dev:api                              # booking API on http://localhost:4000 (optional for now)
```

1. Open http://localhost:3000/admin and create the first account. It automatically
   becomes the **SuperAdmin**. Add editors, organizers and gate staff from Settings → Users.
2. Optional — load clearly marked placeholder content to review the design:
   `npm run seed:placeholders -w @nam/web`
3. Visit http://localhost:3000 (redirects to `/en`), `/sv`, `/ta`, `/ml`, and the design
   system reference at `/en/styleguide`.

`npm run dev` / `build` first run `payload generate:types` and `payload generate:importmap`,
which create `src/payload-types.ts` (the TypeScript types for all CMS content). Type errors
before that first run are expected.

---

## Key decisions (and why)

| Decision | Choice | Why |
|---|---|---|
| CMS | **Payload 3**, inside the Next.js app | Runs on MongoDB, which the PRD already commits to. Gives editors drafts, scheduling, localisation and roles. No separate CMS server or licence to pay for. The Admin and SuperAdmin screens are built on it. |
| Booking backend | Separate **Express** API (`apps/api`) | Ticket stock, payments and check-in need strict, testable logic and Stripe webhooks. Keeping them apart means a CMS edit can never disturb a sale in progress. |
| Ticket holds | MongoDB with a **TTL index** | Expired holds delete themselves, releasing tickets automatically. Redis can be added later if ticket rushes need it; no extra service at launch. |
| Languages | `/en` `/sv` `/ta` `/ml` URL prefixes; one document per article with localised fields | Each language gets its own indexable URL with hreflang tags. A story keeps one slug, and untranslated fields fall back to English rather than showing blanks. |
| Fonts | Newsreader (headlines/body) + Hanken Grotesk (interface); Noto Serif/Sans Tamil & Malayalam | Editorial serif plus a clean Nordic sans. Indic fonts load only on Tamil/Malayalam pages. |
| Dark mode | **No** | The brand is print- and photography-led. A dark theme would add cost and testing without serving readers. |
| Rendering | Server Components, static pages refreshed every 5 min, instant purge on publish | Fast pages and minimal JavaScript. Only the mobile menu and language switcher run in the browser. |
| Analytics | Not installed yet | Plausible (EU, cookie-free) is recommended, to be confirmed with the client. Nothing is loaded before consent. |

### Content model (`apps/web/src/collections`)

- **Articles**: headline, deck, body, hero image/video, category, tags, authors, related stories, related event, SEO, `legacyUrl` for the old WordPress address, drafts and scheduled publishing.
- **Publications**: magazine issues with cover, number, year, PDF, linked articles and contributors.
- **Authors**, **Categories**, **Tags**.
- **Events** with ticket tiers, plus **Venues** and **Event categories**.
- **Pages** (About, Terms, Privacy…), **Redirects**, **Media** (images with alt text, caption, credit), **Documents** (PDFs), **Users** with roles `superadmin / admin / editor / gate`.
- Globals: **Homepage** (editors choose the lead story, featured stories and sections), **Navigation**, **Site settings**, **Platform settings** (owner-only: fees, VAT, hold time, feature switches, AI assistant).

**Categories are intentionally empty.** The final list will come from the client's WordPress categories and magazine PDFs, not be invented up front.

### Moving the old website

1. Set up Cloudflare R2 (or another S3 bucket) and add `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` on Render (nam-web). Without them the import refuses to start on Render, because files on the server disk are deleted on every deploy.
2. Sign in as SuperAdmin → `/staff/import` → **Start import**. Keep the tab open. Re-running is safe.
3. If it reports that the old website refused the server: on your own computer, put the same `DATABASE_URI`, `PAYLOAD_SECRET` and `S3_*` values in `apps/web/.env`, then run `npm install` and `npm run import:wordpress -w @nam/web`.
4. Afterwards, check the six galleries without a date in their photo names (Larz-Kristerz, Marcus Wandt, Nobel Prize Oslo 2023, Benjamin Dousa, Sweden PM Ulf Kristersson, Tobias Billström visit 2023) and set the event date by hand.

### Old WordPress addresses

- Put an article's old path in `legacyUrl`, or add a row to **Redirects**.
- Any unknown path is sent to the catch-all route, which answers with a single 301 to the new page.
- Old PDF links (`/wp-content/uploads/…pdf`) need explicit entries in the host's redirect rules, because paths with file extensions skip the app.

---

## Status

**Phase 1 — Foundation (this commit)**
- [x] Monorepo, Payload config, all collections and globals, roles and access rules
- [x] Four-language routing and interface dictionaries (Swedish, Tamil and Malayalam strings are **drafts for native review**)
- [x] Design tokens and components: header, mobile menu, language switcher, footer, story cards (5 layouts), category sections, events strip, latest-issue band, newsletter band, share links, editorial 404
- [x] Data-driven homepage, article page with NewsArticle and Breadcrumb structured data, CMS pages, redirects
- [x] Sitemap with hreflang, robots (blocks staging), security headers
- [x] Booking API skeleton: env validation, Mongo indexes for holds and tickets, CORS, rate limiting, health check
- [x] Placeholder seed with visible badges

**Phase 2 — Public pages (done)**
- [x] `/events` with city / category / language filters, `/events/[slug]` with ticket tiers and Event structured data
- [x] `/category/[slug]`, `/authors/[slug]` (Person data), paginated
- [x] `/publications` archive with year filter, `/publications/[slug]` with in-browser PDF reader and download
- [x] `/search` across stories, events and issues
- [x] `/artist` editorial profile — hidden until "Show on website" is ticked in Website → Artist profile

**Phase 3 — Booking engine (done, needs Stripe + Resend keys to go live)**
- [x] Ticket picker on event pages with live availability, order limits and promo codes
- [x] Stock counter per tier with atomic reservation (no double-selling), holds released after the hold time
- [x] Stripe Checkout (cards, Apple/Google Pay, Klarna, Swish — whichever are switched on in Stripe), fees and VAT
- [x] Stripe webhook → QR tickets, email with tickets PDF + VAT receipt PDF; paid-after-expiry is re-checked and refunded if sold out
- [x] Confirmation page with QR codes; My Bookings with one-time email code, downloads, re-send, cancellation request
- [x] Promo codes in the CMS (Events → Promo codes)

**Phase 4 — Staff tools and assistant (done)**
- [x] `/staff` organizer dashboard: all events with sold / capacity, checked in, net revenue
- [x] `/staff/events/[id]`: per-tier numbers, order search, full/partial refunds via Stripe, cancel single tickets, cancellation requests flagged, guest-list and box-office bookings, attendee CSV, email to all ticket holders
- [x] `/staff/scan`: phone-camera QR scanner with green/amber/red result, duplicate/cancelled/wrong-event detection, name/order search, live checked-in counter; gate staff see only events they are assigned to (Event → Gate staff)
- [x] `/staff/reports` (owner): revenue by event, month and channel, with VAT
- [x] AI assistant chat bubble — answers only from published events, FAQ/policy pages and the owner's knowledge text; can see a visitor's own bookings when they are signed in to My Bookings. Switch on in Platform settings → Feature switches → AI assistant.

Staff sign in at `/staff/login` with their content-manager account. Roles: **admin** = organizer, **gate** = door staff.

**Phase 5 — Remaining PRD items (done)**
- [x] Cookie notice with equal "only necessary" / "allow statistics" choice; statistics (Plausible) load only after consent; "Cookie settings" link in the footer (W-11)
- [x] `/contact` with enquiry types, privacy consent, spam protection; messages land in CMS → Inbox → Enquiries and are emailed to the contact address (W-08)
- [x] Newsletter with double opt-in, one-click unsubscribe; list in CMS → Inbox → Subscribers; switch on in Platform settings (W-13)
- [x] Photo galleries `/gallery` (W-14); share buttons on event pages (B-10)
- [x] Add-to-home-screen app manifest and icons (B-09)
- [x] Partner organizers with commission %; payout table in Staff → Reports (S-07)
- [x] Editable ticket-email and newsletter wording per language in Platform settings (S-10)
- [x] Audit log of changes, refunds and staff bookings — Settings → Audit log, owner only (S-11)
- [x] EU file storage (S3 / Cloudflare R2) switched on by setting `S3_BUCKET` and keys

**Phase 6 — Content move from nordicaffairsmedia.com (done, runs once storage is set up)**
- [x] Reader for the old WordPress/Elementor site through its public REST API (`src/lib/wordpress`)
- [x] 38 photo galleries (≈3,300 photos, original files), 3 video stories, About page, contact details, key figures, press-coverage logos, menu links, 301 redirects for every old address
- [x] Real event dates taken from the photographers' file names (WordPress dates are 2026 upload dates)
- [x] A gallery whose photos all appear in a bigger one is not duplicated; its old address points to the bigger one
- [x] New: **Videos** library, story hero video, gallery cover + photo count, galleries on the front page, key figures / press logos on pages ("Show key figures", "Show press coverage"), phone / WhatsApp / location / accreditation in Site settings
- [x] Staff → **Import** (owner only): runs in small steps from the browser, can be stopped and resumed, never copies a photo twice
- [x] `npm run import:wordpress -w @nam/web` does the same from a computer — use it if the old site's firewall refuses Render, or for speed

**Next phases** (PRD §11): event pages and booking flow → Stripe → Admin dashboards → SuperAdmin reports → scanner, AI assistant and content move → testing → go-live.

---

## Needed from the client

These items are listed in PRD §13:
- logo and photos
- WordPress access or export, plus the 20 priority articles (the public site itself is now imported automatically — see "Moving the old website")
- magazine PDFs
- facts for the artist profile
- Swedish, Tamil and Malayalam translations
- DNS access
- Stripe account
- policy texts

---

## Deploy on Render (staging)

`render.yaml` creates both services in the Frankfurt (EU) region.

1. **Database.** Create a free MongoDB Atlas cluster in an EU region (e.g. Frankfurt). Add a database user. Under Network Access, allow `0.0.0.0/0`, because Render's free plan has no fixed outbound IP. Copy the connection string and add the database name, e.g. `…mongodb.net/nam?retryWrites=true&w=majority`.
2. **Render.** Go to Dashboard → **New → Blueprint**, pick this GitHub repo and fill in:
   - `nam-web` → `DATABASE_URI`
   - `nam-api` → `DATABASE_URI` (same value) and `ALLOWED_ORIGINS` (the nam-web address, e.g. `https://nam-web.onrender.com`)
3. When both are live, open `https://<nam-web>/admin` and create the first account. It becomes the SuperAdmin.
4. Optional: load the placeholder content from your machine, pointed at the Atlas database: `DATABASE_URI=… PAYLOAD_SECRET=… npm run seed:placeholders -w @nam/web`. Use the same `PAYLOAD_SECRET` that Render generated.

The site address is picked up automatically from Render (`RENDER_EXTERNAL_URL`). Set `NEXT_PUBLIC_SITE_URL` only when a custom domain is added.

**Free-plan limits:**
- Services sleep after about 15 minutes idle, so the first visit after that takes about 50 seconds.
- There is no persistent disk, so images uploaded in the CMS are lost on each redeploy.
- Connect EU object storage (phase 8) and move to a paid instance before go-live.

## Deployment notes (for go-live)

- **Build needs the database.** Pages are pre-rendered at build time, so `DATABASE_URI` must be reachable from the build machine (Atlas: allow the host's IP range).
- **Scheduled publishing** uses Payload's job runner (`jobs.autoRun` in `payload.config.ts`), which needs a long-running server (e.g. a small EU VPS or container). On serverless hosting, replace it with a cron call to Payload's jobs endpoint.
- **Files**: in production, images and PDFs move to EU object storage (e.g. Cloudflare R2 via `@payloadcms/storage-s3`). Add that host to `images.remotePatterns` in `next.config.mjs`.
- **Secrets** stay in the host's environment settings only. `.env` files are git-ignored.
