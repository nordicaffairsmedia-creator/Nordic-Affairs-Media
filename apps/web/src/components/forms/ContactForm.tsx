'use client'

import { useActionState, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
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

  const inputClasses =
    'w-full rounded-xl border border-rule bg-paper/90 px-4 py-3 text-[14px] text-ink placeholder-slate/50 transition-all duration-200 focus:border-fjord focus:bg-paper focus:outline-none focus:ring-1 focus:ring-fjord/50'

  if (state.status === 'sent') {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-500/40 bg-snow/60 p-8 backdrop-blur-md shadow-lg"
      >
        <div className="flex items-start gap-3.5">
          <span className="text-2xl">✅</span>
          <div>
            <h3 className="font-serif text-2xl font-bold text-ink">Message Sent</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate">{labels.messageSent}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-rule/80 bg-snow/35 p-6 sm:p-8 backdrop-blur-md shadow-lg">
      <form action={action} className="space-y-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="startedAt" value={startedAt} />

        {/* Honeypot field */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        {/* Enquiry Type Selector */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate">
            <span>📋</span>
            <span>{labels.enquiryType}</span>
          </label>
          <div className="relative">
            <select
              name="type"
              required
              defaultValue="general"
              className={`${inputClasses} cursor-pointer appearance-none pr-10`}
            >
              {labels.types.map((t) => (
                <option key={t.value} value={t.value} className="bg-paper text-ink">
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate" />
          </div>
        </div>

        {/* Full Name & Email Fields */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate">
              <span>👤</span>
              <span>{labels.fullName}</span>
            </label>
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              placeholder="e.g. Henrik Lindqvist"
              className={inputClasses}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate">
              <span>📧</span>
              <span>{labels.emailLabel}</span>
            </label>
            <input
              name="email"
              type="email"
              required
              maxLength={200}
              autoComplete="email"
              placeholder="name@organization.com"
              className={inputClasses}
            />
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate">
            <span>📝</span>
            <span>{labels.subject}</span>
          </label>
          <input
            name="subject"
            required
            minLength={3}
            maxLength={150}
            placeholder="Subject of your message"
            className={inputClasses}
          />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate">
            <span>💬</span>
            <span>{labels.message}</span>
          </label>
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            placeholder="Please detail your request or enquiry..."
            className={`${inputClasses} py-3.5 resize-y leading-relaxed`}
          />
        </div>

        {/* Privacy Consent Checkbox */}
        <div className="rounded-xl border border-rule/60 bg-paper/40 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-xs text-slate">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-0.5 size-4 rounded border-rule bg-paper accent-fjord transition-colors focus:ring-1 focus:ring-fjord"
            />
            <span className="leading-relaxed">
              {labels.privacyConsent}{' '}
              <a
                href={privacyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fjord underline underline-offset-2 hover:text-ink transition-colors"
              >
                {labels.privacyPolicy}
              </a>
            </span>
          </label>
        </div>

        {/* Error Alert */}
        {state.status === 'error' && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-alert/30 bg-alert/10 p-4 text-xs font-medium text-alert"
          >
            <span>⚠️</span>
            <span>{labels.messageError}</span>
          </div>
        )}

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl bg-fjord-deep px-8 py-3 text-xs font-bold uppercase tracking-[0.08em] text-white shadow transition-all duration-150 hover:bg-fjord hover:text-navy-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{labels.processing}</span>
              </>
            ) : (
              <>
                <span>📨</span>
                <span>{labels.sendMessage}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
