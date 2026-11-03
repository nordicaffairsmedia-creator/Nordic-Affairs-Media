'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  registerInterest,
  type InterestState,
} from '@/app/(frontend)/[locale]/events/[slug]/actions'
import { ShareLinks } from '@/components/editorial/ShareLinks'

export type InterestLabels = {
  title: string
  free: string
  disclaimer: string
  name: string
  email: string
  phone: string
  city: string
  category: string
  choose: string
  consent: string
  privacyPolicy: string
  cta: string
  processing: string
  thanks: string
  error: string
  shareEvent: string
}

export type InterestOption = { value: string; text: string }

const field = 'mt-1 min-h-12 w-full border border-ink bg-snow px-3 font-ui text-body'
const label = 'block font-ui text-caption font-semibold'

/** "Register My Interest" form, shown on an event page while the event is "Announced". */
export function InterestForm({
  eventId,
  locale,
  privacyHref,
  pageUrl,
  eventTitle,
  options,
  labels,
}: {
  eventId: string
  locale: string
  privacyHref: string
  pageUrl: string
  eventTitle: string
  options: InterestOption[]
  labels: InterestLabels
}) {
  const [state, action, pending] = useActionState<InterestState, FormData>(registerInterest, {
    status: 'idle',
  })

  if (state.status === 'sent') {
    return (
      <div data-testid="interest-thanks" role="status" className="mt-4 space-y-4">
        <p className="border-l-2 border-fjord pl-4 font-ui text-body">{labels.thanks}</p>
        <ShareLinks url={pageUrl} title={eventTitle} label={labels.shareEvent} />
      </div>
    )
  }

  return (
    <form action={action} data-testid="interest-form" className="mt-4 space-y-4">
      <h3 className="text-h3">{labels.title}</h3>
      <p className="font-ui text-caption font-semibold text-fjord">{labels.free}</p>
      <p className="font-ui text-caption text-charcoal">{labels.disclaimer}</p>

      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="locale" value={locale} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div>
        <label htmlFor="int-name" className={label}>
          {labels.name}
        </label>
        <input id="int-name" name="name" required minLength={2} maxLength={120} autoComplete="name" className={field} />
      </div>
      <div>
        <label htmlFor="int-email" className={label}>
          {labels.email}
        </label>
        <input id="int-email" name="email" type="email" required maxLength={200} autoComplete="email" className={field} />
      </div>
      <div>
        <label htmlFor="int-phone" className={label}>
          {labels.phone}
        </label>
        <input
          id="int-phone"
          name="phone"
          type="tel"
          required
          pattern="[+()\d\s\-]{6,25}"
          autoComplete="tel"
          className={field}
        />
      </div>
      <div>
        <label htmlFor="int-city" className={label}>
          {labels.city}
        </label>
        <input id="int-city" name="city" required minLength={2} maxLength={120} autoComplete="address-level2" className={field} />
      </div>
      <div>
        <label htmlFor="int-category" className={label}>
          {labels.category}
        </label>
        <select id="int-category" name="category" required defaultValue="" className={field}>
          <option value="" disabled>
            {labels.choose}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.text}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-2 font-ui text-meta text-charcoal">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-[var(--color-fjord)]" />
        <span>
          {labels.consent}{' '}
          <a href={privacyHref} target="_blank" className="text-fjord underline">
            {labels.privacyPolicy}
          </a>
        </span>
      </label>

      {state.status === 'error' ? (
        <p role="alert" className="font-ui text-meta text-alert">
          {labels.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="interest-submit"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-fjord px-6 font-ui text-caption font-semibold text-snow hover:bg-fjord-deep disabled:opacity-40"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? labels.processing : labels.cta}
      </button>
    </form>
  )
}
