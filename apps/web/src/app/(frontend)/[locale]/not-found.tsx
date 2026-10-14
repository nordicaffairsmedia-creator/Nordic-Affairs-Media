import Link from 'next/link'
import { getDictionary } from '@/i18n/getDictionary'
import { defaultLocale } from '@/i18n/config'
import { href, routes } from '@/lib/site'
import { ButtonLink } from '@/components/ui/primitives'

/**
 * Editorial 404 (master prompt §47). Not-found pages don't receive route params,
 * so the copy is English; links point to the English site.
 */
export default function NotFound() {
  const locale = defaultLocale
  const t = getDictionary(locale)
  return (
    <section className="container-wide py-20 md:py-32">
      <div className="max-w-3xl">
        <p className="eyebrow text-brass-text">404</p>
        <h1 className="mt-4 text-h1 md:text-display">{t.notFoundTitle}</h1>
        <p className="mt-6 max-w-xl font-text text-deck text-charcoal">{t.notFoundBody}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href={href(locale, '/')}>{t.backHome}</ButtonLink>
          <ButtonLink href={href(locale, routes.search())} variant="outline">
            {t.search}
          </ButtonLink>
        </div>
        <ul className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-6">
          <li>
            <Link
              href={href(locale, routes.publications())}
              className="meta font-semibold text-fjord hover:underline"
            >
              {t.publications}
            </Link>
          </li>
          <li>
            <Link
              href={href(locale, routes.events())}
              className="meta font-semibold text-fjord hover:underline"
            >
              {t.upcomingEvents}
            </Link>
          </li>
        </ul>
      </div>
    </section>
  )
}
