import { withPayload } from '@payloadcms/next/withPayload'

/**
 * Security headers applied to every route. A Content-Security-Policy is added once
 * Stripe, analytics and the AI assistant are wired in (phases 3 and 6), so it can
 * list exactly the outside services the site is allowed to talk to.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

// The site's own host must be allowed for next/image, because Payload returns absolute media URLs.
const publicUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ||
  process.env.RENDER_EXTERNAL_URL
const ownHost = publicUrl ? new URL(publicUrl) : null

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Lint runs separately (`npm run lint`), so a style warning never blocks a deploy.
  eslint: { ignoreDuringBuilds: true },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Media is served by Payload locally in dev; add the EU object-storage host here in production.
      { protocol: 'http', hostname: 'localhost' },
      ...(ownHost
        ? [
            {
              protocol: /** @type {'http' | 'https'} */ (ownHost.protocol.replace(':', '')),
              hostname: ownHost.hostname,
            },
          ]
        : []),
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Photos are public and their file names never change, so browsers and Vercel's
      // CDN may keep them for a year. Without this every photo went through the server
      // on every visit (about 1 s each) and big galleries loaded slowly.
      {
        source: '/api/media/file/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
