import { Link } from '../nav'
import { ftime } from '../config'
import { fmtDur } from '../duty'
import { Thumb } from './ui'

const hhmm = (d) =>
  d.toLocaleTimeString('es-PA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
const dayLabel = (d, now) => {
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
      new Date(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000,
  )
  return diff === 0
    ? 'Hoy'
    : diff === 1
      ? 'Mañana'
      : d.toLocaleDateString('es-PA', { day: '2-digit', month: 'short' })
}

const Wrap = ({ to, ...p }) =>
  to ? <Link to={to} {...p} /> : <button {...p} />

const Avatar = ({ agent }) => (
  <Thumb src={agent.foto} name={agent.nombre} size="size-9" />
)

export function OnDutyRow({ item, onClick, active, to }) {
  const { agent, client, shift, end, remaining, progress } = item
  const low = remaining < 3600000
  return (
    <li>
      <Wrap
        to={to}
        onClick={onClick}
        className={`block w-full rounded-xl border p-3 text-left transition ${active ? 'border-accent bg-accent-soft' : 'border-line hover:bg-soft'} ${onClick || to ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:flex">
          <Avatar agent={agent} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold [overflow-wrap:anywhere]">
              {agent.nombre}
            </div>
            <div className="text-xs text-muted [overflow-wrap:anywhere]">
              {agent.cargo} · {client?.nombre || 'Sin puesto'}
            </div>
          </div>
          <div className="col-span-2 min-w-0 sm:shrink-0 sm:text-right">
            <div className={`text-sm font-bold ${low ? 'text-accent' : ''}`}>
              {fmtDur(remaining)}
            </div>
            <div className="text-[11px] text-muted">restante</div>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-soft">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>
            {ftime(shift.inicio)} – {ftime(shift.fin)} · {shift.tipo}
          </span>
          <span>termina {hhmm(end)}</span>
        </div>
      </Wrap>
    </li>
  )
}

export function UpcomingRow({ item, now, to }) {
  const { agent, client, shift, start, startsIn } = item
  return (
    <li>
      <Wrap
        to={to}
        className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-xl border border-line p-3 text-left hover:bg-soft sm:flex"
      >
        <Avatar agent={agent} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold [overflow-wrap:anywhere]">
            {agent.nombre}
          </div>
          <div className="text-xs text-muted [overflow-wrap:anywhere]">
            {client?.nombre || 'Sin puesto'} · {shift.tipo}
          </div>
        </div>
        <div className="col-span-2 min-w-0 sm:shrink-0 sm:text-right">
          <div className="text-sm font-bold">en {fmtDur(startsIn)}</div>
          <div className="text-[11px] text-muted">
            {dayLabel(start, now)} {ftime(shift.inicio)}
          </div>
        </div>
      </Wrap>
    </li>
  )
}

export const Empty = ({ children }) => (
  <li className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
    {children}
  </li>
)
