'use client'

import { useRowLabel } from '@payloadcms/ui'

/** Title of each row in a recipient list: the person's name (and email) instead of "Contact 01". */
export function ContactRowLabel() {
  const { data, rowNumber } = useRowLabel<{ firstName?: string; lastName?: string; email?: string }>()
  const name = [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim()
  const email = data?.email?.trim()
  if (name && email) return <span>{name} · {email}</span>
  if (name || email) return <span>{name || email}</span>
  return <span>Contact {String((rowNumber ?? 0) + 1).padStart(2, '0')}</span>
}
