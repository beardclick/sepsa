import { newestFirst } from '../recordOrder'
import { useState } from 'react'
import { useStore } from '../store'
import { RESOURCES, fdate } from '../config'
import { reportDate } from '../reports'
import { useNow } from '../duty'
import { Card, Button, Badge } from '../components/ui'
import RecordForm from '../components/RecordForm'
export default function AgentPortal() {
  const {
    data,
    user,
    can,
    submitIncident,
    incidentsReady,
    authStatus,
    shiftsReady,
  } = useStore()
  const now = useNow(1000)
  const agent = data.agents.find((a) => a.id === user.agent)
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState('')
  if (!agent && authStatus.available && !incidentsReady)
    return <Card className="p-6">Cargando tu ficha de agente…</Card>
  if (!agent)
    return (
      <Card className="p-6">
        <h2 className="font-bold">Acceso del agente</h2>
        <p className="mt-2 text-sm text-muted">
          El administrador debe asociar tu usuario con una ficha de agente en
          Usuarios y permisos.
        </p>
      </Card>
    )
  const cfg = {
    ...RESOURCES.incidents,
    fields: RESOURCES.incidents.fields.filter(
      (f) => !['agente', 'cliente', 'estado'].includes(f.key),
    ),
  }
  const shifts = data.shifts
    .filter((s) => s.agente === agent.id && s.estado === 'Programado')
    .map((s) => {
      const start = new Date(`${s.fecha}T${s.inicio}:00-05:00`)
      let end = new Date(`${s.fecha}T${s.fin}:00-05:00`)
      if (end <= start) end = new Date(end.getTime() + 86400000)
      return { ...s, start, end }
    })
    .sort((a, b) => a.end - b.end)
  const current = shifts.find((s) => s.start <= now && now < s.end)
  const next = shifts
    .filter((s) => s.start > now)
    .sort((a, b) => a.start - b.start)[0]
  const seconds = current
    ? Math.max(0, Math.ceil((current.end - now) / 1000))
    : 0
  const countdown = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
  const incidents = newestFirst(
    data.incidents.filter((i) => i.agente === agent.id),
  )
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Hola, {agent.nombre}</h2>
          <div
            className="rounded-xl border border-line bg-soft px-4 py-3 text-right"
            aria-label="Tiempo restante de turno"
          >
            <p className="text-xs text-muted">
              {!shiftsReady
                ? 'Cargando turno…'
                : current
                  ? 'Tu turno termina en'
                  : 'Fuera de turno'}
            </p>
            {!shiftsReady ? null : current ? (
              <p
                role="timer"
                className="mt-1 font-mono text-3xl font-bold tabular-nums text-accent"
              >
                {countdown}
              </p>
            ) : (
              <p className="mt-1 text-sm">
                {next
                  ? `Próximo turno: ${fdate(next.fecha)} · ${new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', hour: '2-digit', minute: '2-digit', hour12: true }).format(next.start)}`
                  : 'Sin turnos próximos'}
              </p>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {data.clients.find((c) => c.id === agent.sitio)?.nombre ||
            'Sin puesto asignado'}{' '}
          · {fdate(reportDate())}
        </p>
        {can('portal', 'create') && (
          <Button className="mt-4" onClick={() => setOpen(true)}>
            Reportar incidente
          </Button>
        )}
        {message && (
          <p role="status" className="mt-3 text-sm text-accent">
            {message}
          </p>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 font-bold">Mis incidentes</h2>
        {!incidents.length && (
          <p className="text-sm text-muted">
            Aún no has registrado incidentes.
          </p>
        )}
        <div className="space-y-3">
          {incidents.map((i) => (
            <div key={i.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="mr-auto font-semibold">{i.titulo}</p>
                <Badge value={i.estado} />
                <Badge value={i.severidad} />
              </div>
              <p className="mt-2 text-xs text-muted">{fdate(i.fecha)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {i.descripcion}
              </p>
              {i.evidencia && (
                <img
                  className="mt-3 max-h-48 rounded-lg"
                  alt="Evidencia"
                  src={i.evidencia}
                />
              )}
            </div>
          ))}
        </div>
      </Card>
      {open && (
        <RecordForm
          cfg={cfg}
          data={data}
          record={{ fecha: reportDate() }}
          onClose={() => setOpen(false)}
          onSave={async (item) => {
            if (await submitIncident(item)) {
              setOpen(false)
              setMessage('Incidente registrado correctamente.')
            } else throw new Error('No se pudo registrar el incidente.')
          }}
        />
      )}
    </div>
  )
}
