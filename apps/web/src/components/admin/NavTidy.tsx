'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/*
 * Keeps the left menu tidy, like an accordion: only one section is open at a time.
 *  · On every page, the section holding that page is open and all others are folded.
 *  · Opening another section (e.g. Inbox) folds the one that was open (e.g. Ticketing).
 */

function isOpen(group: HTMLElement) {
  const content = group.querySelector<HTMLElement>('.nav-group__content')
  if (!content) return false
  // Folded sections sit in a zero-height wrapper: check every box between links and section.
  for (let el: HTMLElement | null = content; el && el !== group; el = el.parentElement) {
    if (el.getBoundingClientRect().height < 2) return false
  }
  return true
}
export function NavTidy() {
  const path = usePathname()
  useEffect(() => {
    const t = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.nav-group').forEach((group) => {
        const toggle = group.querySelector<HTMLButtonElement>('.nav-group__toggle')
        if (!toggle) return
        const open = isOpen(group)
        const here = Array.from(group.querySelectorAll<HTMLElement>('.nav__link')).some((a) => {
          if (a.querySelector('.nav__link-indicator')) return true
          const href = a.getAttribute('href')
          return Boolean(href && href !== '/admin' && path?.startsWith(href.split('?')[0]!))
        })
        if (open !== here) toggle.click()
      })
    }, 150)
    return () => window.clearTimeout(t)
  }, [path])

  // Accordion: when someone opens a section by hand, fold every other open section.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!e.isTrusted) return
      const toggle = (e.target as HTMLElement | null)?.closest<HTMLElement>('.nav-group__toggle')
      const group = toggle?.closest<HTMLElement>('.nav-group')
      if (!group) return
      window.setTimeout(() => {
        if (!isOpen(group)) return
        document.querySelectorAll<HTMLElement>('.nav-group').forEach((other) => {
          if (other !== group && isOpen(other)) other.querySelector<HTMLButtonElement>('.nav-group__toggle')?.click()
        })
      }, 250)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])
  return null
}
