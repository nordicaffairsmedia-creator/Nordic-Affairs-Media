'use client'

/** Last-resort page for errors in the root layout. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', padding: '4rem 1.5rem' }}>
        <h1>Something went wrong for a moment</h1>
        <p>Please try again in a few seconds.</p>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  )
}
