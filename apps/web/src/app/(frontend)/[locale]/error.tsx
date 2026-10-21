'use client'

import { useEffect } from 'react'

/** Friendly page if a page fails to load (e.g. the database is busy for a moment). Visitors can retry. */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <section className="container-wide py-20 md:py-32">
      <h1 className="text-h1">Something went wrong for a moment</h1>
      <p className="mt-6 max-w-xl font-text text-deck">
        The page could not load. Please try again in a few seconds.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 inline-flex min-h-11 items-center bg-ink px-5 font-ui text-caption font-semibold text-snow"
      >
        Try again
      </button>
    </section>
  )
}
