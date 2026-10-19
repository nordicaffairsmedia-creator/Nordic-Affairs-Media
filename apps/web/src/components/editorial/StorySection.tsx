import type { Article } from '@/payload-types'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { SectionHeading } from '@/components/ui/primitives'
import { StoryCard } from './StoryCard'

export type SectionLayout = 'leadWithList' | 'threeUp' | 'horizontal'

type Props = {
  heading: string
  moreHref?: string
  moreLabel?: string
  layout: SectionLayout
  stories: Article[]
  locale: Locale
  t: Dictionary
}

/** A category row on the front page. Editors pick the layout per section in the CMS. */
export function StorySection({ heading, moreHref, moreLabel, layout, stories, locale, t }: Props) {
  const [first, ...rest] = stories
  if (!first) return null

  return (
    <section aria-label={heading} className="container-max py-10 md:py-14">
      <SectionHeading title={heading} href={moreHref} linkLabel={moreLabel} />

      {layout === 'leadWithList' ? (
        <div className="grid gap-8 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-7">
            <StoryCard article={first} locale={locale} t={t} variant="feature" />
          </div>
          <ul className="divide-y divide-rule md:col-span-5">
            {rest.map((a) => (
              <li key={a.id} className="py-5 first:pt-0">
                <StoryCard article={a} locale={locale} t={t} variant="text" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {layout === 'threeUp' ? (
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {stories.slice(0, 6).map((a) => (
            <StoryCard key={a.id} article={a} locale={locale} t={t} variant="standard" />
          ))}
        </div>
      ) : null}

      {layout === 'horizontal' ? (
        <ul className="grid gap-8 lg:grid-cols-2 lg:gap-x-12">
          {stories.map((a) => (
            <li key={a.id} className="border-t border-rule pt-6">
              <StoryCard article={a} locale={locale} t={t} variant="horizontal" />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
