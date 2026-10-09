import { useMemo } from 'react'
import { Link } from '../nav'
import {
  ShieldAlert,
  UserCheck,
  Clock4,
  FileSignature,
  ArrowUpRight,
  TriangleAlert,
} from 'lucide-react'
import { useStore } from '../store'
import { Badge, Card } from '../components/ui'
import { Donut, BarList } from '../components/Charts'
import { OnDutyRow, UpcomingRow, Empty } from '../components/Duty'
import { computeDuty, dayKey, useNow } from '../duty'
import { money, fdate, detailPath } from '../config'

const COLUMN_CLASSES = [
  '',
  'lg:grid-cols-1',
  'lg:grid-cols-2',
  'lg:grid-cols-3',
]
const PANEL_CLASS = 'flex h-[460px] min-w-0 flex-col overflow-hidden p-4 sm:p-5'
const SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1'

const RANK = { Crítica: 0, Alta: 1, Media: 2, Baja: 3 }

function Kpi({ icon: I, label, value, note, to, hot }) {
  return (
    <Link to={to} className="group block min-w-0">
      {/* Móvil: una sola línea angosta. sm+: tarjeta completa */}
      <Card
        className={`flex min-w-0 items-center gap-3 px-3 py-2.5 transition group-hover:border-accent sm:block sm:p-5 ${hot ? 'border-accent/50' : ''}`}
      >
        <div className="flex shrink-0 items-start justify-between">
          <div className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent sm:size-10 sm:rounded-xl">
            <I className="size-4 sm:size-5" />
          </div>
          <ArrowUpRight className="hidden size-4 text-muted transition group-hover:text-accent sm:block" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:block">
          <div className="truncate text-xs font-semibold uppercase tracking-wider text-muted sm:mt-4">
            {label}
          </div>
          <div className="whitespace-nowrap font-display text-lg font-extrabold sm:mt-1 sm:text-3xl">
            {value}
          </div>
        </div>
        <div className="mt-1 hidden text-xs text-muted sm:block">{note}</div>
      </Card>
    </Link>
  )
}

const Title = ({ children, sub, to, right }) => (
  <div className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
    <div className="min-w-0 flex-1 basis-40">
      <h2 className="font-bold">{children}</h2>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
    {right}
    {to && (
      <Link
        to={to}
        className="shrink-0 text-sm font-semibold text-accent hover:underline"
      >
        Ver todo
      </Link>
    )}
  </div>
)

const ago = (fecha) => {
  const [y, m, d] = fecha.split('-').map(Number)
  const n = Math.round(
    (new Date().setHours(0, 0, 0, 0) - new Date(y, m - 1, d)) / 86400000,
  )
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} d`
}

export default function Dashboard() {
  const { data, can } = useStore()
  const now = useNow()
  const { agents, contracts, incidents, leads } = data
  const name = (col, id) => data[col].find((r) => r.id === id)

  const { onDuty, upcoming } = useMemo(
    () => computeDuty(data, now),
    [data, now],
  )
  const topColumns = (can('shifts') ? 2 : 0) + (can('incidents') ? 1 : 0)
  const bottomColumns = [can('incidents'), can('agents'), can('leads')].filter(
    Boolean,
  ).length
  const next48 = upcoming.filter((u) => u.startsIn <= 48 * 3600000)

  const openInc = incidents
    .filter((i) => i.estado !== 'Resuelto')
    .sort(
      (a, b) =>
        RANK[a.severidad] - RANK[b.severidad] || b.fecha.localeCompare(a.fecha),
    )
  const urgent = openInc.filter(
    (i) => i.severidad === 'Crítica' || i.severidad === 'Alta',
  ).length
  const today = dayKey(now)
  const expiring = agents.filter(
    (a) =>
      a.licencia &&
      a.licencia <= dayKey(new Date(now.getTime() + 30 * 86400000)),
  )

  const sev = [
    ['Crítica', 'var(--c1)'],
    ['Alta', 'var(--c2)'],
    ['Media', 'var(--c3)'],
    ['Baja', 'var(--c4)'],
  ].map(([label, color]) => ({
    label,
    color,
    value: incidents.filter((i) => i.severidad === label).length,
  }))
  const stages = [
    'Nuevo',
    'Contactado',
    'Cotizado',
    'Negociación',
    'Ganado',
  ].map((label, i) => ({
    label,
    color: `var(--c${Math.min(i + 1, 4)})`,
    value: leads
      .filter((l) => l.etapa === label)
      .reduce((s, l) => s + (Number(l.valor) || 0), 0),
  }))

  return (
    <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <div>
        <h2 className="font-display text-2xl font-extrabold">
          Centro de operaciones
        </h2>
        <p className="text-sm text-muted">
          Incidentes, turnos y personal en servicio en tiempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {can('incidents') && (
          <Kpi
            icon={ShieldAlert}
            label="Incidentes abiertos"
            value={openInc.length}
            note={`${urgent} alta/crítica`}
            to="/incidentes"
            hot={urgent > 0}
          />
        )}
        {can('agents') && (
          <Kpi
            icon={UserCheck}
            label="Agentes en turno"
            value={onDuty.length}
            note={`de ${agents.filter((a) => a.estado === 'Activo').length} agentes activos`}
            to="/agentes"
          />
        )}
        {can('shifts') && (
          <Kpi
            icon={Clock4}
            label="Por entrar (48 h)"
            value={next48.length}
            note={
              next48[0]
                ? `Próximo: ${next48[0].agent.nombre}`
                : 'Sin turnos próximos'
            }
            to="/calendario"
          />
        )}
        {can('contracts') && (
          <Kpi
            icon={FileSignature}
            label="Contratos activos"
            value={contracts.filter((c) => c.estado !== 'Vencido').length}
            note={`${contracts.filter((c) => c.estado !== 'Vencido').length} contratos activos`}
            to="/contratos"
          />
        )}
      </div>

      {topColumns > 0 && (
        <div className={`grid grid-cols-1 gap-4 ${COLUMN_CLASSES[topColumns]}`}>
          {can('shifts') && (
            <Card className={PANEL_CLASS}>
              <Title sub="Tiempo restante de jornada" to="/calendario">
                Agentes en turno
              </Title>
              <ul
                aria-label="Agentes en turno"
                tabIndex={0}
                className={`${SCROLL_CLASS} space-y-2.5`}
              >
                {!onDuty.length && (
                  <Empty>Nadie en turno en este momento.</Empty>
                )}
                {onDuty.map((d) => (
                  <OnDutyRow
                    key={d.shift.id}
                    item={d}
                    to={detailPath('agents', d.agent.id)}
                  />
                ))}
              </ul>
            </Card>
          )}
          {can('shifts') && (
            <Card className={PANEL_CLASS}>
              <Title sub="Próximas 48 horas" to="/calendario">
                Agentes por entrar
              </Title>
              <ul
                aria-label="Agentes por entrar"
                tabIndex={0}
                className={`${SCROLL_CLASS} space-y-2.5`}
              >
                {!next48.length && (
                  <Empty>No hay turnos en las próximas 48 horas.</Empty>
                )}
                {next48.map((u) => (
                  <UpcomingRow
                    key={u.shift.id}
                    item={u}
                    now={now}
                    to={detailPath('agents', u.agent.id)}
                  />
                ))}
              </ul>
            </Card>
          )}
          {can('incidents') && (
            <Card className={PANEL_CLASS}>
              <Title sub="Ordenados por severidad" to="/incidentes">
                Incidentes activos
              </Title>
              <ul
                aria-label="Incidentes activos"
                tabIndex={0}
                className={`${SCROLL_CLASS} space-y-2.5`}
              >
                {!openInc.length && (
                  <Empty>Sin incidentes abiertos. ¡Todo en orden!</Empty>
                )}
                {openInc.map((i) => (
                  <li key={i.id}>
                    <Link
                      to={detailPath('incidents', i.id)}
                      className="flex items-start gap-3 rounded-xl border border-line p-3 hover:bg-soft"
                    >
                      <span
                        className={`mt-1 h-10 w-1 shrink-0 rounded-full ${['Crítica', 'Alta'].includes(i.severidad) ? 'bg-accent' : 'bg-line'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{i.titulo}</p>
                        <p className="mt-1 text-xs text-muted">
                          {name('clients', i.cliente)?.nombre || '—'} ·{' '}
                          {name('agents', i.agente)?.nombre || 'Sin agente'} ·{' '}
                          {ago(i.fecha)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge value={i.severidad} />
                          <Badge value={i.estado} />
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {bottomColumns > 0 && (
        <div
          className={`grid grid-cols-1 gap-4 ${COLUMN_CLASSES[bottomColumns]}`}
        >
          {can('incidents') && (
            <Card className={PANEL_CLASS}>
              <Title sub="Por severidad">Incidentes</Title>
              <div
                className={`${SCROLL_CLASS} flex flex-col items-center gap-4`}
              >
                <Donut data={sev} center={incidents.length} sub="TOTAL" />
                <ul className="w-full space-y-2.5 text-sm">
                  {sev.map((s) => (
                    <li
                      key={s.label}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-sm"
                          style={{ background: s.color }}
                        />
                        {s.label}
                      </span>
                      <span className="font-semibold">{s.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}
          {can('agents') && (
            <Card
              className={`${PANEL_CLASS} ${expiring.length ? 'border-accent/40' : ''}`}
            >
              <Title
                sub="Licencias vencidas o por vencer en 30 días"
                to="/agentes"
              >
                <span className="flex items-center gap-2">
                  <TriangleAlert className="size-5 shrink-0 text-accent" />
                  Requiere atención
                </span>
              </Title>
              <ul
                aria-label="Alertas de licencias"
                tabIndex={0}
                className={`${SCROLL_CLASS} space-y-2.5 text-sm`}
              >
                {!expiring.length && (
                  <Empty>Sin alertas pendientes de licencias.</Empty>
                )}
                {expiring.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={detailPath('agents', a.id)}
                      className="block rounded-xl border border-line p-3 hover:bg-soft"
                    >
                      <p className="font-semibold">{a.nombre}</p>
                      <p className="mt-1 text-xs text-muted">
                        Licencia {a.licencia < today ? 'venció' : 'vence'} el{' '}
                        {fdate(a.licencia)}.
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {can('leads') && (
            <Card className={PANEL_CLASS}>
              <Title sub="Valor estimado por etapa" to="/prospectos">
                Embudo comercial
              </Title>
              <div
                tabIndex={0}
                aria-label="Embudo comercial por etapa"
                className={SCROLL_CLASS}
              >
                <BarList data={stages} format={money} />
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
