'use client'

import { useEffect, type ReactNode } from 'react'

const EYE =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
const EYE_OFF =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.6 9.6 0 0 1 12 4c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/></svg>'

/** Adds a show/hide eye button to one password field (once). */
function enhance(input: HTMLInputElement) {
  if (input.dataset.reveal) return
  input.dataset.reveal = '1'
  const holder = input.parentElement
  if (!holder) return
  if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative'
  input.style.paddingRight = '44px'

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.innerHTML = EYE
  btn.setAttribute('aria-label', 'Show password')
  btn.setAttribute('aria-pressed', 'false')
  Object.assign(btn.style, {
    position: 'absolute',
    right: '6px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '0',
    color: 'var(--theme-elevation-500, #888)',
    cursor: 'pointer',
    zIndex: '2',
  })
  btn.addEventListener('click', () => {
    const show = input.type === 'password'
    input.type = show ? 'text' : 'password'
    btn.innerHTML = show ? EYE_OFF : EYE
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password')
    btn.setAttribute('aria-pressed', String(show))
    input.focus()
  })
  holder.appendChild(btn)
}

/**
 * Content-manager wrapper (registered in payload.config `admin.components.providers`):
 * every password field — sign-in, first account, change password, new user — gets an
 * eye button to show or hide what was typed.
 */
export function PasswordReveal({ children }: { children?: ReactNode }) {
  useEffect(() => {
    const scan = () =>
      document
        .querySelectorAll<HTMLInputElement>('input[type="password"]:not([data-reveal])')
        .forEach(enhance)
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return <>{children}</>
}
