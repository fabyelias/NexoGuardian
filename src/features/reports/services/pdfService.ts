import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Incident, GuardLog, PatrolSession, Shift } from '@/shared/types/models'
import { INCIDENT_CATEGORY_LABELS, INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS } from '@/shared/types/enums'

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date))
}

function addHeader(doc: jsPDF, title: string, subtitle: string, orgName: string) {
  doc.setFillColor(10, 10, 10)
  doc.rect(0, 0, 210, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('NEXOGUARD', 14, 13)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 150, 150)
  doc.text('Plataforma de Gestión de Seguridad', 14, 20)

  doc.setTextColor(100, 150, 255)
  doc.setFontSize(10)
  doc.text(orgName, 196, 13, { align: 'right' })
  doc.setTextColor(150, 150, 150)
  doc.setFontSize(8)
  doc.text(new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' }), 196, 20, { align: 'right' })

  doc.setTextColor(30, 30, 30)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 44)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(subtitle, 14, 52)

  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.5)
  doc.line(14, 56, 196, 56)
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text(`Generado por NexoGuard — ${new Date().toLocaleString('es-AR')}`, 14, 290)
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' })
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(14, 287, 196, 287)
  }
}

export function generateIncidentsReport(
  incidents: Incident[],
  orgName: string,
  dateRange: string
) {
  const doc = new jsPDF()
  addHeader(doc, 'Informe de Incidentes', dateRange, orgName)

  // Stats summary
  const open = incidents.filter(i => i.status === 'open').length
  const resolved = incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length
  const critical = incidents.filter(i => i.severity === 'critical').length
  const panic = incidents.filter(i => i.is_panic).length

  doc.setFillColor(245, 247, 250)
  doc.roundedRect(14, 62, 43, 22, 2, 2, 'F')
  doc.roundedRect(60, 62, 43, 22, 2, 2, 'F')
  doc.roundedRect(106, 62, 43, 22, 2, 2, 'F')
  doc.roundedRect(152, 62, 43, 22, 2, 2, 'F')

  const stats = [
    { label: 'Total', value: incidents.length, x: 35 },
    { label: 'Abiertos', value: open, x: 81 },
    { label: 'Resueltos', value: resolved, x: 127 },
    { label: 'Críticos', value: critical + panic, x: 173 },
  ]

  stats.forEach(s => {
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(37, 99, 235)
    doc.text(String(s.value), s.x, 74, { align: 'center' })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text(s.label, s.x, 81, { align: 'center' })
  })

  autoTable(doc, {
    startY: 92,
    head: [['Fecha', 'Título', 'Categoría', 'Severidad', 'Estado', 'Sitio']],
    body: incidents.map(i => [
      formatDateTime(i.created_at),
      i.is_panic ? `🚨 ${i.title}` : i.title,
      INCIDENT_CATEGORY_LABELS[i.category],
      INCIDENT_SEVERITY_LABELS[i.severity],
      INCIDENT_STATUS_LABELS[i.status],
      (i.site as { name: string } | undefined)?.name ?? '—',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 55 },
      2: { cellWidth: 28 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 27 },
    },
  })

  addFooter(doc)
  doc.save(`nexoguard-incidentes-${new Date().toISOString().split('T')[0]}.pdf`)
}

export function generateShiftReport(
  shift: Shift,
  logs: GuardLog[],
  patrols: PatrolSession[],
  orgName: string
) {
  const doc = new jsPDF()

  const guardName = shift.guard
    ? `${(shift.guard as { first_name: string; last_name: string }).first_name} ${(shift.guard as { first_name: string; last_name: string }).last_name}`
    : 'Vigilador'

  const siteName = (shift.site as { name: string } | undefined)?.name ?? '—'
  const subtitle = `Turno: ${formatDateTime(shift.scheduled_start)} — ${formatDateTime(shift.scheduled_end)}`

  addHeader(doc, `Informe de Turno — ${guardName}`, subtitle, orgName)

  // Shift info box
  doc.setFillColor(245, 247, 250)
  doc.roundedRect(14, 62, 182, 28, 2, 2, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50, 50, 50)
  doc.text('Objetivo:', 18, 72)
  doc.text('Vigilador:', 18, 80)
  doc.text('Inicio real:', 100, 72)
  doc.text('Fin real:', 100, 80)
  doc.setFont('helvetica', 'normal')
  doc.text(siteName, 45, 72)
  doc.text(guardName, 45, 80)
  doc.text(shift.actual_start ? formatDateTime(shift.actual_start) : '—', 125, 72)
  doc.text(shift.actual_end ? formatDateTime(shift.actual_end) : 'En curso', 125, 80)
  doc.setFont('helvetica', 'bold')
  doc.text('Estado:', 18, 88)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(shift.status === 'completed' ? 22 : 37, shift.status === 'completed' ? 163 : 99, shift.status === 'completed' ? 74 : 235)
  doc.text(shift.status === 'active' ? 'Activo' : shift.status === 'completed' ? 'Completado' : shift.status, 45, 88)

  let y = 98

  // Logs
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Novedades del turno', 14, y + 6)
  y += 10

  if (logs.length === 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 150, 150)
    doc.text('Sin novedades registradas en este turno.', 14, y + 6)
    y += 14
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Hora', 'Novedad']],
      body: logs.map(l => [
        formatDateTime(l.recorded_at),
        l.ai_enhanced || l.content,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 150 } },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Patrols
  if (y > 250) { doc.addPage(); y = 20 }
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Rondines realizados', 14, y + 6)
  y += 10

  if (patrols.length === 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 150, 150)
    doc.text('Sin rondines registrados en este turno.', 14, y + 6)
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Inicio', 'Estado', 'Puntos visitados', 'Completado']],
      body: patrols.map(p => [
        formatDateTime(p.started_at),
        p.status === 'completed' ? 'Completado' : p.status === 'in_progress' ? 'En curso' : 'Incompleto',
        `${p.visited_checkpoints}/${p.total_checkpoints}`,
        p.completed_at ? formatDateTime(p.completed_at) : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })
  }

  addFooter(doc)
  doc.save(`nexoguard-turno-${guardName.replace(' ', '-')}-${new Date().toISOString().split('T')[0]}.pdf`)
}
