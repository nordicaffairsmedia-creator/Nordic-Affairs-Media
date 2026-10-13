import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { hasRole, roleLabels, topRole } from '@/access/roles'
import { logoutAction } from '@/app/(staff)/staff/actions'
import { StaffNav, type NavItem } from './StaffNav'

type User = { email?: string | null; roles?: unknown }

/** The person's own role only — other staff never see owner-level names or links. */
function roleName(user: User) {
  const r = topRole(user)
  return r ? roleLabels[r] : 'Staff'
}

/**
 * The staff software's frame, in a quiet product style: a frosted sidebar on a black
 * canvas, the screens this person may use, the account at the bottom, and a large page
 * title on the right. On phones the sidebar becomes a slim top bar.
 */
export function StaffShell({
  user,
  title,
  subtitle,
  actions,
  children,
}: {
  user: User
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const isOrganizer = hasRole(user, 'admin')
  const isOwner = hasRole(user)
  const items: NavItem[] = [
    ...(isOrganizer ? [{ href: '/staff', label: 'Events', icon: 'events' as const }] : []),
    { href: '/staff/scan', label: 'Gate scanner', icon: 'scan' },
    ...(isOwner
      ? [
          { href: '/staff/reports', label: 'Reports', icon: 'reports' as const },
          { href: '/staff/import', label: 'Import', icon: 'import' as const },
          { href: '/staff/translate', label: 'Translate', icon: 'translate' as const },
        ]
      : []),
    ...(isOrganizer ? [{ href: '/admin', label: 'Content manager', icon: 'cms' as const }] : []),
  ]
  const initials = (user.email ?? '?').slice(0, 1).toUpperCase()

  const logo = (
    <Link href="/staff" className="flex items-center gap-3 leading-none">
      <Image
        src="/brand/nam-logo-gold-480.png"
        alt="Nordic Affairs Media"
        width={480}
        height={327}
        unoptimized
        sizes="64px"
        className="h-8 w-auto"
      />
    </Link>
  )

  return (
    <div className="staff-ui min-h-dvh bg-black text-[#f5f5f7] lg:flex">
      {/* Sidebar (computer) */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0b0b0c]/80 backdrop-blur-2xl lg:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-8">
          {logo}
          <span className="h-5 w-px bg-white/10" aria-hidden="true" />
          <span className="text-[13px] font-medium text-[#a1a1a6]">Staff</span>
        </div>
        <nav aria-label="Staff" className="flex-1 overflow-y-auto px-3">
          <StaffNav items={items} />
        </nav>
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2c2c2e] text-[13px] font-semibold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[#f5f5f7]">{user.email}</p>
              <p className="text-[12px] text-[#86868b]">{roleName(user)}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex size-8 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Top bar (phone and tablet) */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/75 backdrop-blur-2xl lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {logo}
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="inline-flex size-9 items-center justify-center rounded-full bg-white/[0.06] text-[#a1a1a6]"
            >
              <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
        <nav aria-label="Staff" className="px-3 pb-3">
          <StaffNav items={items} compact />
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-5 py-10 sm:px-10 lg:px-14 lg:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="staff-rise flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.03em] text-[#f5f5f7] md:text-[44px]">
                {title}
              </h1>
              {subtitle ? <p className="mt-2 max-w-2xl text-[17px] leading-snug text-[#86868b]">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>
          <div className="staff-rise mt-10 [animation-delay:80ms]">{children}</div>
        </div>
      </main>
    </div>
  )
}

/** A key figure on a staff screen: small label, very large number. */
export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: boolean
}) {
  return (
    <div className="rounded-[20px] bg-[#141416] p-6 ring-1 ring-white/[0.06] transition-colors hover:bg-[#18181b]">
      <p className="text-[13px] font-medium text-[#86868b]">{label}</p>
      <p
        className={`mt-3 text-[34px] leading-none font-semibold tracking-[-0.035em] tabular-nums md:text-[40px] ${
          accent ? 'text-[#2997ff]' : 'text-[#f5f5f7]'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-3 text-[13px] text-[#86868b]">{hint}</p> : null}
    </div>
  )
}

/** The main action on a screen: a white pill, as on Apple and Tesla product pages. */
export const primaryPill =
  'inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f5f5f7] px-5 text-[14px] font-medium text-black transition-colors hover:bg-white'
/** A secondary action: a quiet grey pill. */
export const secondaryPill =
  'inline-flex min-h-9 items-center rounded-full bg-white/[0.08] px-4 text-[13px] font-medium text-[#f5f5f7] transition-colors hover:bg-white/[0.14]'

export function Notice({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null
  return (
    <p
      role="status"
      className={`mb-6 rounded-2xl px-4 py-3 text-[14px] ${
        err ? 'bg-[#ff453a]/12 text-[#ff8a80]' : 'bg-[#30d158]/12 text-[#7ee2a0]'
      }`}
    >
      {err ?? msg}
    </p>
  )
}
