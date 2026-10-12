import type { MetadataRoute } from 'next'

/**
 * Lets phones "Add to home screen" (PRD B-09): the site then opens like an app,
 * full-screen with its own icon. Interim icon until the client's logo arrives.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nordic Affairs Media',
    short_name: 'Nordic Affairs',
    description: 'Stories, publications and events from Nordic Affairs Media.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0e2440',
    theme_color: '#0e2440',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Events', url: '/en/events' },
      { name: 'My bookings', url: '/en/account' },
    ],
  }
}
