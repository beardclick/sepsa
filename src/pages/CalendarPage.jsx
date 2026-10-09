import { ftime, fdate } from '../config'
import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  CalendarX,
} from 'lucide-react'
import { Link } from '../nav'
import { RESOURCES } from '../config'
import { useStore } from '../store'
import { Badge, Button, Card, Modal } from '../components/ui'
import ShiftPlanner from '../components/ShiftPlanner'
import RecordForm from '../components/RecordForm'
import { dayKey } from '../duty'

const cfg = RESOURCES.shifts
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function chipCls(s) {
  if (s.estado === 'Ausente')
    return 'bg-red-500/15 text-red-600 dark:text-red-400'
  if (s.estado === 'Completado') return 'bg-soft text-muted'
  return s.tipo === 'Diurno'
    ? 'bg-accent-soft text-accent'
    : 'bg-accent text-accent-fg'
}

export default function CalendarPage() {
  const { data, add, update, remove, can } = useStore()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(dayKey(new Date()))
  const [agentF, setAgentF] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [planning, setPlanning] = useState(false)
  const [planMessage, setPlanMessage] = useState('')
  const todayKey = dayKey(new Date())

  const agentName = (id) => data.agents.find((a) => a.id === id)?.nombre || '—'
  const clientName = (id) =>
    data.clients.find((c) => c.id === id)?.nombre || '—'

  const byDay = useMemo(() => {
    const m = {}
    data.shifts
      .filter((s) => !agentF || s.agente === agentF)
      .forEach((s) => {
        ;(m[s.fecha] ||= []).push(s)
      })
    Object.values(m).forEach((a) =>
      a.sort((x, y) => x.inicio.localeCompare(y.inicio)),
    )
    return m
  }, [data.shifts, agentF])

  const cells = useMemo(() => {
    const y = cursor.getFullYear(),
      mo = cursor.getMonth()
    const offset = (new Date(y, mo, 1).getDay() + 6) % 7
    const total = Math.ceil((offset + new Date(y, mo + 1, 0).getDate()) / 7) * 7
    return Array.from(
      { length: total },
      (_, i) => new Date(y, mo, i - offset + 1),
    )
  }, [cursor])

  const move = (n) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1))
  const goToday = () => {
    const d = new Date()
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
    setSelected(dayKey(d))
  }
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)
  const monthLabel = cap(
    cursor.toLocaleDateString('es-PA', { month: 'long', year: 'numeric' }),
  )
  const dayShifts = byDay[selected] || []
  const selDate = selected.split('-').map(Number)
  const selLabel = new Date(
    selDate[0],
    selDate[1] - 1,
    selDate[2],
  ).toLocaleDateString('es-PA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const selTitle = cap(selLabel)

  const save = (vals) => {
    if (editing.id) update('shifts', editing.id, vals)
    else add('shifts', vals)
    setSelected(vals.fecha)
    setEditing(null)
  }

  const onDrop = (e, key) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (id && can('shifts', 'update')) update('shifts', id, { fecha: key })
    setSelected(key)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Programa y administra jornadas y turnos. En escritorio puedes
          arrastrar un turno a otro día.
        </p>
        {can('shifts', 'create') && (
          <Button variant="ghost" onClick={() => setPlanning(true)}>
            Programar semanas
          </Button>
        )}
        {can('shifts', 'create') && (
          <Button
            onClick={() => setEditing({ fecha: selected })}
            className="w-full sm:w-auto"
          >
            <Plus className="size-4" /> Agregar turno
          </Button>
        )}
      </div>

      {planMessage && (
        <p role="status" className="text-sm text-accent">
          {planMessage}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="p-3 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-bold">{monthLabel}</h2>
            <select
              className="input !w-auto max-w-[170px]"
              value={agentF}
              onChange={(e) => setAgentF(e.target.value)}
              aria-label="Filtrar por agente"
            >
              <option value="">Todos los agentes</option>
              {data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            <Button variant="ghost" onClick={goToday} className="!px-3 !py-2">
              Hoy
            </Button>
            <div className="flex gap-1">
              <button
                onClick={() => move(-1)}
                aria-label="Mes anterior"
                className="rounded-lg border border-line p-2 hover:bg-soft cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => move(1)}
                aria-label="Mes siguiente"
                className="rounded-lg border border-line p-2 hover:bg-soft cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
            {DOW.map((d) => (
              <div
                key={d}
                className="bg-soft py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted"
              >
                {d}
              </div>
            ))}
            {cells.map((d) => {
              const key = dayKey(d)
              const list = byDay[key] || []
              const out = d.getMonth() !== cursor.getMonth()
              const sel = key === selected
              return (
                <div
                  key={key}
                  onClick={() => setSelected(key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, key)}
                  className={`min-h-14 cursor-pointer p-1 transition sm:min-h-28 sm:p-1.5 ${sel ? 'bg-accent-soft ring-2 ring-inset ring-accent' : 'bg-card hover:bg-soft'} ${out ? 'opacity-45' : ''}`}
                >
                  <div
                    className={`mx-auto grid size-6 place-items-center rounded-full text-xs font-semibold sm:mx-0 sm:ml-auto ${key === todayKey ? 'bg-accent text-accent-fg' : ''}`}
                  >
                    {d.getDate()}
                  </div>
                  {/* móvil: puntos */}
                  <div className="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((s) => (
                      <span
                        key={s.id}
                        className={`size-1.5 rounded-full ${s.estado === 'Ausente' ? 'bg-red-500' : 'bg-accent'}`}
                      />
                    ))}
                  </div>
                  {/* escritorio: chips */}
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {list.slice(0, 3).map((s) => (
                      <button
                        key={s.id}
                        draggable={can('shifts', 'update')}
                        onDragStart={(e) =>
                          e.dataTransfer.setData('text/plain', s.id)
                        }
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(key)
                          if (can('shifts', 'update')) setEditing(s)
                        }}
                        title={`${ftime(s.inicio)}–${ftime(s.fin)} · ${agentName(s.agente)} · ${clientName(s.cliente)}`}
                        className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold cursor-grab ${chipCls(s)}`}
                      >
                        {ftime(s.inicio)} {agentName(s.agente).split(' ')[0]}
                      </button>
                    ))}
                    {list.length > 3 && (
                      <div className="px-1 text-[11px] font-medium text-muted">
                        +{list.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-accent-soft ring-1 ring-accent/40" />{' '}
              Diurno
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-accent" /> Nocturno / 24 h
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-red-500/30" /> Ausente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-soft ring-1 ring-line" />{' '}
              Completado
            </span>
          </div>
        </Card>

        {/* Detalle del día */}
        <Card className="h-fit p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">{selTitle}</h3>
              <p className="text-sm text-muted">
                {dayShifts.length} turno{dayShifts.length === 1 ? '' : 's'}
              </p>
            </div>
            {can('shifts', 'create') && (
              <Button
                onClick={() => setEditing({ fecha: selected })}
                className="!px-3 !py-2"
              >
                <Plus className="size-4" /> Turno
              </Button>
            )}
          </div>
          {dayShifts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
              <CalendarX className="size-8" />
              Sin turnos este día.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {dayShifts.map((s) => (
                <li key={s.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/turnos/${s.id}`}
                        className="block text-sm font-bold hover:text-accent"
                      >
                        {ftime(s.inicio)} – {ftime(s.fin)}{' '}
                        <span className="font-medium text-muted">
                          · {s.tipo}
                        </span>
                      </Link>
                      <Link
                        to={`/agentes/${s.agente}`}
                        className="block truncate text-sm hover:text-accent"
                      >
                        {agentName(s.agente)}
                      </Link>
                      <div className="truncate text-xs text-muted">
                        {clientName(s.cliente)}
                      </div>
                    </div>
                    {can('shifts', 'update') && (
                      <button
                        onClick={() => setEditing(s)}
                        aria-label="Editar turno"
                        className="rounded-lg p-2 text-muted hover:bg-soft hover:text-fg cursor-pointer"
                      >
                        <Pencil className="size-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2">
                    <Badge value={s.estado} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {planning && (
        <ShiftPlanner
          initialAgent={agentF}
          onClose={() => setPlanning(false)}
          onCreated={(result) => {
            setPlanMessage(
              `${result.created} turnos creados${result.skipped ? `; ${result.skipped} omitidos por conflicto` : ''}.`,
            )
            setSelected(result.firstDate)
            const d = new Date(`${result.firstDate}T12:00:00`)
            setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
          }}
        />
      )}
      {editing && (
        <RecordForm
          cfg={cfg}
          record={editing}
          data={data}
          onSave={save}
          onClose={() => setEditing(null)}
          onDelete={
            can('shifts', 'delete')
              ? (r) => {
                  setEditing(null)
                  setDeleting(r)
                }
              : undefined
          }
        />
      )}
      {deleting && (
        <Modal
          size="max-w-md"
          title="Eliminar turno"
          subtitle="Esta acción no se puede deshacer."
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  remove('shifts', deleting.id)
                  setDeleting(null)
                }}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm">
            ¿Eliminar el turno de <b>{agentName(deleting.agente)}</b> del{' '}
            {fdate(deleting.fecha)}?
          </p>
        </Modal>
      )}
    </div>
  )
}
