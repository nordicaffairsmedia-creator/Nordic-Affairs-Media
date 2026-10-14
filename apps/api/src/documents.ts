import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import type { Order, Ticket } from './orders.js'
import { formatMoney, vatPart } from './pricing.js'

/**
 * PDFs use built-in Latin fonts, so they are written in English with the event's
 * English title. The emails and web pages carry the buyer's own language.
 */
const INK = '#121414'
const SLATE = '#5c6366'
const RULE = '#dcd8cf'

const stockholm = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Stockholm',
  }).format(d)

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

/** QR content: a short prefix plus the ticket code. The scanner checks the code against the database. */
export const qrPayload = (code: string) => `NAM1:${code}`

export function qrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(qrPayload(code), { margin: 1, width: 360, errorCorrectionLevel: 'M' })
}

/** One page per ticket: event, date, venue, tier, holder and a large QR code. */
export async function ticketsPdf(order: Order, list: Ticket[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A5', margin: 40, info: { Title: `Tickets ${order._id}` } })
  for (const [i, t] of list.entries()) {
    if (i > 0) doc.addPage()
    doc
      .fillColor(SLATE)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(order.demo ? 'NORDIC AFFAIRS MEDIA · DEMO TICKET (PRACTICE PAYMENT)' : 'NORDIC AFFAIRS MEDIA', { characterSpacing: 2 })
    doc.moveDown(0.8)
    doc.fillColor(INK).font('Times-Roman').fontSize(22).text(order.eventTitleEn)
    doc.moveDown(0.4)
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(stockholm(order.eventStartsAt))
    if (order.venueName) doc.text(order.venueName)
    doc.moveDown(0.8)
    doc.font('Helvetica-Bold').fontSize(12).text(t.tierName)
    doc.font('Helvetica').fontSize(10).fillColor(SLATE).text(t.holderName)
    const qr = await QRCode.toBuffer(qrPayload(t.code), {
      margin: 1,
      width: 600,
      errorCorrectionLevel: 'M',
    })
    const size = 230
    doc.image(qr, (doc.page.width - size) / 2, doc.y + 18, { width: size })
    doc.y += size + 30
    doc.font('Courier').fontSize(9).fillColor(SLATE).text(t.code, { align: 'center' })
    doc.moveDown(0.6)
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(`Order ${order._id} · Ticket ${i + 1} of ${list.length} · Valid for one entry`, {
        align: 'center',
      })
  }
  return collect(doc)
}

/** Receipt with VAT (moms) breakdown (PRD B-07). */
export async function receiptPdf(order: Order): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `Receipt ${order._id}` } })
  const money = (n: number) => formatMoney(n, order.currency)
  const right = doc.page.width - 56

  doc
    .fillColor(SLATE)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(order.demo ? 'NORDIC AFFAIRS MEDIA · DEMO - NOT A REAL PAYMENT' : 'NORDIC AFFAIRS MEDIA', { characterSpacing: 2 })
  doc.moveDown(1)
  doc.fillColor(INK).font('Times-Roman').fontSize(26).text(order.demo ? 'Receipt (demo)' : 'Receipt')
  doc.moveDown(0.5)
  doc.font('Helvetica').fontSize(10)
  doc.text(`Order: ${order._id}`)
  doc.text(`Date paid: ${order.paidAt ? stockholm(order.paidAt) : '—'}`)
  doc.text(`Customer: ${order.name} <${order.email}>`)
  doc.moveDown(1)
  doc.font('Helvetica-Bold').text(order.eventTitleEn)
  doc
    .font('Helvetica')
    .text(`${stockholm(order.eventStartsAt)}${order.venueName ? ` · ${order.venueName}` : ''}`)
  doc.moveDown(1)

  const row = (label: string, value: string, bold = false) => {
    const y = doc.y
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(10)
      .fillColor(INK)
    doc.text(label, 56, y, { width: 330 })
    doc.text(value, 56, y, { width: right - 56, align: 'right' })
    doc.moveDown(0.4)
  }
  const rule = () => {
    doc.moveTo(56, doc.y).lineTo(right, doc.y).strokeColor(RULE).lineWidth(1).stroke()
    doc.moveDown(0.5)
  }

  rule()
  for (const item of order.items) {
    row(
      `${item.quantity} × ${item.name} (${money(item.unitPrice)})`,
      money(item.unitPrice * item.quantity),
    )
  }
  if (order.discount)
    row(`Discount${order.promoCode ? ` (${order.promoCode})` : ''}`, `−${money(order.discount)}`)
  if (order.fees) row('Booking & service fees', money(order.fees))
  if (order.servicesTotal) {
    const names = [
      order.services?.smsTickets ? 'tickets by SMS' : '',
      order.services?.refundProtection ? 'refund protection' : '',
      order.services?.reminder ? 'event reminder' : '',
    ].filter(Boolean)
    row(`Extra services (${names.join(', ')})`, money(order.servicesTotal))
  }
  rule()
  row('Total', money(order.total), true)
  if (order.refundedAmount) row('Refunded', `−${money(order.refundedAmount)}`)
  doc.moveDown(0.6)
  const ticketsNet = order.subtotal - order.discount
  doc.fillColor(SLATE).fontSize(9)
  doc.text(`VAT included: ${money(order.vatAmount)}`)
  doc.text(
    `of which tickets ${order.ticketVatRate}%: ${money(vatPart(ticketsNet, order.ticketVatRate))}` +
      (order.fees + (order.servicesTotal ?? 0)
        ? `; fees and services ${order.feeVatRate}%: ${money(vatPart(order.fees + (order.servicesTotal ?? 0), order.feeVatRate))}`
        : ''),
  )
  doc.moveDown(2)
  doc.text('Paid by card or wallet via Stripe. This receipt was generated automatically.')
  return collect(doc)
}

const xml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * One unique ticket picture per ticket (SVG): event, date, venue, ticket type, holder, number
 * and the ticket's own QR code. The gate scanner reads the QR; nobody else's ticket has the same one.
 */
export function ticketSvg(
  order: Order,
  ticket: Ticket,
  index: number,
  total: number,
  opts: { demo?: boolean } = {},
): string {
  const qr = QRCode.create(qrPayload(ticket.code), { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const quiet = 2
  const cell = 7
  const size = (n + quiet * 2) * cell
  let rects = ''
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(y, x))
        rects += `<rect x="${(x + quiet) * cell}" y="${(y + quiet) * cell}" width="${cell}" height="${cell}"/>`
  const W = 760
  const H = 360
  const qx = W - size - 24
  const qy = (H - size) / 2
  const title = order.eventTitleEn.length > 34 ? `${order.eventTitleEn.slice(0, 33)}…` : order.eventTitleEn
  const status = ticket.status === 'cancelled' ? 'CANCELLED' : ticket.status === 'checked_in' ? 'USED' : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ticket ${xml(ticket.code)}">
<rect width="${W}" height="${H}" rx="14" fill="#f7f5f0"/>
<rect x="0" y="0" width="14" height="${H}" fill="#835c20"/>
<line x1="${qx - 14}" y1="24" x2="${qx - 14}" y2="${H - 24}" stroke="#dcd8cf" stroke-width="2" stroke-dasharray="6 6"/>
<g font-family="Arial,Helvetica,sans-serif" fill="#121414">
<text x="40" y="52" font-size="12" font-weight="700" letter-spacing="3" fill="#835c20">NORDIC AFFAIRS MEDIA${opts.demo ? ' · DEMO' : ''}</text>
<text x="40" y="104" font-family="Georgia,serif" font-size="30">${xml(title)}</text>
<text x="40" y="146" font-size="15" fill="#5c6366">${xml(stockholm(order.eventStartsAt))}</text>
<text x="40" y="170" font-size="15" fill="#5c6366">${xml(order.venueName || '')}</text>
<text x="40" y="228" font-size="12" letter-spacing="2" fill="#5c6366">TICKET TYPE</text>
<text x="40" y="254" font-size="20" font-weight="700">${xml(ticket.tierName)}</text>
<text x="40" y="290" font-size="12" letter-spacing="2" fill="#5c6366">HOLDER</text>
<text x="40" y="314" font-size="17">${xml(ticket.holderName || order.name)}</text>
<text x="40" y="342" font-size="12" fill="#5c6366">Ticket ${index} of ${total} · Order ${xml(order._id)}</text>
<text x="${qx + size / 2}" y="${qy - 8}" font-size="11" text-anchor="middle" letter-spacing="2" fill="#5c6366">SCAN AT ENTRANCE</text>
<text x="${qx + size / 2}" y="${qy + size + 18}" font-family="monospace" font-size="10" text-anchor="middle" fill="#5c6366">${xml(ticket.code)}</text>
</g>
<rect x="${qx}" y="${qy}" width="${size}" height="${size}" fill="#fff"/>
<g transform="translate(${qx} ${qy})" fill="#121414" shape-rendering="crispEdges">${rects}</g>
${status ? `<text x="${W / 2}" y="${H / 2 + 20}" font-family="Arial" font-size="72" font-weight="700" fill="#b3261e" fill-opacity="0.35" text-anchor="middle" transform="rotate(-12 ${W / 2} ${H / 2})">${status}</text>` : ''}
</svg>`
}
