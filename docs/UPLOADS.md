# Photo, video and document uploads

## How uploads work
- Photos, videos and documents are stored in the S3-compatible bucket (Cloudflare R2) set with the `S3_*` environment variables.
- **On Vercel** the admin sends the file straight from the browser to the bucket (Vercel refuses request bodies over
  4.5 MB). For that the bucket must carry a **CORS rule** that names the website's address.
  Without it every save ends with the red message **"Failed to fetch"** (photo, video and "Create New" alike).
- On Render uploads pass through the server unless `S3_CLIENT_UPLOADS=true` (then the same CORS rule is needed).
- The "Paste URL" button is removed from every upload field. Files are chosen from the computer or dragged in.

## When an upload shows "Failed to fetch"
1. Sign in, open **/staff/storage** (also in the admin menu: Tools -> Upload / storage check). Owner only.
2. Press **1. Check storage**. It tells you in plain words which of these is wrong:
   - `S3_BUCKET` missing on this website (every Vercel project needs the same S3_* values, then redeploy);
   - wrong bucket / keys;
   - the bucket's CORS rule does not include this website's address (the usual cause).
3. Press **2. Fix bucket settings**. It writes the CORS rule for every address of this website
   (production, www, the `*.vercel.app` addresses it knows, and the one you are on now).
4. Press **3. Test upload from this browser**. A green tick means photos and videos will save.
5. If step 3 says the key may not change bucket settings, paste the JSON shown on the page into
   Cloudflare -> R2 -> your bucket -> Settings -> CORS Policy -> Add CORS policy (JSON tab) and save.

Two Vercel projects (two web addresses) can share one bucket: press Fix once from **each** site. The fix keeps
the addresses the bucket already allows and adds the current site, so it never locks the other site out.
