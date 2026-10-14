import type { ReactNode } from 'react'
import { getPayloadClient } from '@/lib/payload'
import { internalApi, money } from '@/lib/staff'

/*
 * The graphs and health boxes of the dashboard — what the old WordPress panel spread over
 * Site Kit, Google Analytics, Yoast, "Limit Login Attempts" and the Updates screen:
 *   · Visitors (last 30 days) and the most-read pages — from the site's own counter
 *   · Ticket sales per month — from the booking server
 *   · SEO overview — how many pages have a description and a focus keyword
 *   · Sign-in attempts (24 h + 14-day chart)
 *   · Site health & updates — version, server, database, storage, email, assistant
 * Each box only appears for the roles that may see it.
 */

type Bar = { label: string; value: number; tip: string }
type Agg = { aggregate: (p: object[]) => Promise<Record<string, unknown>[]> }

const tz = 'Europe/Stockholm'
const dayKey = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: tz })
const shortDay = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: tz })
const nf = (n: number) => n.toLocaleString('sv-SE')

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T) {
  return Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))])
}

function lastDays(n: number) {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(Date.now() - i * 86400_000)))
  return out
}

/** A single-series bar chart in plain HTML: thin rounded bars, hover tooltip, sparse labels. */
function BarChart({ bars, unit, empty }: { bars: Bar[]; unit: string; empty: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  const total = bars.reduce((n, b) => n + b.value, 0)
  if (!total) return <p className="nam-chart__empty">{empty}</p>
  const every = Math.ceil(bars.length / 6)
  return (
    <figure className="nam-chart" aria-label={`${unit} chart`}>
      <span className="nam-chart__max">{nf(max)}</span>
      <div className="nam-chart__plot">
        {bars.map((b) => (
          <div key={b.label} className="nam-chart__col" tabIndex={0}>
            <span className="nam-chart__bar" style={{ height: `${Math.max(b.value ? 3 : 0, (b.value / max) * 100)}%` }} />
            <span className="nam-chart__tip" role="tooltip">
              <strong>{nf(b.value)}</strong> {unit}
              <br />
              {b.tip}
            </span>
          </div>
        ))}
      </div>
      <div className="nam-chart__axis" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={b.label}>{i % every === 0 || i === bars.length - 1 ? b.label : ''}</span>
        ))}
      </div>
      {/* The same numbers as a table, for screen readers. */}
      <table className="nam-sr">
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <th>{b.tip}</th>
              <td>{b.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function Box({ title, figure, sub, children }: { title: string; figure?: string; sub?: string; children: ReactNode }) {
  return (
    <section className="nam-panel nam-insight">
      <div className="nam-panel__head">
        <h3 className="nam-panel__title">{title}</h3>
        {figure ? <span className="nam-insight__figure">{figure}</span> : null}
      </div>
      {sub ? <p className="nam-insight__sub">{sub}</p> : null}
      {children}
    </section>
  )
}

type Reports = {
  byMonth?: { _id: { month: string; currency: string }; tickets: number; gross: number; refunded: number }[]
}

export async function Insights({ owner, organiser }: { owner: boolean; organiser: boolean }) {
  const payload = await getPayloadClient()
  const models = (payload.db as unknown as { collections: Record<string, Agg> }).collections
  const days30 = lastDays(30)
  const days14 = lastDays(14)
  const count = (collection: string, where?: Record<string, unknown>) =>
    payload
      .count({ collection: collection as never, where: where as never, overrideAccess: true })
      .then((r) => r.totalDocs)
      .catch(() => -1)

  const [visitsByDay, topPages, sales, seo, logins, health] = await Promise.all([
    // Visitors per day (30 days)
    withTimeout(
      models['page-views']
        ? models['page-views'].aggregate([
            { $match: { day: { $gte: days30[0] } } },
            { $group: { _id: '$day', views: { $sum: '$views' }, visits: { $sum: '$visits' } } },
          ])
        : Promise.resolve([]),
      4000,
      [] as Record<string, unknown>[],
    ),
    // Most-read pages (30 days)
    withTimeout(
      models['page-views']
        ? models['page-views'].aggregate([
            { $match: { day: { $gte: days30[0] } } },
            { $group: { _id: '$path', views: { $sum: '$views' } } },
            { $sort: { views: -1 } },
            { $limit: 6 },
          ])
        : Promise.resolve([]),
      4000,
      [] as Record<string, unknown>[],
    ),
    // Ticket sales per month (organisers)
    organiser
      ? withTimeout(
          internalApi<Reports>('/internal/reports').then((r) => (r.ok ? r.data : null)),
          4000,
          null,
        )
      : Promise.resolve(null),
    // SEO overview
    Promise.all(
      (['galleries', 'articles', 'pages'] as const).map(async (c) => ({
        c,
        total: await count(c),
        described: await count(c, { 'seo.description': { exists: true } }),
        keyword: await count(c, { 'seo.focusKeyword': { exists: true } }),
        hidden: await count(c, { 'seo.noIndex': { equals: true } }),
      })),
    ),
    // Sign-ins (owner)
    owner
      ? withTimeout(
          models['login-events']
            ? models['login-events'].aggregate([
                { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 86400_000) } } },
                {
                  $group: {
                    _id: {
                      day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
                      ok: '$ok',
                    },
                    n: { $sum: 1 },
                    last24: {
                      $sum: { $cond: [{ $gte: ['$createdAt', new Date(Date.now() - 86400_000)] }, 1, 0] },
                    },
                  },
                },
              ])
            : Promise.resolve([]),
          4000,
          [] as Record<string, unknown>[],
        )
      : Promise.resolve([]),
    // Health (owner)
    owner
      ? Promise.all([
          withTimeout(
            payload
              .count({ collection: 'users', overrideAccess: true })
              .then(() => true)
              .catch(() => false),
            4000,
            false,
          ),
          withTimeout(
            internalApi('/internal/settings').then((r) => r.ok),
            5000,
            false,
          ),
        ])
      : Promise.resolve(null),
  ])

  // Visitors
  const byDay = new Map(
    visitsByDay.map((r) => [String(r._id), r as { views: number; visits: number }] as const),
  )
  const viewBars: Bar[] = days30.map((d) => ({
    label: shortDay(d),
    value: byDay.get(d)?.views ?? 0,
    tip: `${shortDay(d)} · ${nf(byDay.get(d)?.visits ?? 0)} visits`,
  }))
  const views30 = viewBars.reduce((n, b) => n + b.value, 0)
  const visits30 = days30.reduce((n, d) => n + (byDay.get(d)?.visits ?? 0), 0)

  // Sales
  const months = (sales?.byMonth ?? []).slice(-12)
  const currency = months[0]?._id.currency ?? 'SEK'
  const saleBars: Bar[] = months.map((m) => ({
    label: new Date(`${m._id.month}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short' }),
    value: m.tickets,
    tip: `${new Date(`${m._id.month}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} · ${money(m.gross - (m.refunded ?? 0), m._id.currency)}`,
  }))
  const tickets12 = months.reduce((n, m) => n + m.tickets, 0)
  const net12 = months.reduce((n, m) => n + m.gross - (m.refunded ?? 0), 0)

  // Sign-ins
  const failByDay = new Map<string, number>()
  let failed24 = 0
  let ok24 = 0
  for (const r of logins as { _id: { day: string; ok: boolean }; n: number; last24: number }[]) {
    if (r._id.ok) ok24 += r.last24
    else {
      failed24 += r.last24
      failByDay.set(r._id.day, (failByDay.get(r._id.day) ?? 0) + r.n)
    }
  }
  const loginBars: Bar[] = days14.map((d) => ({
    label: shortDay(d),
    value: failByDay.get(d) ?? 0,
    tip: shortDay(d),
  }))

  // SEO
  const seoTotal = seo.reduce((n, s) => n + Math.max(0, s.total), 0)
  const seoDescribed = seo.reduce((n, s) => n + Math.max(0, s.described), 0)
  const seoKeyword = seo.reduce((n, s) => n + Math.max(0, s.keyword), 0)
  const seoHidden = seo.reduce((n, s) => n + Math.max(0, s.hidden), 0)
  const pct = (a: number) => (seoTotal ? Math.round((a / seoTotal) * 100) : 0)
  const seoLabel: Record<string, string> = { galleries: 'Galleries', articles: 'Stories', pages: 'Pages' }

  // Health
  const commit = process.env.RENDER_GIT_COMMIT?.slice(0, 7)
  const since = new Date(Date.now() - process.uptime() * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  })
  const checks = health
    ? [
        { ok: true, label: 'Website', note: 'Online' },
        { ok: health[0], label: 'Database', note: health[0] ? 'Connected' : 'Not reachable' },
        {
          ok: health[1],
          label: 'Booking & payments server',
          note: health[1] ? 'Online' : 'Not answering (it may be waking up)',
        },
        {
          ok: Boolean(process.env.S3_BUCKET),
          label: 'Photo storage',
          note: process.env.S3_BUCKET ? 'Cloud storage connected' : 'Using server disk',
        },
        {
          ok: Boolean(process.env.RESEND_API_KEY),
          label: 'Email sending',
          note: process.env.RESEND_API_KEY ? 'Connected' : 'Not set up',
        },
        {
          ok: Boolean(process.env.OPENAI_API_KEY) && process.env.ASSISTANT_ENABLED !== 'false',
          label: 'Nora assistant',
          note: process.env.OPENAI_API_KEY ? 'On' : 'Off',
        },
      ]
    : []

  return (
    <div className="nam-insights">
      <Box
        title="Visitors"
        figure={nf(visits30)}
        sub={`visits in the last 30 days · ${nf(views30)} page views`}
      >
        <BarChart bars={viewBars} unit="page views" empty="Counting starts with the first visitor after this update." />
      </Box>

      <Box title="Most-read pages" sub="Last 30 days">
        {topPages.length ? (
          <ul className="nam-list">
            {(topPages as { _id: string; views: number }[]).map((p) => (
              <li key={p._id} className="nam-list__row nam-list__row--split">
                <a href={`/en${p._id === '/' ? '' : p._id}`} target="_blank" rel="noopener noreferrer" className="nam-list__title">
                  {p._id === '/' ? 'Home page' : p._id}
                </a>
                <span className="nam-list__meta">{nf(p.views)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nam-list__empty">No visits counted yet.</p>
        )}
      </Box>

      {organiser ? (
        <Box
          title="Ticket sales"
          figure={sales ? nf(tickets12) : '—'}
          sub={sales ? `tickets in the last 12 months · ${money(net12, currency)} after refunds` : 'Booking server is not answering right now.'}
        >
          <BarChart bars={saleBars} unit="tickets" empty="No ticket sales yet." />
        </Box>
      ) : null}

      <Box title="SEO overview" figure={`${pct(seoDescribed)}%`} sub="of pages, galleries and stories have their own Google description">
        <ul className="nam-list">
          {seo.map((s) => (
            <li key={s.c} className="nam-list__row nam-list__row--split">
              <span className="nam-list__title">{seoLabel[s.c]}</span>
              <span className="nam-list__meta">
                {Math.max(0, s.described)} of {Math.max(0, s.total)} described · {Math.max(0, s.keyword)} with keyword
              </span>
            </li>
          ))}
        </ul>
        <p className="nam-insight__note">
          {seoHidden
            ? `${seoHidden} item(s) are hidden from Google on purpose. `
            : ''}
          Open any page, gallery or story → <strong>SEO</strong> to see its score and Google preview.
          {seoKeyword < seoTotal ? ` ${seoTotal - seoKeyword} still need a focus keyword.` : ''}
        </p>
      </Box>

      {owner ? (
        <Box
          title="Sign-in attempts"
          figure={nf(failed24)}
          sub={`failed sign-ins in the last 24 hours · ${nf(ok24)} successful`}
        >
          <BarChart bars={loginBars} unit="failed sign-ins" empty="No failed sign-ins in the last 14 days." />
          <p className="nam-insight__note">
            Accounts lock for 10 minutes after 5 wrong passwords.{' '}
            <a href="/admin/collections/login-events">See the sign-in log ›</a>
          </p>
        </Box>
      ) : null}

      {owner ? (
        <Box title="Site health & updates" figure={checks.every((c) => c.ok) ? 'All good' : 'Check'}>
          <ul className="nam-health">
            {checks.map((c) => (
              <li key={c.label}>
                <span className={`nam-seo__dot nam-seo__dot--${c.ok ? 'good' : 'ok'}`} aria-hidden="true" />
                <span className="nam-health__label">{c.label}</span>
                <span className="nam-health__note">{c.note}</span>
              </li>
            ))}
          </ul>
          <p className="nam-insight__note">
            Version {commit ?? 'local'} · running since {since}. Updates and security fixes are
            installed by Entraiot — nothing to click here, unlike WordPress.
          </p>
        </Box>
      ) : null}
    </div>
  )
}
