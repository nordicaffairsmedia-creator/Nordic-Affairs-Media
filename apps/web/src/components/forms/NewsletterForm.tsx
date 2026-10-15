'use client'

import { useActionState } from 'react'
import { subscribe, type NewsletterState } from '@/app/(frontend)/[locale]/newsletter/actions'

export type NewsletterLabels = {
  emailLabel: string
  newsletterCta: string
  newsletterConsent: string
  newsletterThanks: string
  messageError: string
  privacyPolicy: string
}

export function NewsletterForm({
  locale,
  privacyHref,
  labels,
}: {
  locale: string
  privacyHref: string
  labels: NewsletterLabels
}) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribe, {
    status: 'idle',
  })
  if (state.status === 'sent') {
    return (
      <p role="status" className="border-l-2 border-fjord pl-4 font-ui text-caption">
        {labels.newsletterThanks}
      </p>
    )
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <div className="flex">
        <label htmlFor="nl-email" className="sr-only">
          {labels.emailLabel}
        </label>
        <input
          id="nl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={labels.emailLabel}
          className="min-h-12 flex-1 border border-ink bg-snow px-3 font-ui text-body"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 bg-ink px-5 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep disabled:opacity-40"
        >
          {labels.newsletterCta}
        </button>
      </div>
      <label className="flex items-start gap-2 font-ui text-meta text-charcoal">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 size-4 accent-[var(--color-fjord)]"
        />
        <span>
          {labels.newsletterConsent}{' '}
          <a href={privacyHref} target="_blank" className="text-fjord underline">
            {labels.privacyPolicy}
          </a>
        </span>
      </label>
      {state.status === 'error' ? (
        <p role="alert" className="font-ui text-meta text-alert">
          {labels.messageError}
        </p>
      ) : null}
    </form>
  )
}
