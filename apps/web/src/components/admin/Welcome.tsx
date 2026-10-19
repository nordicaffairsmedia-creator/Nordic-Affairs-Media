import { hasRole, roleLabels, topRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { internalApi, money } from '@/lib/staff'
import { Insights } from './Insights'

/*
 * The content manager's home, laid out like the WordPress / Elementor home the client knows:
 * a site bar with the main buttons, a greeting, the key figures, "Start building" cards for
 * the everyday jobs, and the latest activity. Everything is filtered by role: the owner sees
 * the whole business, an Admin manager sees website + ticketing, an Editor sees the website.
 */

type Row = { id: string; title: string; meta: string; href: string }
type U = { roles?: unknown; name?: string | null; email?: string | null } | undefined

const fmt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Europe/Stockholm',
      })
    : ''

/** Never let a sleeping booking server hold up the dashboard. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T) {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))])
}

type Reports = {
  byEvent?: { _id: { currency: string }; tickets: number; gross: number; refunded: number }[]
}

async function facts(organiser: boolean) {
  const payload = await getPayloadClient()
  const now = new Date().toISOString()
  const count = (collection: string, where?: Record<string, unknown>) =>
    payload
      .count({ collection: collection as never, where: where as never, overrideAccess: true })
      .then((r) => r.totalDocs)
      .catch(() => 0)
  const list = <T,>(collection: string, sort: string, where?: Record<string, unknown>) =>
    payload
      .find({
        collection: collection as never,
        limit: 5,
        sort,
        depth: 0,
        overrideAccess: true,
        draft: true,
        where: where as never,
      })
      .then((r) => r.docs as unknown as T[])
      .catch(() => [] as T[])

  const [
    galleries,
    photos,
    stories,
    pages,
    upcoming,
    newEnquiries,
    subscribers,
    recentEnquiries,
    recentGalleries,
    nextEvents,
    sales,
  ] = await Promise.all([
    count('galleries', { _status: { equals: 'published' } }),
    count('media'),
    count('articles', { _status: { equals: 'published' } }),
    count('pages'),
    count('events', { startsAt: { greater_than: now } }),
    count('enquiries', { status: { equals: 'new' } }),
    count('subscribers'),
    list<{ id: string; subject?: string; name?: string; status?: string; createdAt: string }>(
      'enquiries',
      '-createdAt',
    ),
    list<{ id: string; title?: string; _status?: string; updatedAt: string; photoCount?: number }>(
      'galleries',
      '-updatedAt',
    ),
    organiser
      ? list<{ id: string; title?: string; _status?: string; startsAt: string }>('events', 'startsAt', {
          startsAt: { greater_than: now },
        })
      : Promise.resolve([]),
    organiser
      ? withTimeout(
          internalApi<Reports>('/internal/reports').then((r) => (r.ok ? r.data : null)),
          4000,
          null,
        )
      : Promise.resolve(null),
  ])

  const byEvent = sales?.byEvent ?? []
  const ticketsSold = byEvent.reduce((n, e) => n + (e.tickets ?? 0), 0)
  const currency = byEvent[0]?._id.currency ?? 'SEK'
  const revenue = byEvent.reduce((n, e) => n + (e.gross ?? 0) - (e.refunded ?? 0), 0)

  const rows = {
    enquiries: recentEnquiries.map<Row>((e) => ({
      id: e.id,
      title: e.subject || '(no subject)',
      meta: `${e.name ?? ''} · ${fmt(e.createdAt)}${e.status === 'new' ? ' · New' : ''}`,
      href: `/admin/collections/enquiries/${e.id}`,
    })),
    galleries: recentGalleries.map<Row>((g) => ({
      id: g.id,
      title: g.title || '(untitled)',
      meta: `${g._status === 'published' ? 'Published' : 'Draft'} · ${g.photoCount ?? 0} photos · ${fmt(g.updatedAt)}`,
      href: `/admin/collections/galleries/${g.id}`,
    })),
    events: nextEvents.map<Row>((e) => ({
      id: e.id,
      title: e.title || '(untitled)',
      meta: `${fmt(e.startsAt)} · ${e._status === 'published' ? 'On sale' : 'Draft'}`,
      href: `/staff/events/${e.id}`,
    })),
  }
  return {
    galleries,
    photos,
    stories,
    pages,
    upcoming,
    newEnquiries,
    subscribers,
    ticketsSold,
    revenue: sales ? money(revenue, currency) : '—',
    rows,
  }
}

function List({ title, rows, empty, more }: { title: string; rows: Row[]; empty: string; more?: Row }) {
  return (
    <section className="nam-panel">
      <div className="nam-panel__head">
        <h3 className="nam-panel__title">{title}</h3>
        {more ? (
          <a href={more.href} className="nam-panel__more">
            {more.title} ›
          </a>
        ) : null}
      </div>
      {rows.length ? (
        <ul className="nam-list">
          {rows.map((r) => (
            <li key={r.id}>
              <a href={r.href} className="nam-list__row">
                <span className="nam-list__title">{r.title}</span>
                <span className="nam-list__meta">{r.meta}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="nam-list__empty">{empty}</p>
      )}
    </section>
  )
}

type Card = { tag: string; title: string; text: string; href: string; cta: string }

export async function Welcome({ user }: { user?: unknown }) {
  const u = user as U
  const owner = hasRole(u)
  const organiser = hasRole(u, 'admin')
  const role = topRole(u)
  const f = await facts(organiser)
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Stockholm',
  })

  const stats = [
    { label: 'Galleries live', value: f.galleries.toLocaleString('sv-SE') },
    { label: 'Photos & images', value: f.photos.toLocaleString('sv-SE') },
    { label: 'Stories live', value: f.stories.toLocaleString('sv-SE') },
    ...(organiser
      ? [
          { label: 'Upcoming events', value: f.upcoming.toLocaleString('sv-SE') },
          { label: 'Tickets sold · 12 mo', value: f.ticketsSold.toLocaleString('sv-SE') },
          { label: 'Revenue · 12 mo', value: f.revenue, accent: true },
        ]
      : [{ label: 'Pages', value: f.pages.toLocaleString('sv-SE') }]),
    { label: 'New messages', value: f.newEnquiries.toLocaleString('sv-SE'), accent: f.newEnquiries > 0 },
    { label: 'Subscribers', value: f.subscribers.toLocaleString('sv-SE') },
  ]

  const cards: Card[] = [
    {
      tag: 'Create',
      title: 'Add a gallery',
      text: 'New event photos with a title, story and cover — appears on the Gallery page.',
      href: '/admin/collections/galleries/create',
      cta: 'New gallery',
    },
    {
      tag: 'Create',
      title: 'Write a story',
      text: 'News, interviews and press releases in four languages.',
      href: '/admin/collections/articles/create',
      cta: 'New story',
    },
    {
      tag: 'Design',
      title: 'Home page slideshow',
      text: 'Change the landing photos, the title and the “Explore More” button.',
      href: '/admin/globals/homepage',
      cta: 'Edit home page',
    },
    {
      tag: 'Design',
      title: 'About page',
      text: 'Intro, expertise, major events, pillars and contact details.',
      href: '/admin/globals/about-page',
      cta: 'Edit About',
    },
    ...(organiser
      ? [
          {
            tag: 'Tickets',
            title: 'Create an event',
            text: 'Date, venue, ticket types and prices. Goes on sale when you publish.',
            href: '/admin/collections/events/create',
            cta: 'New event',
          },
          {
            tag: 'Tickets',
            title: 'Gate scanner',
            text: 'Scan tickets with a phone camera at the door.',
            href: '/staff/scan',
            cta: 'Open scanner',
          },
        ]
      : []),
    ...(owner
      ? [
          {
            tag: 'Manage',
            title: 'Team & roles',
            text: 'Add an Admin manager, an Editor or Ticket staff. Each sees only their part.',
            href: '/admin/collections/users/create',
            cta: 'Add a person',
          },
          {
            tag: 'Manage',
            title: 'Import from old website',
            text: 'Bring over galleries, photos and pages from nordicaffairsmedia.com.',
            href: '/staff/import',
            cta: 'Open import',
          },
        ]
      : []),
  ]

  return (
    <div className="nam-dash">
      {/* Site bar, like the old panel's "Nordic Affairs Media · Go to site setup · Edit site". */}
      <div className="nam-sitebar">
        <p className="nam-sitebar__name">Nordic Affairs Media</p>
        <div className="nam-sitebar__actions">
          {owner ? (
            <a href="/admin/globals/site-settings" className="nam-sitebar__link">
              Site settings ›
            </a>
          ) : null}
          <a href="/en" target="_blank" rel="noopener noreferrer" className="nam-btn">
            View website ↗
          </a>
          <a href="/admin/globals/homepage" className="nam-btn nam-btn--gold">
            Edit site
          </a>
        </div>
      </div>

      <section className="nam-welcome">
        <div>
          <p className="nam-admin-eyebrow">
            {today}
            {role ? <span className="nam-role">{roleLabels[role]}</span> : null}
          </p>
          <h2 className="nam-welcome__title">Dashboard</h2>
          <p className="nam-welcome__text">
            Here is how things stand today. Everything is in the menu on the left. Use
            <strong> Content language</strong> (top right) to edit the English, Svenska, தமிழ் or
            മലയാളം version; the panel&apos;s own language is under Account.
          </p>
        </div>
      </section>

      <div className="nam-stats">
        {stats.map((s) => (
          <div key={s.label} className={`nam-stat${'accent' in s && s.accent ? ' nam-stat--accent' : ''}`}>
            <p className="nam-stat__label">{s.label}</p>
            <p className="nam-stat__value">{s.value}</p>
          </div>
        ))}
      </div>

      <h3 className="nam-section">Insights</h3>
      <Insights owner={owner} organiser={organiser} />

      <h3 className="nam-section">Let&apos;s start building.</h3>
      <div className="nam-cards">
        {cards.map((c) => (
          <a key={c.title} href={c.href} className="nam-card">
            <span className="nam-card__tag">{c.tag}</span>
            <span className="nam-card__title">{c.title}</span>
            <span className="nam-card__text">{c.text}</span>
            <span className="nam-card__cta">{c.cta}</span>
          </a>
        ))}
      </div>

      <div className="nam-panels">
        {organiser ? (
          <List
            title="Upcoming events"
            rows={f.rows.events}
            empty="No upcoming events."
            more={{ id: 'all', title: 'Sales overview', meta: '', href: '/staff' }}
          />
        ) : null}
        <List
          title="Latest messages"
          rows={f.rows.enquiries}
          empty="No messages yet."
          more={{ id: 'all', title: 'All', meta: '', href: '/admin/collections/enquiries' }}
        />
        <List
          title="Recently edited galleries"
          rows={f.rows.galleries}
          empty="No galleries yet."
          more={{ id: 'all', title: 'All', meta: '', href: '/admin/collections/galleries' }}
        />
      </div>
    </div>
  )
}
