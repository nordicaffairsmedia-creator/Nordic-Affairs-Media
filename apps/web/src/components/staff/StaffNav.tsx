'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, CalendarDays, DownloadCloud, Languages, LayoutDashboard, ScanLine } from 'lucide-react'

export type NavItem = { href: string; label: string; icon: 'events' | 'scan' | 'reports' | 'import' | 'translate' | 'cms' }

const ICONS = {
  events: CalendarDays,
  scan: ScanLine,
  reports: BarChart3,
  import: DownloadCloud,
  translate: Languages,
  cms: LayoutDashboard,
}

/** Side navigation of the staff software; the current screen sits on a soft grey pill. */
export function StaffNav({ items, compact = false }: { items: NavItem[]; compact?: boolean }) {
  const path = usePathname() || ''
  return (
    <ul className={compact ? 'flex gap-1 overflow-x-auto' : 'space-y-0.5'}>
      {items.map((item) => {
        const Icon = ICONS[item.icon]
        const active =
          item.href === '/staff'
            ? path === '/staff' || path.startsWith('/staff/events')
            : path.startsWith(item.href)
        const external = item.href.startsWith('/admin')
        const cls = `group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] whitespace-nowrap transition-colors ${
          active ? 'bg-white/[0.1] font-medium text-white' : 'text-[#a1a1a6] hover:bg-white/[0.05] hover:text-white'
        }`
        const inner = (
          <>
            <Icon
              aria-hidden="true"
              className={`size-[18px] shrink-0 ${active ? 'text-[#2997ff]' : 'text-[#86868b] group-hover:text-white'}`}
              strokeWidth={1.75}
            />
            {item.label}
          </>
        )
        return (
          <li key={item.href}>
            {external ? (
              <a href={item.href} className={cls}>
                {inner}
              </a>
            ) : (
              <Link href={item.href} className={cls} aria-current={active ? 'page' : undefined}>
                {inner}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
