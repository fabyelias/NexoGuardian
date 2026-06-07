import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import type { Checkpoint, Site } from '@/shared/types/models'

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 15
const CARD_H = (PAGE_H - MARGIN * 2) / 2
const CARD_W = PAGE_W - MARGIN * 2
const QR_SIZE = 90
const BORDER_R = 4

async function generateQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 400,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })
}

function drawCard(
  doc: jsPDF,
  checkpoint: Checkpoint,
  site: Site,
  qrDataUrl: string,
  yOffset: number,
) {
  const x = MARGIN
  const y = MARGIN + yOffset

  // Card border
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, CARD_W, CARD_H - 4, BORDER_R, BORDER_R, 'S')

  // Top color band
  doc.setFillColor(30, 64, 175) // blue-800
  doc.roundedRect(x, y, CARD_W, 12, BORDER_R, BORDER_R, 'F')
  doc.rect(x, y + 6, CARD_W, 6, 'F') // square bottom of band

  // Site name in band
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text(site.name.toUpperCase(), x + 6, y + 8.5)

  const contentY = y + 16
  const qrX = x + CARD_W - QR_SIZE - 10

  // QR Code
  doc.addImage(qrDataUrl, 'PNG', qrX, contentY + 2, QR_SIZE, QR_SIZE)

  // Checkpoint name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  const nameLines = doc.splitTextToSize(checkpoint.name, CARD_W - QR_SIZE - 24)
  doc.text(nameLines, x + 8, contentY + 14)

  // Description
  if (checkpoint.description) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)
    const descLines = doc.splitTextToSize(checkpoint.description, CARD_W - QR_SIZE - 24)
    doc.text(descLines, x + 8, contentY + 24)
  }

  // QR code label
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Escanear para registrar rondín', qrX + QR_SIZE / 2, contentY + QR_SIZE + 7, { align: 'center' })

  // Checkpoint ID (tiny, for traceability)
  doc.setFontSize(6)
  doc.setTextColor(180, 180, 180)
  doc.text(`ID: ${checkpoint.qr_code}`, x + 8, y + CARD_H - 8)

  // Site address
  if (site.address) {
    doc.setFontSize(7)
    doc.setTextColor(130, 130, 130)
    doc.text(`📍 ${site.address}`, x + 8, contentY + CARD_H - 28)
  }
}

export async function printCheckpointQRs(site: Site, checkpoints: Checkpoint[]) {
  const active = checkpoints.filter((c) => c.is_active)
  if (active.length === 0) return

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  for (let i = 0; i < active.length; i++) {
    const cp = active[i]
    const isSecond = i % 2 === 1
    const isNewPage = i > 0 && i % 2 === 0

    if (isNewPage) doc.addPage()

    const qrDataUrl = await generateQRDataUrl(cp.qr_code)
    drawCard(doc, cp, site, qrDataUrl, isSecond ? CARD_H : 0)
  }

  doc.save(`checkpoints-${site.name.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}
