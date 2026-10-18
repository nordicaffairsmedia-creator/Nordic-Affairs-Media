import 'server-only'
import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

import { settings as settingsDefaults, aboutDefaults, pressMentions as defaultPressMentions } from '@/lib/wordpress/content'

const MOCK_EVENTS = [
  {
    id: 'evt-1',
    title: 'Nordic-Baltic Diplomatic Gala & Symphony 2026',
    slug: 'nordic-baltic-diplomatic-gala-2026',
    date: '2026-11-14T18:30:00.000Z',
    eventDate: '2026-11-14T18:30:00.000Z',
    venue: 'Stockholm Concert Hall (Konserthuset)',
    location: 'Konserthuset, Hötorget 8, Stockholm',
    summary: 'A grand diplomatic orchestral evening celebrating regional cooperation and cultural heritage with high commissioners and diplomatic delegations.',
    category: 'Diplomatic Concert',
    status: 'scheduled',
    coverImage: {
      id: 'img-evt-1',
      url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
      alt: 'Nordic-Baltic Gala Concert',
      width: 1200,
      height: 800,
    },
    ticketTiers: [
      { name: 'Diplomatic Protocol Seat', price: 1200, currency: 'SEK', available: 45 },
      { name: 'Executive Gallery', price: 650, currency: 'SEK', available: 120 },
    ],
  },
  {
    id: 'evt-2',
    title: 'Royal Opera House Stockholm: State Choral Evening',
    slug: 'royal-opera-house-state-choral-2026',
    date: '2026-12-05T19:00:00.000Z',
    eventDate: '2026-12-05T19:00:00.000Z',
    venue: 'Royal Swedish Opera, Gustav Adolfs torg 2',
    location: 'Royal Swedish Opera, Stockholm',
    summary: 'Classical performance attended by Nordic cultural ambassadors and royal state dignitaries.',
    category: 'State Ceremony',
    status: 'scheduled',
    coverImage: {
      id: 'img-evt-2',
      url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
      alt: 'Royal Swedish Opera Choral Evening',
      width: 1200,
      height: 800,
    },
    ticketTiers: [
      { name: 'Royal Parterre', price: 1800, currency: 'SEK', available: 20 },
      { name: 'Dress Circle', price: 950, currency: 'SEK', available: 80 },
    ],
  },
  {
    id: 'evt-3',
    title: 'M.G. Sreekumar Live in Concert Stockholm',
    slug: 'm-g-sreekumar-live-concert-2026',
    date: '2026-09-26T17:00:00.000Z',
    eventDate: '2026-09-26T17:00:00.000Z',
    venue: 'Kulturhuset Stadsteatern',
    location: 'Sergels torg, Stockholm',
    summary: 'Legendary Indian playback singer performing classical and cinematic masterpieces in an international diaspora gala.',
    category: 'International Concert',
    status: 'completed',
    coverImage: {
      id: 'img-evt-3',
      url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
      alt: 'M.G. Sreekumar Concert',
      width: 1200,
      height: 800,
    },
    ticketTiers: [
      { name: 'VIP Pass', price: 850, currency: 'SEK', available: 0 },
      { name: 'Standard Seat', price: 450, currency: 'SEK', available: 0 },
    ],
  },
]

const MOCK_ARTICLES = [
  {
    id: 'art-1',
    title: 'Historic Nordic-Baltic Security Protocol Accord Ratified in Stockholm',
    slug: 'historic-nordic-baltic-accord-stockholm',
    publishedAt: '2026-10-08T10:00:00.000Z',
    summary: 'Foreign ministers across five Nordic nations convene at the Grand Hôtel to establish comprehensive sovereign media preservation frameworks.',
    category: { title: 'Diplomacy & Treaties', slug: 'diplomacy' },
    coverImage: {
      id: 'img-art-1',
      url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
      alt: 'Nordic foreign ministers conference',
      width: 1200,
      height: 800,
    },
    readingTime: '5 min read',
    author: { name: 'Editorial Chancery Staff' },
  },
  {
    id: 'art-2',
    title: 'Royal State Banquet Honors Centennial of Diplomatic Ties',
    slug: 'royal-state-banquet-centennial-diplomatic-ties',
    publishedAt: '2026-09-22T14:30:00.000Z',
    summary: 'The Royal Palace of Stockholm hosts European delegations under state ceremonial protocol, documented in medium format silver gelatin archives.',
    category: { title: 'Royal Ceremonial', slug: 'royal-ceremonial' },
    coverImage: {
      id: 'img-art-2',
      url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      alt: 'Royal State Banquet Hall',
      width: 1200,
      height: 800,
    },
    readingTime: '4 min read',
    author: { name: 'Court Correspondent' },
  },
  {
    id: 'art-3',
    title: 'Astronaut Marcus Wandt Welcomed at Swedish Royal Academy',
    slug: 'marcus-wandt-royal-academy-welcome',
    publishedAt: '2024-02-19T12:00:00.000Z',
    summary: 'Sweden’s ESA project astronaut addresses ministerial summit following successful docking at the International Space Station.',
    category: { title: 'National Heritage', slug: 'heritage' },
    coverImage: {
      id: 'img-art-3',
      url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
      alt: 'Space and Diplomatic Heritage',
      width: 1200,
      height: 800,
    },
    readingTime: '6 min read',
    author: { name: 'Science & Protocol Desk' },
  },
]

const MOCK_GALLERIES = [
  {
    id: 'gal-1',
    title: 'Nobel Peace Prize Ceremony — Oslo Archival Chronicle',
    slug: 'nobel-prize-oslo-2023',
    category: { title: 'State Ceremonial', slug: 'state-ceremonial' },
    coverImage: {
      id: 'img-gal-1',
      url: 'https://images.unsplash.com/photo-1469488865564-c2de10f69f96?auto=format&fit=crop&w=1200&q=80',
      alt: 'Nobel Peace Prize Ceremony',
      width: 1200,
      height: 800,
    },
    photoCount: 48,
  },
  {
    id: 'gal-2',
    title: 'Indo-Nordic Ministerial Summit & Bilateral Talks',
    slug: 'tobias-billstrom-pal-jonson-dr-s-jaishanker-visit-2023',
    category: { title: 'Diplomatic Summits', slug: 'diplomatic-summits' },
    coverImage: {
      id: 'img-gal-2',
      url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
      alt: 'Ministerial Summit',
      width: 1200,
      height: 800,
    },
    photoCount: 64,
  },
  {
    id: 'gal-3',
    title: 'Marcus Wandt ESA Return: Royal Welcome',
    slug: 'marcus-wandt',
    category: { title: 'Aerospace & Science', slug: 'aerospace' },
    coverImage: {
      id: 'img-gal-3',
      url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      alt: 'Marcus Wandt Welcome',
      width: 1200,
      height: 800,
    },
    photoCount: 32,
  },
]

function createMockPayload(): any {
  return {
    findGlobal: async ({ slug }: { slug: string; locale?: string }) => {
      if (slug === 'site-settings') {
        return {
          siteTitle: 'Nordic Affairs Media',
          siteName: 'Nordic Affairs Media',
          tagline: 'Diplomatic Media & Royal Photographic Chancery',
          description: settingsDefaults.description,
          location: 'Stockholm, Kingdom of Sweden',
          contactEmail: 'contact@nordicaffairsmedia.com',
          contactPhone: '+46 (0)8 559 21 400',
          whatsappNumber: '+46 70 123 4567',
          whatsapp: '+46 70 123 4567',
          accreditation: 'Swedish Press Association Accredited',
          stats: [
            { id: '1', value: '10+', label: 'Years of Excellence' },
            { id: '2', value: '500+', label: 'Global Events Covered' },
            { id: '3', value: '50+', label: 'International Assignments' },
            { id: '4', value: '100+', label: 'Trusted Partnerships' },
            { id: '5', value: '24/7', label: 'Media Coverage Support' },
          ],
          pressMentions: defaultPressMentions.map((p: any, i: number) => ({
            id: String(i + 1),
            outlet: p.outlet,
            url: p.url,
            logo: { url: p.logo, alt: p.outlet },
          })),
        }
      }
      if (slug === 'navigation') {
        return {
          links: [
            { label: 'Gallery', url: '/gallery' },
            { label: 'Events', url: '/events' },
            { label: 'About', url: '/about-us' },
            { label: 'Contact', url: '/contact' },
          ],
        }
      }
      if (slug === 'about-page') {
        return aboutDefaults
      }
      if (slug === 'homepage') {
        return {
          heroSlides: [],
          heroTitle: 'Nordic Affairs Media',
          heroText: 'Capturing History Through Excellence',
          heroButtonLabel: 'Explore Coverage',
          heroButtonLink: '/gallery',
          showNewsletter: true,
          showEvents: true,
          showGalleries: true,
          showLatest: true,
          sections: [],
        }
      }
      return {}
    },
    find: async ({ collection }: { collection: string; [key: string]: unknown }) => {
      if (collection === 'events') {
        return {
          docs: MOCK_EVENTS,
          totalDocs: MOCK_EVENTS.length,
          limit: 10,
          totalPages: 1,
          page: 1,
          pagingCounter: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        }
      }
      if (collection === 'articles') {
        return {
          docs: MOCK_ARTICLES,
          totalDocs: MOCK_ARTICLES.length,
          limit: 10,
          totalPages: 1,
          page: 1,
          pagingCounter: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        }
      }
      if (collection === 'galleries') {
        return {
          docs: MOCK_GALLERIES,
          totalDocs: MOCK_GALLERIES.length,
          limit: 10,
          totalPages: 1,
          page: 1,
          pagingCounter: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        }
      }
      return {
        docs: [],
        totalDocs: 0,
        limit: 10,
        totalPages: 0,
        page: 1,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      }
    },
    findByID: async () => null,
  }
}

/** One Payload client per request (React `cache`), reused across server components. Falls back to mock data if MongoDB is offline for pure frontend development. */
export const getPayloadClient = cache(async () => {
  if (process.env.SKIP_DB === 'true' || !process.env.DATABASE_URI || process.env.DATABASE_URI.includes('dummy')) {
    return createMockPayload()
  }
  try {
    return await getPayload({ config })
  } catch {
    return createMockPayload()
  }
})

/**
 * Relationship fields arrive either as an ID (not populated) or as the full document.
 * This narrows to the populated document so components never deal with bare IDs.
 */
export function isDoc<T extends { id: string }>(value: string | T | null | undefined): value is T {
  return typeof value === 'object' && value !== null && 'id' in value
}

export function docs<T extends { id: string }>(values: (string | T)[] | null | undefined): T[] {
  return (values ?? []).filter(isDoc)
}
