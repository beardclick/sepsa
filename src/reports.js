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
  let y = 20
  const line = (text, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 12 : 10)
    for (const item of doc.splitTextToSize(String(text || '—'), 178)) {
      if (y > 277) {
        doc.addPage()
        y = 20
      }
      doc.text(item, 16, y)
      y += 5
    }
    y += 2
  }
  line(`SEPSA • Informe diario ${fdate(report.fecha)}`, true)
  line(
    `Generado: ${new Date(report.generado).toLocaleString('es-PA', { timeZone: 'America/Panama', hour12: true })}`,
  )
  for (const section of report.sections) {
    line(`${section.title} (${section.rows.length})`, true)
    if (!section.rows.length) line('Sin registros.')
    section.rows.forEach((r, i) =>
      line(
        `${i + 1}. ${Object.entries(r)
          .map(([k, v]) => `${k}: ${v || '—'}`)
          .join(' | ')}`,
      ),
    )
  }
  line('Comentarios', true)
  line(report.comentarios || 'Sin comentarios.')
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(9)
    doc.text(`${p} / ${pages}`, 185, 290)
  }
  return doc
}
export async function downloadReport(report) {
  const doc = await renderReportPdf(report)
  doc.save(`sepsa-informe-${report.fecha}.pdf`)
}
