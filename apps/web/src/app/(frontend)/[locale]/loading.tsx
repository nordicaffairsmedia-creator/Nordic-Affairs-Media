/** Shown the instant any tab is clicked while its page is prepared, so every click responds at once. */
export default function Loading() {
  return (
    <div className="container-max pb-20 pt-10" role="status" aria-busy="true">
      <div className="h-10 w-64 animate-pulse bg-snow/10" />
      <div className="mt-8 h-6 w-96 max-w-full animate-pulse bg-snow/10" />
      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="aspect-[4/5] animate-pulse bg-snow/10" />
            <div className="mt-4 h-5 w-3/4 animate-pulse bg-snow/10" />
            <div className="mt-2 h-4 w-1/2 animate-pulse bg-snow/10" />
          </div>
        ))}
      </div>
    </div>
  )
}
