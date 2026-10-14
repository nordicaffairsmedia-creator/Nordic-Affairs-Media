import { redirect } from 'next/navigation'

type SP = Record<string, string | string[] | undefined>

/** Old My Booking address: everything now lives under Concerts & Events. */
export default async function Legacy({
  params,
  searchParams,
}: {
  params: Promise<Record<string, string>>
  searchParams: Promise<SP>
}) {
  const { locale } = await params
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === 'string') q.set(k, v)
  }
  const qs = q.toString()
  redirect(`/${locale}/events${qs ? `?${qs}` : ''}`)
}
