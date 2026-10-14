'use client'

import { useState } from 'react'

/**
 * One ticket as a picture (SVG from the booking API, unique QR inside) plus a PNG download.
 * The PNG is drawn in the browser from the same SVG, so it always matches the ticket.
 */
export function TicketImage(props: {
  src: string
  fileName: string
  alt: string
  downloadLabel: string
  openLabel: string
}) {
  const [busy, setBusy] = useState(false)

  async function downloadPng() {
    setBusy(true)
    try {
      const svg = await (await fetch(props.src)).text()
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      const img = new Image()
      await new Promise<void>((ok, fail) => {
        img.onload = () => ok()
        img.onerror = () => fail(new Error('image'))
        img.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = 1520 // 2x of the 760 px design
      canvas.height = 720
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (blob) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${props.fileName}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      }
    } catch {
      window.open(props.src, '_blank', 'noopener')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated per ticket by the booking API */}
      <img src={props.src} alt={props.alt} width={760} height={360} className="h-auto w-full border border-rule" />
      <div className="mt-3 flex flex-wrap gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void downloadPng()}
          className="font-ui text-meta font-semibold text-fjord hover:underline disabled:opacity-40"
        >
          {props.downloadLabel}
        </button>
        <a href={props.src} target="_blank" rel="noopener noreferrer" className="font-ui text-meta font-semibold text-fjord hover:underline">
          {props.openLabel}
        </a>
      </div>
    </div>
  )
}
