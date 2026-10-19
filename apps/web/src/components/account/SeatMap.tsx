'use client'

export type SeatingSection = {
  code: string
  name: string
  tierId: string | null
  tierName: string
  price: number // minor units
  aisleAfter: number[]
  rows: { label: string; seats: { n: number; id: string; s: 0 | 1 | 2 }[] }[]
}
export type Seating = { stageLabel: string; sections: SeatingSection[] }

export type SeatMapLabels = {
  title: string
  hint: string
  free: string
  selected: string
  taken: string
  yourSeats: string
  none: string
  row: string
  seat: string
  max: string
}

/**
 * The seat picker. Every seat is a button; taken seats are disabled. Which seats are free comes
 * from the booking server, and the server re-checks every seat again when the buyer continues.
 */
export function SeatMap(props: {
  seating: Seating
  selected: string[]
  onToggle: (id: string) => void
  max: number
  format: (minor: number) => string
  disabled?: boolean
  labels: SeatMapLabels
}) {
  const { seating, selected, onToggle, max, format, labels: l } = props
  const chosen = new Set(selected)
  const full = selected.length >= max
  const byId = new Map<string, { sec: SeatingSection; row: string; n: number }>()
  for (const sec of seating.sections)
    for (const r of sec.rows) for (const s of r.seats) byId.set(s.id, { sec, row: r.label, n: s.n })

  return (
    <div data-testid="seat-map">
      <h2 className="font-display text-h3">{l.title}</h2>
      <p className="meta mt-1">{l.hint}</p>
      <p className="meta mt-1">{l.max.replace('{n}', String(max))}</p>

      <ul className="mt-4 flex flex-wrap gap-4 font-ui text-meta" aria-hidden="true">
        <li className="flex items-center gap-2">
          <span className="size-4 border border-fjord bg-snow" /> {l.free}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-4 bg-fjord" /> {l.selected}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-4 bg-rule" /> {l.taken}
        </li>
      </ul>

      <div className="mt-5 overflow-x-auto border border-rule bg-snow p-4">
        <div className="mx-auto w-max min-w-full">
          <div className="mx-auto mb-6 w-3/4 max-w-xl border-b-4 border-ink pb-1 text-center font-ui text-caption font-semibold uppercase tracking-widest text-slate">
            {seating.stageLabel}
          </div>
          <div className="space-y-8">
            {seating.sections.map((sec) => (
              <section key={sec.code} aria-label={sec.name} className="flex flex-col items-center">
                <p className="mb-2 font-ui text-caption font-semibold">
                  {sec.name}
                  {sec.tierId ? (
                    <span className="meta ml-2 font-normal">
                      {sec.tierName && sec.tierName !== sec.name ? `${sec.tierName} · ` : ''}
                      {format(sec.price)}
                    </span>
                  ) : null}
                </p>
                <div className="space-y-1">
                  {sec.rows.map((row) => (
                    <div key={row.label} className="flex items-center gap-1">
                      <span className="w-6 shrink-0 text-center font-ui text-meta text-slate" aria-hidden="true">
                        {row.label}
                      </span>
                      {row.seats.map((s) => {
                        const gap = sec.aisleAfter.includes(s.n) ? 'mr-4' : ''
                        if (s.s === 2) return <span key={s.id} className={`size-7 shrink-0 ${gap}`} aria-hidden="true" />
                        const on = chosen.has(s.id)
                        const taken = s.s === 1
                        const blocked = taken || (!on && full) || props.disabled
                        return (
                          <button
                            key={s.id}
                            type="button"
                            data-testid={`seat-${s.id}`}
                            data-state={taken ? 'taken' : on ? 'selected' : 'free'}
                            aria-pressed={on}
                            aria-label={`${sec.name}, ${l.row} ${row.label}, ${l.seat} ${s.n}${sec.price ? `, ${format(sec.price)}` : ''}${taken ? `, ${l.taken}` : ''}`}
                            disabled={blocked}
                            onClick={() => onToggle(s.id)}
                            className={`size-7 shrink-0 text-[10px] font-semibold leading-none ${gap} ${
                              on
                                ? 'bg-fjord text-snow'
                                : taken
                                  ? 'cursor-not-allowed bg-rule text-slate/50'
                                  : 'border border-fjord bg-snow text-ink hover:bg-fjord/20 disabled:opacity-40'
                            }`}
                          >
                            {s.n}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 border border-rule bg-snow p-4" data-testid="seat-selection">
        <p className="font-ui text-caption font-semibold">{l.yourSeats}</p>
        {selected.length === 0 ? (
          <p className="meta mt-1">{l.none}</p>
        ) : (
          <ul className="mt-2 grid gap-1 font-ui text-caption">
            {selected.map((id) => {
              const x = byId.get(id)
              return x ? (
                <li key={id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {x.sec.name} · {l.row} {x.row} · {l.seat} {x.n}
                  </span>
                  <span className="flex items-center gap-3">
                    <span>{x.sec.price ? format(x.sec.price) : ''}</span>
                    <button type="button" onClick={() => onToggle(id)} className="text-fjord underline" aria-label={`${l.selected}: ${x.sec.name} ${x.row}${x.n} ×`}>
                      ×
                    </button>
                  </span>
                </li>
              ) : null
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
