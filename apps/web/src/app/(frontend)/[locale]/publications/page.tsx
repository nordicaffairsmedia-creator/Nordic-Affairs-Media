import { notFound, permanentRedirect } from 'next/navigation'
import { isLocale } from '@/i18n/config'

/** The list of issues now lives on the Articles page (section "Publications"). */
export default async function PublicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  permanentRedirect(`/${locale}/articles#publications`)
}
