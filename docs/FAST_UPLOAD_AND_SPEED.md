# Fast upload, upload order, My bookings, speed

## Fast upload (many photos and videos at once)
Content manager → Media or Videos → **Fast upload** button (also in the left menu), or `/staff/upload`.
Choose or drop any number of files. The browser makes the web sizes of each photo itself, sends up to 8
files at the same time straight to the Cloudflare bucket, and records them with one request per 50 files.
There are no per-file messages; a single progress bar, then a summary. How long it takes depends on the
total file size and the internet connection of the person uploading: 30 web-size photos (about 1 MB each)
take a few seconds; 30 large camera photos or videos take as long as their size needs to travel.
The built-in "Bulk Upload" button still exists, but it processes one file after another on the server.

## Order
Media, Videos and Documents lists are newest first (page 1 shows what was added last). A Fast upload keeps
the order in which the files were chosen: the first chosen file is the first in the list.

## My bookings
`/en/account` (the "My bookings" link) shows only the visitor's own tickets (kept on their device, and the
ones found with an email code). Concerts & Events keeps the events to browse and the cart.

## Why pages were slow, and what changed
- Saving or uploading a photo purged the cache of the whole website, so every page had to be rebuilt on the
  next visit. Now only the public Media page is refreshed.
- A 4 MB music file and an external font file were downloaded with every page. The music now waits until the
  page has loaded; the font is loaded only on the About page.
- Every tab now shows an instant placeholder while it loads; the Articles list is cached for two minutes.

## What code cannot change (free plans)
- A free Vercel function that nobody used for a while needs a few seconds to start ("cold start"), and a free
  Render server sleeps after 15 minutes and needs up to 50 seconds. Free keep-warm pings help: add monitors at
  uptimerobot.com (free, every 5 minutes) for
  `https://<website>/api/health`, `https://<website>/en/events` and `https://<render api>/health`.
- The MongoDB Atlas cluster should be in the EU (Frankfurt), like the Vercel functions (fra1).
  Atlas → Database → cluster → check the region. A cluster in the USA adds about 150 ms to every query.
- Real fixes for the rest are the paid plans: Vercel Pro (faster, more memory), Render Starter (never sleeps).
