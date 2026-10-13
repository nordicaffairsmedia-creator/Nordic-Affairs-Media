import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getSiteChrome } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
import { INSTAGRAM_URL, isSocialKey, socialNames, socialUrl } from '@/lib/social'
import { SocialIcon } from '@/components/layout/SocialIcon'
import { ButtonLink } from '@/components/ui/primitives'

type Props = { params: Promise<{ locale: string; platform: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, platform } = await params
  if (!isLocale(locale) || !isSocialKey(platform)) return {}
  const t = getDictionary(locale)
  return buildMetadata({
    locale,
    path: `/social/${platform}`,
    title: `${socialNames[platform]} — ${t.comingSoon}`,
    noIndex: true,
  })
}

/** Where X, Facebook and YouTube point until the agency opens those channels. */
export default async function ComingSoonPage({ params }: Props) {
  const { locale, platform } = await params
  if (!isLocale(locale) || !isSocialKey(platform)) notFound()
  const { navigation } = await getSiteChrome(locale)
  const live = socialUrl(platform, navigation.social)
  if (live) redirect(live) // the channel has opened since this link was shown
  const t = getDictionary(locale)

  return (
    <section className="container-wide py-20 md:py-32">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto inline-flex size-20 items-center justify-center border border-brass text-brass-text">
          <SocialIcon name={platform} className="size-9" />
        </span>
        <p className="eyebrow mt-8 text-brass-text">{socialNames[platform]}</p>
        <h1 className="mt-3 text-h1 md:text-display">{t.comingSoon}</h1>
        <p className="mt-6 font-text text-deck text-charcoal">{t.comingSoonBody}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-brass px-5 font-ui text-caption font-semibold text-brass-text hover:bg-brass hover:text-navy-deep"
          >
            <SocialIcon name="instagram" className="size-4" />
            {t.followInstagram}
          </a>
          <ButtonLink href={href(locale, '/')} variant="outline">
            {t.backHome}
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
