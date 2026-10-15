'use client'

import { useActionState, useState } from 'react'
import { sendEnquiry, type ContactState } from '@/app/(frontend)/[locale]/contact/actions'

export type ContactLabels = {
  enquiryType: string
  types: { value: string; label: string }[]
  fullName: string
  emailLabel: string
  subject: string
  message: string
  privacyConsent: string
  privacyPolicy: string
  sendMessage: string
  messageSent: string
  messageError: string
  processing: string
}

export function ContactForm({
  locale,
  privacyHref,
  labels,
}: {
  locale: string
  privacyHref: string
  labels: ContactLabels
}) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendEnquiry, {
    status: 'idle',
  })
  const [startedAt] = useState(() => Date.now())
  const input =
    'min-h-12 w-full border border-rule bg-snow px-3 font-ui text-body focus-visible:border-fjord'

  if (state.status === 'sent') {
    return (
      <p role="status" className="border-l-2 border-fjord bg-snow p-5 font-display text-h3">
        {labels.messageSent}
      </p>
    )
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Honeypot: hidden from people and screen readers, tempting for bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <label className="block">
        <span className="meta mb-1 block">{labels.enquiryType}</span>
        <select name="type" required defaultValue="general" className={input}>
          {labels.types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="meta mb-1 block">{labels.fullName}</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            className={input}
          />
        </label>
        <label className="block">
          <span className="meta mb-1 block">{labels.emailLabel}</span>
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
            className={input}
          />
        </label>
      </div>
      <label className="block">
        <span className="meta mb-1 block">{labels.subject}</span>
        <input name="subject" required minLength={3} maxLength={150} className={input} />
      </label>
      <label className="block">
        <span className="meta mb-1 block">{labels.message}</span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={7}
          className={`${input} py-3`}
        />
      </label>
      <label className="flex items-start gap-3 font-ui text-caption">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 size-5 accent-[var(--color-fjord)]"
        />
        <span>
          {labels.privacyConsent}{' '}
          <a href={privacyHref} target="_blank" className="text-fjord underline">
            {labels.privacyPolicy}
          </a>
        </span>
      </label>
      {state.status === 'error' ? (
        <p role="alert" className="font-ui text-caption text-alert">
          {labels.messageError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 bg-ink px-6 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep disabled:opacity-40"
      >
        {pending ? labels.processing : labels.sendMessage}
      </button>
    </form>
  )
}
