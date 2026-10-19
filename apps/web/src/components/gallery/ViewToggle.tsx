'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { LayoutGrid, List } from 'lucide-react'

export type ViewMode = 'grid' | 'list'
const KEY = 'nam-gallery-view'

/** Grid or list, remembered in this browser (grid until the visitor picks list). */
export function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>('grid')
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'list') setView('list')
    } catch {
      /* storage blocked — stay on grid */
    }
  }, [])
  const choose = (v: ViewMode) => {
    setView(v)
    try {
      localStorage.setItem(KEY, v)
    } catch {
      /* not remembered, still switches */
    }
  }
  return [view, choose]
}

export type ViewLabels = { label: string; grid: string; list: string }

export function ViewToggle({
  view,
  onChange,
  labels,
}: {
  view: ViewMode
  onChange: (v: ViewMode) => void
  labels: ViewLabels
}) {
  const btn = (active: boolean) =>
    `inline-flex min-h-10 items-center gap-2 px-3.5 font-ui text-caption font-semibold transition-colors ${
      active ? 'bg-ink text-snow' : 'text-charcoal hover:text-ink'
    }`
  return (
    <div role="group" aria-label={labels.label} className="inline-flex border border-rule">
      <button type="button" aria-pressed={view === 'grid'} onClick={() => onChange('grid')} className={btn(view === 'grid')}>
        <LayoutGrid aria-hidden="true" className="size-4" />
        {labels.grid}
      </button>
      <button type="button" aria-pressed={view === 'list'} onClick={() => onChange('list')} className={btn(view === 'list')}>
        <List aria-hidden="true" className="size-4" />
        {labels.list}
      </button>
    </div>
  )
}

/**
 * Wraps two server-rendered layouts and shows one: children style themselves with
 * `group-data-[view=list]/view:` so no data has to cross into the browser.
 */
export function ViewSwitch({ labels, children }: { labels: ViewLabels; children: ReactNode }) {
  const [view, setView] = useViewMode()
  return (
    <div>
      <div className="mt-8 flex justify-end">
        <ViewToggle view={view} onChange={setView} labels={labels} />
      </div>
      <div data-view={view} className="group/view">
        {children}
      </div>
    </div>
  )
}
