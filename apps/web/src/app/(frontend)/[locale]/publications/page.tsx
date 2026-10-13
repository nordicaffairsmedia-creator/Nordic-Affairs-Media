import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPublicationYears, listPublications, pageParam, textParam } from '@/lib/listings'
import { buildMetadata } from '@/lib/seo'
import { href, routes } from '@/lib/site'
import { PublicationCard } from '@/components/editorial/PublicationCard'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return buildMetadata({
    locale,
    path: routes.publications(),
    title: getDictionary(locale).publications,
  })
}

/**
 * Digital magazine archive (master prompt §4, §32). The newest issue is shown large;
 * the rest sit on a "shelf" of covers, filterable by year.
 */
export default async function PublicationsPage({ params, searchParams }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const sp = await searchParams
  const page = pageParam(sp.page)
  const yearRaw = Number(textParam(sp.year, 4))
  const year = Number.isInteger(yearRaw) && yearRaw > 1900 ? yearRaw : null

  const [result, years] = await Promise.all([
    listPublications(locale, year, page),
    getPublicationYears(),
  ])
  const [first, ...rest] = result.docs
  const showFeature = page === 1 && !year && first
  const base = href(locale, routes.publications())

  const yearLink = (y: number | null, label: string) => {
    const active = y === year
    return (
      <li key={label}>
        <Link
          href={y ? `${base}?year=${y}` : base}
          aria-current={active ? 'page' : undefined}
          className={`inline-flex min-h-10 items-center border px-4 font-ui text-meta ${
            active ? 'border-ink bg-ink text-snow' : 'border-rule text-charcoal hover:border-ink'
          }`}
        >
          {label}
        </Link>
      </li>
    )
  }

  return (
    <div className="container-max pb-20">
      <PageHeader eyebrow="Nordic Affairs Media" title={t.publications}>
        {years.length > 1 ? (
          <ul className="mt-8 flex flex-wrap gap-2" aria-label={t.allYears}>
            {yearLink(null, t.allYears)}
            {years.map((y) => yearLink(y, String(y)))}
          </ul>
        ) : null}
      </PageHeader>

      {result.docs.length === 0 ? (
        <div className="mt-12">
          <EmptyState title={t.noPublications} body={t.emptyHomeBody} />
        </div>
      ) : (
        <>
          {showFeature ? (
            <div className="border-b border-rule py-12">
              <PublicationCard publication={showFeature} locale={locale} t={t} feature />
            </div>
          ) : null}
          <ul className="grid grid-cols-2 gap-x-6 gap-y-12 pt-12 sm:grid-cols-3 lg:grid-cols-5">
            {(showFeature ? rest : result.docs).map((p) => (
              <li key={p.id}>
                <PublicationCard publication={p} locale={locale} t={t} />
              </li>
            ))}
          </ul>
          <Pagination
            basePath={base}
            page={page}
            totalPages={result.totalPages}
            params={{ year: year ? String(year) : undefined }}
            t={t}
          />
        </>
      )}
    </div>
  )
}
