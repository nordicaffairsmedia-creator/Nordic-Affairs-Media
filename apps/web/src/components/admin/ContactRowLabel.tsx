'use client'

import { useRowLabel } from '@payloadcms/ui'

/** Title of each row in a recipient list: only the person's name (their email if no name is typed yet) instead of "Contact 01". */
export function ContactRowLabel() {
  const { data, rowNumber } = useRowLabel<{ firstName?: string; lastName?: string; email?: string }>()
  const name = [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim()
  const email = data?.email?.trim()
  if (name) return <span>{name}</span>
  if (email) return <span>{email}</span>
  return <span>Contact {String((rowNumber ?? 0) + 1).padStart(2, '0')}</span>
}
