import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig, type CollectionConfig, type GlobalConfig, type Plugin } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Documents } from './collections/Documents'
import { Videos } from './collections/Videos'
import { Categories, EventCategories, Tags, Venues } from './collections/Taxonomy'
import { Authors } from './collections/Authors'
import { Articles } from './collections/Articles'
import { Publications } from './collections/Publications'
import { Events } from './collections/Events'
import { PromoCodes } from './collections/PromoCodes'
import { Pages, Redirects } from './collections/Pages'
import { AuditLog, Enquiries, Galleries, Organizers, Subscribers } from './collections/Engagement'
import { Homepage } from './globals/Homepage'
import { Navigation } from './globals/Navigation'
import { ArtistProfile } from './globals/ArtistProfile'
import { AboutPage } from './globals/AboutPage'
import { PlatformSettings, SiteSettings } from './globals/SiteSettings'
import { LoginEvents, PageViews } from './collections/Analytics'
import { en } from '@payloadcms/translations/languages/en'
import { sv } from '@payloadcms/translations/languages/sv'
import { logLogin } from './lib/loginLog'
import { relaxCollection, relaxGlobal } from '@/lib/relaxRequired'
import { ensureOwner } from './lib/ensureOwner'
import { auditChange, auditDelete, auditGlobal } from './lib/audit'
import { defaultLocale, localeMeta, locales } from './i18n/config'
import { allowedOrigins } from './lib/origins'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// The free Render server has 512 MB of memory: resize one image at a time, keep no cache.
sharp.cache(false)
sharp.concurrency(1)

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`)
  return value
}

/** Changes to these are written to the audit log (PRD S-11). */
const AUDITED = new Set([
  'events',
  'promo-codes',
  'organizers',
  'users',
  'pages',
  'articles',
  'publications',
  'redirects',
])

const withAudit = (c: CollectionConfig): CollectionConfig =>
  AUDITED.has(c.slug)
    ? {
        ...c,
        hooks: {
          ...c.hooks,
          afterChange: [...(c.hooks?.afterChange ?? []), auditChange],
          afterDelete: [...(c.hooks?.afterDelete ?? []), auditDelete],
        },
      }
    : c

const withGlobalAudit = (g: GlobalConfig): GlobalConfig => ({
  ...g,
  hooks: { ...g.hooks, afterChange: [...(g.hooks?.afterChange ?? []), auditGlobal] },
})

/** A Save button that reacts to the first click (see components/admin/InstantSave). */
const INSTANT_SAVE = '/components/admin/InstantSave#InstantSave'
const withInstantSave = (c: CollectionConfig): CollectionConfig => ({
  ...c,
  admin: {
    ...c.admin,
    components: {
      ...c.admin?.components,
      edit: { SaveButton: INSTANT_SAVE, ...c.admin?.components?.edit },
    },
  },
})
const withGlobalInstantSave = (g: GlobalConfig): GlobalConfig => ({
  ...g,
  admin: {
    ...g.admin,
    components: {
      ...g.admin?.components,
      elements: { SaveButton: INSTANT_SAVE, ...g.admin?.components?.elements },
    },
  },
})

/**
 * Images and PDFs go to S3-compatible storage (e.g. Cloudflare R2 in the EU) when
 * S3_BUCKET is set; otherwise they are kept on the server's disk (fine locally,
 * but lost on every Render redeploy).
 */
const publicUrl = process.env.S3_PUBLIC_URL?.trim().replace(/\/$/, '')
const publicFiles = publicUrl
  ? {
      disablePayloadAccessControl: true as const,
      generateFileURL: ({ filename, prefix }: { filename: string; prefix?: string }) =>
        [publicUrl, prefix, filename].filter(Boolean).join('/'),
    }
  : true

const plugins: Plugin[] = process.env.S3_BUCKET
  ? [
      s3Storage({
        collections: {
          // Photos and videos are public. When the bucket has a public address
          // (S3_PUBLIC_URL), browsers load them straight from Cloudflare instead of
          // through this server: big galleries load fast even on the smallest plan,
          // and videos seek smoothly on iPhones. Documents stay behind access control.
          media: publicFiles,
          documents: true,
          videos: publicFiles,
        },
        bucket: process.env.S3_BUCKET,
        // Vercel refuses request bodies over 4.5 MB, so there the admin uploads photos and
        // videos straight from the browser to the bucket (needs the bucket's CORS rule).
        // S3_CLIENT_UPLOADS=true does the same on Render, so big high-resolution photos and
        // videos never pass through the small server at all (needs the bucket's CORS rule).
        clientUploads: Boolean(process.env.VERCEL) || process.env.S3_CLIENT_UPLOADS === 'true',
        config: {
          region: process.env.S3_REGION || 'auto',
          endpoint: process.env.S3_ENDPOINT || undefined,
          forcePathStyle: Boolean(process.env.S3_ENDPOINT),
          credentials: {
            accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
            secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
          },
        },
      }),
    ]
  : []

export default buildConfig({
  csrf: allowedOrigins(),
  cors: allowedOrigins(),
  // No serverURL on purpose: the admin then calls the API on whatever address it is opened on
  // (both Vercel addresses work). With it set, the admin on the second address sent every
  // request to the first one, the sign-in cookie was not sent, and Save ended in "Failed to fetch".
  secret: requireEnv('PAYLOAD_SECRET'),
  db: mongooseAdapter({
    url: requireEnv('DATABASE_URI'),
    // Free MongoDB Atlas allows ~500 connections. Every Vercel/Render instance opens its own
    // pool, so keep each pool small and close idle connections quickly. Without this the
    // limit is hit and pages that read the database fail with "server-side exception".
    connectOptions: { maxPoolSize: process.env.VERCEL ? 5 : 3, minPoolSize: 0, maxIdleTimeMS: 15_000, serverSelectionTimeoutMS: 8_000 },
  }),
  editor: lexicalEditor(),
  sharp,
  plugins,
  admin: {
    user: Users.slug,
    // Events happen in Sweden: every date/time typed in the admin is Swedish time (Europe/Stockholm),
    // wherever the editor sits, and the website shows exactly that value.
    timezones: { defaultTimezone: 'Europe/Stockholm', supportedTimezones: [{ label: 'Sweden (Stockholm)', value: 'Europe/Stockholm' }] },
    meta: {
      titleSuffix: ' — Nordic Affairs Media',
      icons: [{ rel: 'icon', type: 'image/png', url: '/icons/favicon-48.png' }],
    },
    // Always the navy look of the website (styles in app/(payload)/custom.scss).
    // Navy (dark) by default; the sun / moon button in the top bar switches to light.
    theme: 'all',
    importMap: { baseDir: path.resolve(dirname) },
    components: {
      // Eye button on every password field in the content manager.
      providers: ['/components/admin/PasswordReveal#PasswordReveal'],
      graphics: {
        Logo: '/components/admin/Brand#Logo',
        Icon: '/components/admin/Brand#Icon',
      },
      // Our own dashboard instead of Payload's tile grid (which repeats the left menu).
      views: { dashboard: { Component: '/components/admin/Dashboard#Dashboard' } },
      // Safety net: if the default dashboard is ever shown, it still opens with ours.
      beforeDashboard: ['/components/admin/Welcome#Welcome'],
      // "Howdy, <name>" at the top right, like WordPress.
      actions: [
        '/components/admin/HeaderTools#HeaderTools',
        '/components/admin/HeaderGreeting#HeaderGreeting',
      ],
      // Ticketing and tools from the staff suite, shown in the left menu by role.
      afterNavLinks: ['/components/admin/NavExtras#NavExtras'],
      // Folds every menu section except the one you are in.
      beforeNavLinks: ['/components/admin/NavTidy#NavTidy'],
    },
  },
  // Language of the content manager's own buttons and menus (Account → Language).
  // "Content language" (top right) only switches which translation of the content you edit.
  i18n: {
    supportedLanguages: { en, sv },
    fallbackLanguage: 'en',
    translations: {
      en: { general: { locale: 'Content language' } },
      sv: { general: { locale: 'Innehållsspråk' } },
    },
  },
  localization: {
    locales: locales.map((code) => ({ code, label: localeMeta[code].label })),
    defaultLocale,
    fallback: true,
  },
  // Menu order follows WordPress, which the client knows: Website (pages), Posts &
  // galleries, Media library, Ticketing, Inbox (form messages), Users & security, Settings.
  collections: [
    Pages,
    Galleries,
    Articles,
    Publications,
    Authors,
    Categories,
    Tags,
    Media,
    Videos,
    Documents,
    Events,
    PromoCodes,
    Venues,
    Organizers,
    EventCategories,
    Enquiries,
    Subscribers,
    Users,
    AuditLog,
    Redirects,
  ]
    .map(relaxCollection)
    .map(withAudit)
    .map(withInstantSave)
    // Sign-in log and visitor counter: written by the system, so not audited themselves.
    .concat([LoginEvents, PageViews]),
  globals: [Homepage, Navigation, AboutPage, ArtistProfile, SiteSettings, PlatformSettings]
    .map(relaxGlobal)
    .map(withGlobalAudit)
    .map(withGlobalInstantSave),
  // Large uploads (high-resolution photos, videos up to 200 MB): files are written to a
  // temporary file instead of being held in memory, so the small server does not run out.
  upload: {
    // 200 MB per file (videos, audio, documents). The server's own default request cap is
    // only 50 MB, which silently blocked bigger videos, so it is raised to match.
    limits: { fileSize: 200 * 1024 * 1024 },
    requestSizeLimit: 210 * 1024 * 1024,
    useTempFiles: true,
    tempFileDir: '/tmp',
  },
  // Keeps the single owner account (username / password from Render) in place.
  onInit: async (payload) => {
    await ensureOwner(payload)
  },
  hooks: {
    // Failed sign-ins on /admin go to the sign-in log (successful ones: Users → afterLogin).
    afterError: [
      async ({ error, req }) => {
        const name = (error as { name?: string })?.name
        if (name !== 'AuthenticationError' && name !== 'LockedAuth') return
        if (!req?.url || !req.url.includes('/login')) return
        const email = (req.data as { email?: unknown } | undefined)?.email
        await logLogin(req.payload, {
          email: typeof email === 'string' ? email : '',
          ok: false,
          source: 'admin',
          headers: req.headers,
        })
      },
    ],
  },
  // Runs scheduled publishing (Articles → schedulePublish).
  jobs: {
    autoRun: [{ cron: '* * * * *', queue: 'default' }],
  },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  graphQL: { disable: true },
})
