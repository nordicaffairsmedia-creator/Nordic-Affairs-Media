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
      .text('NORDIC AFFAIRS MEDIA', { characterSpacing: 2 })
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
    .text('NORDIC AFFAIRS MEDIA', { characterSpacing: 2 })
  doc.moveDown(1)
  doc.fillColor(INK).font('Times-Roman').fontSize(26).text('Receipt')
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
  rule()
  row('Total', money(order.total), true)
  if (order.refundedAmount) row('Refunded', `−${money(order.refundedAmount)}`)
  doc.moveDown(0.6)
  const ticketsNet = order.subtotal - order.discount
  doc.fillColor(SLATE).fontSize(9)
  doc.text(`VAT included: ${money(order.vatAmount)}`)
  doc.text(
    `of which tickets ${order.ticketVatRate}%: ${money(vatPart(ticketsNet, order.ticketVatRate))}` +
      (order.fees
        ? `; fees ${order.feeVatRate}%: ${money(vatPart(order.fees, order.feeVatRate))}`
        : ''),
  )
  doc.moveDown(2)
  doc.text('Paid by card or wallet via Stripe. This receipt was generated automatically.')
  return collect(doc)
}
