import { NavGroup } from '@payloadcms/ui'
import { hasRole } from '@/access/roles'

/*
 * Extra links at the bottom of the content manager's left menu, so everything lives in one
 * place like the old WordPress panel: the ticketing screens of the staff suite, the import /
 * translate tools and the website itself. Each person only sees what their role allows —
 * the owner sees all of it, an Admin manager sees ticketing, an Editor sees only the website.
 */

type Item = { href: string; label: string; icon: string; external?: boolean }

function Links({ items }: { items: Item[] }) {
  return (
    <>
      {items.map((i) => (
        <a
          key={i.href}
          id={`nav-x-${i.icon}`}
          href={i.href}
          className="nav__link"
          {...(i.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <span className="nav__link-label">
            {i.label}
            {i.external ? ' ↗' : ''}
          </span>
        </a>
      ))}
    </>
  )
}

export function NavExtras({ user }: { user?: unknown }) {
  const u = user as { roles?: unknown } | undefined
  const owner = hasRole(u)
  const organiser = hasRole(u, 'admin')

  const ticketing: Item[] = organiser
    ? [
        { href: '/staff', label: 'Sales overview', icon: 'sales' },
        ...(owner ? [{ href: '/staff/reports', label: 'Reports & payouts', icon: 'reports' }] : []),
        { href: '/staff/scan', label: 'Gate scanner', icon: 'scan' },
      ]
    : []
  const editor = hasRole(u, 'editor', 'admin')
  const upload: Item[] = editor ? [{ href: '/staff/upload', label: 'Fast upload (photos & videos)', icon: 'upload' }] : []
  const tools: Item[] = owner
    ? [
        { href: '/staff/import', label: 'Import from old website', icon: 'import' },
        { href: '/staff/translate', label: 'Translate content', icon: 'translate' },
        { href: '/staff/storage', label: 'Upload / storage check', icon: 'storage' },
      ]
    : []

  return (
    <>
      {ticketing.length ? (
        <NavGroup label="Ticketing tools">
          <Links items={ticketing} />
        </NavGroup>
      ) : null}
      {upload.length ? (
        <NavGroup label="Fast upload">
          <Links items={upload} />
        </NavGroup>
      ) : null}
      {tools.length ? (
        <NavGroup label="Tools">
          <Links items={tools} />
        </NavGroup>
      ) : null}
      <NavGroup label="Live site">
        <Links items={[{ href: '/en', label: 'View website', icon: 'site', external: true }]} />
      </NavGroup>
    </>
  )
}
