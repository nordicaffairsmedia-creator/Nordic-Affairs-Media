import Link from 'next/link'
import type { Locale } from '@/i18n/config'
import { href } from '@/lib/site'
import { SOCIALS, socialNames, socialUrl } from '@/lib/social'
import { SocialIcon } from './SocialIcon'

type CmsSocial = { platform?: string | null; url?: string | null }[] | null | undefined

const box =
  'inline-flex size-11 items-center justify-center border border-rule bg-snow text-ink transition-colors hover:border-brass hover:text-brass-text'

/** Instagram opens the profile in a new tab; channels not open yet go to our "Coming soon" page. */
export function SocialLinks({ locale, cms }: { locale: Locale; cms?: CmsSocial }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {SOCIALS.map((key) => {
        const url = socialUrl(key, cms)
        const name = socialNames[key]
        return (
          <li key={key}>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" aria-label={name} title={name} className={box}>
                <SocialIcon name={key} />
              </a>
            ) : (
              <Link href={href(locale, `/social/${key}`)} aria-label={name} title={name} className={box}>
                <SocialIcon name={key} />
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
