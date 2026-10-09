import { useState } from 'react'
import { useStore } from '../store'
import { reportDate } from '../reports'
import { fdate, ftime } from '../config'
import {
  WEEKDAYS,
  weekStart,
  plusDays,
  weeklyShifts,
  analyzeShiftPlan,
} from '../schedule'
import { DatePicker, TimePicker } from './DateTimePicker'
import { Button, Modal } from './ui'

export default function ShiftPlanner({
  initialAgent = '',
  initialClient = '',
  onClose,
  onCreated,
}) {
  const { data, addShiftPlan } = useStore()
  const today = reportDate(),
    currentMonday = weekStart(today)
  const [agent, setAgent] = useState(initialAgent),
    [client, setClient] = useState(
      initialClient ||
        data.agents.find((a) => a.id === initialAgent)?.sitio ||
        '',
    )
  const [weeks, setWeeks] = useState(
    [0, 7].map((offset) => ({
      start: plusDays(currentMonday, offset),
      days: [],
      inicio: '06:00',
      fin: '18:00',
      tipo: 'Diurno',
    })),
  )
  const [skip, setSkip] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const patchWeek = (index, patch) =>
    setWeeks((current) =>
      current.map((week, i) => (i === index ? { ...week, ...patch } : week)),
    )
  const candidates = weeklyShifts(agent, client, weeks)
  const { accepted, conflicts } = analyzeShiftPlan(candidates, data.shifts)
  const create = () => {
    if (!agent || !client) return setError('Selecciona el agente y el puesto.')
    if (!candidates.length)
      return setError('Selecciona los días de al menos una semana.')
    const finish = (result) => {
      setBusy(false)
      if (result.error) return setError(result.error)
      onCreated?.(result)
      onClose()
    }
    const result = addShiftPlan(candidates, skip)
    if (result?.then) {
      setBusy(true)
      result.then(finish).catch((e) => {
        setBusy(false)
        setError(e.message)
      })
    } else finish(result)
  }
  return (
    <Modal
      title="Programar turnos por semana"
      subtitle="Elige los días y el horario de cada semana. Revisa las fechas antes de crear los turnos."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              !candidates.length ||
              (conflicts.length > 0 && !skip) ||
              !accepted.length
            }
            onClick={create}
          >
            Crear {skip ? accepted.length : candidates.length} turnos
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Agente
            <select
              className="input mt-1"
              aria-label="Agente de la programación"
              value={agent}
              disabled={!!initialAgent}
              onChange={(e) => {
                setAgent(e.target.value)
                setClient(
                  data.agents.find((a) => a.id === e.target.value)?.sitio || '',
                )
              }}
            >
              <option value="">Seleccionar…</option>
              {data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Puesto / Cliente
            <select
              className="input mt-1"
              aria-label="Puesto de la programación"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        {weeks.map((week, index) => {
          const heading =
            week.start === currentMonday
              ? 'Esta semana'
              : week.start === plusDays(currentMonday, 7)
                ? 'Próxima semana'
                : `Semana ${index + 1}`
          return (
            <fieldset
              key={index}
              className="rounded-2xl border border-line p-4"
            >
              <legend className="px-2 text-sm font-bold">{heading}</legend>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="w-40">
                  <DatePicker
                    aria-label={`Inicio de semana ${index + 1}`}
                    value={week.start}
                    onChange={(date) => {
                      if (date) patchWeek(index, { start: weekStart(date) })
                    }}
                  />
                </div>
                <p className="text-xs text-muted">
                  {fdate(week.start)} – {fdate(plusDays(week.start, 6))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    aria-label={day}
                    aria-pressed={week.days.includes(i)}
                    onClick={() =>
                      patchWeek(index, {
                        days: week.days.includes(i)
                          ? week.days.filter((d) => d !== i)
                          : [...week.days, i],
                      })
                    }
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${week.days.includes(i) ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-card hover:bg-soft'}`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
              <div className="my-3 flex flex-wrap gap-3 text-xs font-semibold text-accent">
                <button
                  type="button"
                  onClick={() => patchWeek(index, { days: [0, 1, 2, 3, 4] })}
                >
                  Lun–Vie
                </button>
                <button
                  type="button"
                  onClick={() => patchWeek(index, { days: [1, 2, 3, 4, 5] })}
                >
                  Mar–Sáb
                </button>
                <button
                  type="button"
                  onClick={() => patchWeek(index, { days: [] })}
                >
                  Limpiar días
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Hora inicio
                  <TimePicker
                    value={week.inicio}
                    onChange={(inicio) => patchWeek(index, { inicio })}
                  />
                </label>
                <label className="text-sm">
                  Hora fin
                  <TimePicker
                    value={week.fin}
                    onChange={(fin) => patchWeek(index, { fin })}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  Tipo
                  <select
                    aria-label={`Tipo de turno semana ${index + 1}`}
                    className="input mt-1"
                    value={week.tipo}
                    onChange={(e) => {
                      const tipo = e.target.value
                      patchWeek(index, {
                        tipo,
                        inicio: tipo === 'Nocturno' ? '18:00' : '06:00',
                        fin: tipo === 'Diurno' ? '18:00' : '06:00',
                      })
                    }}
                  >
                    <option>Diurno</option>
                    <option>Nocturno</option>
                    <option>24 horas</option>
                  </select>
                </label>
              </div>
            </fieldset>
          )
        })}
        {!!conflicts.length && (
          <div
            role="alert"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
          >
            <p className="font-semibold">
              {conflicts.length} turno(s) coinciden con otro horario del agente.
            </p>
            <ul className="my-2 space-y-1">
              {conflicts.map((c, i) => (
                <li key={i}>
                  {fdate(c.shift.fecha)} · {ftime(c.shift.inicio)} –{' '}
                  {ftime(c.shift.fin)}
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={skip}
                onChange={(e) => setSkip(e.target.checked)}
              />
              Omitir los turnos en conflicto
            </label>
          </div>
        )}
        {!!candidates.length && (
          <div className="rounded-xl border border-line p-3">
            <h3 className="mb-2 text-sm font-bold">
              Vista previa · {skip ? accepted.length : candidates.length} turnos
            </h3>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {(skip ? accepted : candidates).map((s, i) => (
                <li key={i}>
                  {fdate(s.fecha)} · {ftime(s.inicio)} – {ftime(s.fin)} ·{' '}
                  {s.tipo}
                </li>
              ))}
            </ul>
            {candidates.some((s) => s.fecha < today) && (
              <p className="mt-2 text-xs text-muted">
                La selección incluye fechas anteriores a hoy.
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
