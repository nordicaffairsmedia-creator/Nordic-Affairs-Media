'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import jsQR from 'jsqr'
import { checkInAction, countsAction, searchTicketsAction } from '@/app/(staff)/staff/actions'
import type { CheckinResult } from '@/lib/staffTypes'

const MESSAGES: Record<CheckinResult['result'], { title: string; tone: 'ok' | 'warn' | 'bad' }> = {
  ok: { title: 'TICKET APPROVED', tone: 'ok' },
  already: { title: 'Already checked in', tone: 'warn' },
  cancelled: { title: 'Ticket cancelled', tone: 'bad' },
  wrong_event: { title: 'Ticket is for another event', tone: 'bad' },
  not_found: { title: 'Ticket not recognised', tone: 'bad' },
  error: { title: 'Could not check — try again', tone: 'bad' },
}
const toneCls = { ok: 'bg-[#1e7a46]', warn: 'bg-[#b7791f]', bad: 'bg-alert' }
const RESULT_SHOW_MS = 2200

type Approved = { code: string; holder: string; tier: string; order: string; at: string; demo: boolean }
type Found = { code: string; holder: string; tier: string; order: string; status: string }

/**
 * Camera QR scanner for the door. Reads codes with the phone camera (jsQR, works on
 * iPhone and Android browsers), asks the server, then shows green / amber / red full
 * screen for ~2 seconds. A search box covers guests who only have a name or order number.
 */
export function Scanner({ eventId }: { eventId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const busyRef = useRef(false)
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const [camera, setCamera] = useState<'starting' | 'on' | 'denied' | 'unsupported'>('starting')
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [counts, setCounts] = useState<{ sold: number; checkedIn: number } | null>(null)
  const [found, setFound] = useState<Found[]>([])
  const [approved, setApproved] = useState<Approved[]>([])

  const refreshCounts = useCallback(() => {
    countsAction(eventId)
      .then(setCounts)
      .catch(() => undefined)
  }, [eventId])

  const check = useCallback(
    async (code: string) => {
      if (busyRef.current) return
      busyRef.current = true
      const r = await checkInAction(eventId, code).catch((): CheckinResult => ({ result: 'error' }))
      setResult(r)
      if ('vibrate' in navigator) navigator.vibrate(r.result === 'ok' ? 80 : [80, 60, 80])
      if (r.result === 'ok') {
        refreshCounts()
        setApproved((list) =>
          [
            {
              code: r.code ?? code,
              holder: r.holder ?? '',
              tier: r.tier ?? '',
              order: r.order ?? '',
              at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              demo: Boolean(r.demo),
            },
            ...list,
          ].slice(0, 8),
        )
      }
      window.setTimeout(() => {
        setResult(null)
        busyRef.current = false
      }, RESULT_SHOW_MS)
    },
    [eventId, refreshCounts],
  )

  // Live checked-in counter (PRD G-04): on load and every 15 seconds.
  useEffect(() => {
    refreshCounts()
    const t = window.setInterval(refreshCounts, 15_000)
    return () => window.clearInterval(t)
  }, [refreshCounts])

  // Camera + decode loop. Effects are the right tool here: this talks to the device.
  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        await video.play().catch(() => undefined)
        setCamera('on')
        let lastScan = 0
        const tick = (now: number) => {
          raf = requestAnimationFrame(tick)
          if (busyRef.current || now - lastScan < 200) return
          lastScan = now
          const canvas = canvasRef.current
          if (!canvas || video.readyState < 2) return
          const w = 480
          const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) return
          ctx.drawImage(video, 0, 0, w, h)
          const img = ctx.getImageData(0, 0, w, h)
          const qr = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
          if (!qr?.data) return
          // Ignore the same code held in front of the camera again within 4 seconds.
          if (qr.data === lastRef.current.code && Date.now() - lastRef.current.at < 4000) return
          lastRef.current = { code: qr.data, at: Date.now() }
          void check(qr.data)
        }
        raf = requestAnimationFrame(tick)
      })
      .catch(() => setCamera('denied'))
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [check])

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    if (q.length < 2) return
    setFound(await searchTicketsAction(eventId, q).catch(() => []))
  }

  const msg = result ? MESSAGES[result.result] : null

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative mx-4 aspect-square max-h-[60vh] overflow-hidden bg-charcoal sm:mx-auto sm:w-[28rem]">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        <div
          className="pointer-events-none absolute inset-[18%] border-2 border-snow/70"
          aria-hidden="true"
        />
        {camera !== 'on' ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center font-ui text-caption text-mist">
            {camera === 'starting'
              ? 'Starting camera…'
              : camera === 'denied'
                ? 'Camera blocked. Allow camera access for this site in the browser settings, then reload.'
                : 'This browser cannot use the camera. Use the search below.'}
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-center font-ui text-body" aria-live="polite">
        {counts ? (
          <>
            <strong className="text-h3">{counts.checkedIn}</strong>{' '}
            <span className="text-mist">of {counts.sold} checked in</span>
          </>
        ) : (
          <span className="text-mist">…</span>
        )}
      </p>

      {approved.length > 0 ? (
        <section aria-label="Approved tickets" className="mx-4 mt-4 sm:mx-auto sm:w-[28rem]">
          <h2 className="font-ui text-meta uppercase tracking-wider text-mist">Approved tickets</h2>
          <ul data-testid="approved-list" className="mt-2 divide-y divide-snow/15">
            {approved.map((a, i) => (
              <li key={`${a.code}-${i}`} className="flex items-center justify-between gap-3 py-2 font-ui text-caption">
                <span>
                  <strong className="text-[#7be0a4]">✓ TICKET APPROVED</strong>
                  <span className="block">
                    {a.holder} · {a.tier} · {a.order}
                    {a.demo ? ' · DEMO' : ''}
                  </span>
                </span>
                <span className="shrink-0 text-mist">{a.at}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form onSubmit={search} className="mx-4 mt-4 flex gap-2 sm:mx-auto sm:w-[28rem]">
        <input
          name="q"
          placeholder="Name, order (NAM-…) or ticket code"
          className="min-h-12 flex-1 border border-snow/30 bg-transparent px-3 font-ui text-body text-snow placeholder:text-mist"
        />
        <button className="min-h-12 bg-snow px-4 font-ui text-caption font-semibold text-ink">
          Find
        </button>
      </form>
      {found.length > 0 ? (
        <ul className="mx-4 mt-3 divide-y divide-snow/15 sm:mx-auto sm:w-[28rem]">
          {found.map((f) => (
            <li
              key={f.code}
              className="flex items-center justify-between gap-3 py-3 font-ui text-caption"
            >
              <span>
                <strong>{f.holder}</strong> · {f.tier} · {f.order}
                <span className="block text-mist">
                  {f.status === 'checked_in' ? 'checked in' : f.status}
                </span>
              </span>
              {f.status === 'valid' ? (
                <button
                  type="button"
                  onClick={async () => {
                    await check(f.code)
                    setFound((list) =>
                      list.map((x) => (x.code === f.code ? { ...x, status: 'checked_in' } : x)),
                    )
                  }}
                  className="min-h-10 bg-snow px-3 font-semibold text-ink"
                >
                  Check in
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {msg && result ? (
        <div
          role="alert"
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center text-white ${toneCls[msg.tone]}`}
          onClick={() => {
            setResult(null)
            busyRef.current = false
          }}
        >
          <p className="font-display text-display">{msg.tone === 'ok' ? '✓' : '✕'}</p>
          <p className="mt-4 font-display text-h1" data-testid="scan-result">{msg.title}</p>
          {result.holder ? (
            <p className="mt-4 font-ui text-h3">
              {result.holder} · {result.tier}
            </p>
          ) : null}
          {result.event ? <p className="mt-2 font-ui text-body">{result.event}</p> : null}
          {result.order ? (
            <p className="mt-2 font-ui text-meta opacity-80">
              {result.order}
              {result.demo ? ' · DEMO' : ''}
            </p>
          ) : null}
          {result.result === 'already' && result.checkedInAt ? (
            <p className="mt-2 font-ui text-meta opacity-80">
              Scanned at {new Date(result.checkedInAt).toLocaleTimeString('en-GB')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
