import { interval } from './duty'

export const WEEKDAYS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
]
const isoDate = (date) => date.toISOString().slice(0, 10)
export function weekStart(fecha) {
  const date = new Date(`${fecha}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return isoDate(date)
}
export function plusDays(fecha, days) {
  const date = new Date(`${fecha}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return isoDate(date)
}
export function weeklyShifts(agente, cliente, weeks) {
  return weeks.flatMap((week) =>
    [...new Set(week.days)]
      .sort((a, b) => a - b)
      .map((day) => ({
        agente,
        cliente,
        fecha: plusDays(weekStart(week.start), day),
        inicio: week.inicio,
        fin: week.fin,
        tipo: week.tipo,
        estado: 'Programado',
      })),
  )
}
export function analyzeShiftPlan(candidates, existing) {
  const accepted = [],
    conflicts = []
  for (const shift of candidates) {
    const { start, end } = interval(shift)
    const conflict = [...existing, ...accepted].find((other) => {
      if (other.agente !== shift.agente || other.estado === 'Ausente')
        return false
      const range = interval(other)
      return start < range.end && end > range.start
    })
    if (conflict) conflicts.push({ shift, existing: conflict })
    else accepted.push(shift)
  }
  return { accepted, conflicts }
}
