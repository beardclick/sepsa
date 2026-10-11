import { RESOURCES, fdate } from './config'
import { display } from './components/DataTable'
export const reportDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
export const REPORT_SECTIONS = {
  incidents: 'Incidentes del día',
  shifts: 'Turnos del día',
  agents: 'Personal',
  clients: 'Clientes',
  equipment: 'Equipos',
  contracts: 'Contratos',
}
export function makeReport(data, fecha, sections, comentarios = '') {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    fecha,
    comentarios,
    generado: new Date().toISOString(),
    sections: sections.map((key) => ({
      key,
      title: REPORT_SECTIONS[key],
      rows: (data[key] || [])
        .filter(
          (r) => !['incidents', 'shifts'].includes(key) || r.fecha === fecha,
        )
        .map((row) =>
          Object.fromEntries(
            RESOURCES[key].fields
              .filter(
                (f) => !['image', 'pdf', 'location', 'coord'].includes(f.type),
              )
              .map((f) => [f.label, display(f, row[f.key], data)]),
          ),
        ),
    })),
  }
}
export async function renderReportPdf(report) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const left = 16
  const width = 178
  const labelWidth = 56
  const bottom = 278
  let y = 20

  const nextPage = () => {
    doc.addPage()
    y = 20
  }
  const ensureSpace = (height) => {
    if (y + height > bottom) nextPage()
  }
  const textLines = (value, maxWidth) => {
    const text = value === null || value === undefined || value === '' ? '—' : String(value)
    return doc.splitTextToSize(text, maxWidth)
  }
  const sectionHeading = (title) => {
    ensureSpace(36)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(23, 43, 66)
    doc.text(title, left, y + 5)
    y += 10
  }
  const tableHeader = (title) => {
    ensureSpace(17)
    doc.setFillColor(37, 58, 82)
    doc.rect(left, y, width, 9, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title, left + 3, y + 6)
    y += 9
    doc.setFillColor(230, 236, 242)
    doc.rect(left, y, width, 8, 'F')
    doc.setTextColor(36, 52, 69)
    doc.text('Campo', left + 3, y + 5.5)
    doc.text('Detalle', left + labelWidth + 3, y + 5.5)
    y += 8
  }
  const tableRow = (label, value, title, alternate) => {
    doc.setFontSize(9)
    const labels = textLines(label, labelWidth - 6)
    const values = textLines(value, width - labelWidth - 6)
    let index = 0
    while (index < Math.max(labels.length, values.length)) {
      if (y + 9 > bottom) tableHeader(`${title} (continuación)`)
      const count = Math.min(
        Math.floor((bottom - y - 4) / 4.5),
        Math.max(labels.length, values.length) - index,
      )
      const height = count * 4.5 + 4
      doc.setFillColor(...(alternate ? [248, 250, 252] : [255, 255, 255]))
      doc.rect(left, y, width, height, 'F')
      doc.setDrawColor(214, 222, 230)
      doc.line(left, y + height, left + width, y + height)
      doc.line(left + labelWidth, y, left + labelWidth, y + height)
      doc.setTextColor(36, 52, 69)
      doc.setFont('helvetica', 'bold')
      doc.text(labels.slice(index, index + count), left + 3, y + 6)
      doc.setFont('helvetica', 'normal')
      doc.text(values.slice(index, index + count), left + labelWidth + 3, y + 6)
      y += height
      index += count
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(23, 43, 66)
  doc.text(`SEPSA - Informe diario ${fdate(report.fecha)}`, left, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Generado: ${new Date(report.generado).toLocaleString('es-PA', { timeZone: 'America/Panama', hour12: true })}`,
    left,
    y,
  )
  y += 10

  for (const section of report.sections) {
    sectionHeading(`${section.title} (${section.rows.length})`)
    if (!section.rows.length) {
      tableHeader('Sin registros')
      tableRow('Estado', 'Sin registros.', 'Sin registros', false)
    }
    section.rows.forEach((row, i) => {
      const title = `Registro ${i + 1}`
      tableHeader(title)
      const entries = Object.entries(row)
      if (!entries.length) tableRow('Estado', 'Sin datos.', title, false)
      entries.forEach(([label, value], index) =>
        tableRow(label, value, title, index % 2 === 1),
      )
      y += 4
    })
    y += 3
  }
  sectionHeading('Comentarios')
  tableHeader('Observaciones de la jornada')
  tableRow('Comentarios', report.comentarios || 'Sin comentarios.', 'Observaciones de la jornada', false)

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 112, 125)
    doc.text(`${p} / ${pages}`, 185, 290)
  }
  return doc
}
export async function downloadReport(report) {
  const doc = await renderReportPdf(report)
  doc.save(`sepsa-informe-${report.fecha}.pdf`)
}
