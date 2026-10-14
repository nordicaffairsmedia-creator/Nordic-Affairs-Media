import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { href } from '@/lib/site'
import { newsletterEnabled } from '@/app/(frontend)/[locale]/newsletter/actions'
import { NewsletterForm } from '@/components/forms/NewsletterForm'

/**
 * Newsletter band (PRD W-13). Sign-ups are kept in the CMS (Inbox → Subscribers) with
 * double opt-in. The form only appears once the owner switches "Newsletter" on in
 * Platform settings; until then an honest "opens soon" line is shown.
 */
export async function NewsletterPanel({ t, locale }: { t: Dictionary; locale: Locale }) {
  const enabled = await newsletterEnabled().catch(() => false)
  return (
    <section aria-label={t.newsletterTitle} className="border-t border-rule bg-fjord-wash">
      <div className="container-wide grid gap-6 py-14 md:grid-cols-12 md:items-end">
        <div className="md:col-span-6">
          <span className="block h-px w-12 bg-brass" aria-hidden="true" />
          <h2 className="mt-5 text-h2">{t.newsletterTitle}</h2>
          <p className="mt-3 max-w-lg text-charcoal">{t.newsletterBody}</p>
        </div>
        <div className="md:col-span-6">
          {enabled ? (
            <NewsletterForm
              locale={locale}
              privacyHref={href(locale, '/privacy')}
              labels={{
                emailLabel: t.emailLabel,
                newsletterCta: t.newsletterCta,
                newsletterConsent: t.newsletterConsent,
                newsletterThanks: t.newsletterThanks,
                messageError: t.messageError,
                privacyPolicy: t.privacyPolicy,
              }}
            />
          ) : (
            <p className="meta border-l-2 border-fjord pl-4">{t.newsletterUnavailable}</p>
          )}
        </div>
      </div>
    </section>
  )
}
