import { useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Link, useNavigate } from '../nav'
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Trash2,
  MapPinOff,
} from 'lucide-react'
import { RESOURCES, detailPath, titleOf, money, ftime } from '../config'
import { useStore } from '../store'
import { Badge, Button, Card, Icon, Modal, Thumb } from '../components/ui'
import { display } from '../components/DataTable'
import ShiftPlanner from '../components/ShiftPlanner'
import RecordForm from '../components/RecordForm'
import AgentAccess from '../components/AgentAccess'
import MapView from '../components/MapView'
import { downloadPdf } from '../files'
import Pagination from '../components/Pagination'
import {
  agentPos,
  computeDuty,
  dayKey,
  fmtDur,
  initials,
  interval,
  parseDT,
  useNow,
} from '../duty'

const DAY = 86400000
const daysBetween = (a, b) => Math.round((b - a) / DAY)

function Stat({ label, value, tone }) {
  return (
    <div className="min-w-0 rounded-xl border border-line p-3 [overflow-wrap:anywhere]">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-lg font-extrabold ${tone === 'red' ? 'text-accent' : ''}`}
      >
        {value}
      </div>
    </div>
  )
}

function SideCard({ title, children }) {
  return (
    <Card className="min-w-0 p-4 [overflow-wrap:anywhere] sm:p-5">
      <h3 className="mb-3 font-bold">{title}</h3>
      {children}
    </Card>
  )
}

function MiniMap({ marker }) {
  if (!marker) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line py-8 text-center text-sm text-muted">
        <MapPinOff className="size-7" /> Sin coordenadas registradas.
      </div>
    )
  }
  return <MapView markers={[marker]} className="h-56" />
}

// Paneles laterales propios de cada tipo de registro
function Extras({ resKey, row, data, can }) {
  const now = useNow()
  const find = (col, id) => data[col].find((r) => r.id === id)
  const today = dayKey(now)

  if (resKey === 'agents') {
    const { onDuty, upcoming } = computeDuty(data, now)
    const cur = onDuty.find((d) => d.agent.id === row.id)
    const nxt = upcoming.find((u) => u.agent.id === row.id)
    const client = find('clients', row.sitio)

    const licDays = row.licencia
      ? daysBetween(parseDT(today), parseDT(row.licencia))
      : null
    return (
      <>
        <SideCard title="Estado actual">
          {cur ? (
            <div className="space-y-2 text-sm">
              <Badge value="En servicio" />
              <p>
                En turno en <b>{cur.client?.nombre}</b>. Termina a las{' '}
                {ftime(cur.shift.fin)} (<b>{fmtDur(cur.remaining)}</b>{' '}
                restantes).
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${cur.progress * 100}%` }}
                />
              </div>
            </div>
          ) : nxt ? (
            <p className="text-sm">
              Fuera de turno. Próximo turno en <b>{fmtDur(nxt.startsIn)}</b> (
              {nxt.client?.nombre}).
            </p>
          ) : (
            <p className="text-sm text-muted">
              Sin turnos próximos programados.
            </p>
          )}
          {licDays !== null && (
            <div className="mt-4">
              <Stat
                label="Licencia"
                value={
                  licDays < 0
                    ? `Vencida hace ${-licDays} d`
                    : `Vence en ${licDays} d`
                }
                tone={licDays < 30 ? 'red' : undefined}
              />
            </div>
          )}
        </SideCard>
      </>
    )
  }

  if (resKey === 'clients') {
    const act = data.contracts.filter(
      (c) => c.cliente === row.id && c.estado !== 'Vencido',
    )
    const lat = parseFloat(row.lat),
      lng = parseFloat(row.lng)
    return (
      <>
        <SideCard title="Resumen">
          <div className="grid grid-cols-2 gap-3">
            {can('contracts') && (
              <Stat label="Contratos activos" value={act.length} />
            )}
            {can('contracts') && (
              <Stat
                label="Valor de contratos"
                value={money(act.reduce((s, c) => s + c.valor, 0))}
              />
            )}
            {can('agents') && (
              <Stat
                label="Agentes"
                value={data.agents.filter((a) => a.sitio === row.id).length}
              />
            )}
          </div>
        </SideCard>
        <SideCard title="Ubicación del puesto">
          <MiniMap
            marker={
              Number.isFinite(lat) && Number.isFinite(lng)
                ? {
                    id: row.id,
                    kind: 'site',
                    lat,
                    lng,
                    title: row.nombre,
                    sub: row.ciudad || '',
                  }
                : null
            }
          />
        </SideCard>
      </>
    )
  }

  if (resKey === 'contracts' && row.inicio && row.fin) {
    const a = parseDT(row.inicio),
      b = parseDT(row.fin)
    const pct = Math.min(100, Math.max(0, ((now - a) / (b - a)) * 100))
    const left = daysBetween(parseDT(today), b)
    return (
      <SideCard title="Vigencia">
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-soft">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Días restantes"
            value={left < 0 ? 'Vencido' : left}
            tone={left < 30 ? 'red' : undefined}
          />
          <Stat label="Valor anual" value={money(row.valor * 12)} />
        </div>
      </SideCard>
    )
  }

  if (resKey === 'shifts') {
    const { start, end } = interval(row)
    const phase =
      row.estado !== 'Programado'
        ? row.estado
        : now < start
          ? `Inicia en ${fmtDur(start - now)}`
          : now < end
            ? `En curso · ${fmtDur(end - now)} restantes`
            : 'Finalizado'
    return (
      <SideCard title="Jornada">
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Duración"
            value={`${Math.round((end - start) / 3600000)} h`}
          />
          <Stat
            label="Estado"
            value={<span className="text-sm">{phase}</span>}
          />
        </div>
      </SideCard>
    )
  }

  if (resKey === 'incidents') {
    const ago = daysBetween(parseDT(row.fecha), parseDT(today))
    return (
      <>
        {row.evidencia && (
          <SideCard title="Evidencia">
            <img
              src={row.evidencia}
              alt="Evidencia del incidente"
              className="w-full rounded-xl border border-line object-cover"
            />
          </SideCard>
        )}
        <SideCard title="Seguimiento">
          <Stat
            label="Antigüedad"
            value={ago <= 0 ? 'Hoy' : `${ago} día${ago === 1 ? '' : 's'}`}
          />
        </SideCard>
      </>
    )
  }
  return null
}

function Related({ rel, row, resKey, data, navigationState }) {
  const { add, update, remove, can } = useStore()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [planning, setPlanning] = useState(false)
  const [planMessage, setPlanMessage] = useState('')
  const target = RESOURCES[rel.res]
  const key = rel.via ? row[rel.via] : row.id
  const items = useMemo(() => {
    const dateKey = target.fields.find((f) =>
      ['fecha', 'inicio'].includes(f.key),
    )?.key
    return data[target.collection]
      .filter(
        (r) => r[rel.by] === key && !(rel.res === resKey && r.id === row.id),
      )
      .sort((a, b) =>
        dateKey ? String(b[dateKey]).localeCompare(String(a[dateKey])) : 0,
      )
  }, [data, target, rel, key, row.id, resKey])

  const [page, setPage] = useState(1)
  const pageSize = 5
  const safe = Math.min(page, Math.max(1, Math.ceil(items.length / pageSize)))
  const badge = target.fields.find((f) => f.badge)
  const subFields = target.fields
    .filter(
      (f) =>
        f.col &&
        !f.badge &&
        f.key !== rel.by &&
        !(target.fields.find((x) => x.col) === f),
    )
    .slice(0, 3)

  const newRecord = () => {
    const defaults = { [rel.by]: key }
    if (target.fields.some((f) => f.key === 'fecha'))
      defaults.fecha = dayKey(new Date())
    if (resKey === 'agents' && target.fields.some((f) => f.key === 'cliente'))
      defaults.cliente = row.sitio || ''
    if (rel.res === 'equipment' && rel.by === 'asignado')
      defaults.estado = 'Asignado'
    setEditing(defaults)
  }
  return (
    <section aria-label={rel.title}>
      <Card className="min-w-0 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold">
            {rel.title}{' '}
            <span className="font-normal text-muted">({items.length})</span>
          </h3>
          {can(rel.res, 'create') && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={newRecord}>Agregar {target.singular}</Button>
              {resKey === 'agents' && rel.res === 'shifts' && (
                <Button variant="ghost" onClick={() => setPlanning(true)}>
                  Programar semanas
                </Button>
              )}
            </div>
          )}
        </div>
        {planMessage && (
          <p role="status" className="mb-3 text-sm text-accent">
            {planMessage}
          </p>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted">Sin registros.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.slice((safe - 1) * pageSize, safe * pageSize).map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Link
                  to={`/${target.path}/${r.id}`}
                  state={navigationState}
                  className="-mx-2 min-w-0 flex-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2.5 hover:bg-soft sm:flex"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                    {target.imgKey && (
                      <Thumb
                        src={r[target.imgKey]}
                        name={titleOf(rel.res, r, data)}
                        size="size-9"
                        round={rel.res === 'agents'}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold [overflow-wrap:anywhere]">
                        {titleOf(rel.res, r, data)}
                      </div>
                      <div className="text-xs text-muted [overflow-wrap:anywhere]">
                        {subFields
                          .map((f) => display(f, r[f.key], data))
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </div>
                  {badge && (
                    <div className="col-start-1 row-start-2 sm:shrink-0">
                      <Badge value={r[badge.key]} />
                    </div>
                  )}
                  <ChevronRight className="col-start-2 row-start-1 size-4 shrink-0 text-muted" />
                </Link>
                {can(rel.res, 'update') && (
                  <button
                    type="button"
                    aria-label={`Editar ${target.singular} ${titleOf(rel.res, r, data)}`}
                    className="shrink-0 rounded-lg p-2 text-muted hover:bg-soft hover:text-fg"
                    onClick={() => setEditing(r)}
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {items.length > pageSize && (
          <div className="-mx-4 -mb-4 mt-3 sm:-mx-5 sm:-mb-5">
            <Pagination
              page={safe}
              pageSize={pageSize}
              total={items.length}
              onPage={setPage}
            />
          </div>
        )}
      </Card>
      {planning && (
        <ShiftPlanner
          initialAgent={row.id}
          initialClient={row.sitio}
          onClose={() => setPlanning(false)}
          onCreated={(result) =>
            setPlanMessage(
              `${result.created} turnos creados${result.skipped ? `; ${result.skipped} omitidos por conflicto` : ''}.`,
            )
          }
        />
      )}
      {editing && (
        <RecordForm
          cfg={target}
          record={editing}
          data={data}
          lockedFields={editing.id ? [] : [rel.by]}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            if (editing.id) await update(target.collection, editing.id, values)
            else await add(target.collection, { ...values, [rel.by]: key })
            setEditing(null)
          }}
          onDelete={
            can(rel.res, 'delete')
              ? (item) => {
                  setEditing(null)
                  setDeleting(item)
                }
              : undefined
          }
        />
      )}
      {deleting && (
        <Modal
          size="max-w-md"
          title={`Eliminar ${target.singular}`}
          subtitle="Esta acción no se puede deshacer."
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await remove(target.collection, deleting.id)
                    setDeleting(null)
                  } catch (error) {
                    setPlanMessage(error.message)
                  }
                }}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <p>
            ¿Seguro que deseas eliminar{' '}
            <b>{titleOf(rel.res, deleting, data)}</b>?
          </p>
        </Modal>
      )}
    </section>
  )
}

export default function DetailPage({ resKey }) {
  const cfg = RESOURCES[resKey]
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { data, update, remove, can } = useStore()
  const [fileError, setFileError] = useState('')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const row = data[cfg.collection].find((r) => r.id === id)
  const trail = (
    Array.isArray(location.state?.detailTrail) ? location.state.detailTrail : []
  ).filter((entry) => {
    const source = RESOURCES[entry?.resKey]
    return (
      source &&
      can(entry.resKey) &&
      data[source.collection].some((r) => r.id === entry.id)
    )
  })
  const origin = trail.at(-1)
  const backPath = origin
    ? detailPath(RESOURCES[origin.resKey].collection, origin.id)
    : `/${cfg.path}`
  const backLabel = origin
    ? titleOf(
        origin.resKey,
        data[RESOURCES[origin.resKey].collection].find(
          (r) => r.id === origin.id,
        ),
        data,
      )
    : cfg.title
  const backState = { detailTrail: trail.slice(0, -1) }
  const navigationState = {
    detailTrail: [...trail, { resKey, id }].slice(-10),
  }
  const closeEditing = () => {
    setEditing(false)
    if (origin) navigate(backPath, { state: backState })
  }

  if (!row) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <p className="font-bold">Registro no encontrado</p>
        <p className="mt-1 text-sm text-muted">
          Puede que haya sido eliminado.
        </p>
        <Link
          to={backPath}
          state={backState}
          className="mt-4 inline-block font-semibold text-accent hover:underline"
        >
          Volver a {backLabel}
        </Link>
      </Card>
    )
  }

  const title = titleOf(resKey, row, data)
  const badges = cfg.fields
    .filter((f) => f.badge)
    .map((f) => row[f.key])
    .filter(Boolean)
  const subtitle = cfg.fields
    .filter((f) => f.col && !f.badge)
    .slice(1, 3)
    .map((f) => display(f, row[f.key], data))
    .filter(Boolean)
    .join(' · ')
  const info = cfg.fields.filter(
    (f) => !f.createOnly && !['image', 'coord', 'location'].includes(f.type),
  )
  const lat = row.lat,
    lng = row.lng

  const renderValue = (f) => {
    const v = row[f.key]
    if (v === '' || v == null) return <span className="text-muted">—</span>
    if (f.type === 'pdf')
      return (
        <div className="space-y-2">
          {(v || []).map((file) => (
            <button
              key={file.id}
              className="block text-accent hover:underline"
              onClick={() =>
                downloadPdf(file).catch((e) => setFileError(e.message))
              }
            >
              {file.nombre}
            </button>
          ))}
        </div>
      )
    if (f.badge) return <Badge value={v} />
    if (f.ref) {
      const target = data[f.ref].find((r) => r.id === v)
      return target ? (
        <Link
          to={detailPath(f.ref, v)}
          state={navigationState}
          className="font-semibold text-accent hover:underline"
        >
          {display(f, v, data)}
        </Link>
      ) : (
        '—'
      )
    }
    if (f.type === 'tel')
      return (
        <a href={`tel:${v}`} className="hover:text-accent">
          {v}
        </a>
      )
    if (f.type === 'email')
      return (
        <a href={`mailto:${v}`} className="break-all hover:text-accent">
          {v}
        </a>
      )
    return <span className="break-words">{display(f, v, data)}</span>
  }

  return (
    <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={backPath}
          state={backState}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4 shrink-0" /> Volver a {backLabel}
        </Link>
        {/* Móvil: acciones compactas junto al enlace de volver */}
        <div className="flex shrink-0 gap-2 sm:hidden">
          {can(resKey, 'update') && (
            <button
              onClick={() => setEditing(true)}
              aria-label="Editar"
              className="grid size-10 place-items-center rounded-lg border border-line bg-card cursor-pointer"
            >
              <Pencil className="size-[18px]" />
            </button>
          )}
          {can(resKey, 'delete') && (
            <button
              onClick={() => setDeleting(true)}
              aria-label="Eliminar"
              className="grid size-10 place-items-center rounded-lg border border-line bg-card text-red-500 cursor-pointer"
            >
              <Trash2 className="size-[18px]" />
            </button>
          )}
        </div>
      </div>

      {resKey === 'agents' && <AgentAccess key={row.id} agent={row} />}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center">
          {cfg.imgKey && resKey !== 'incidents' ? (
            <Thumb
              src={row[cfg.imgKey]}
              name={title}
              size="size-24 sm:size-28"
              round={resKey === 'agents'}
              text="text-3xl"
            />
          ) : (
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Icon name={cfg.icon} className="size-8" />
            </div>
          )}
          <div className="min-w-0 flex-1 sm:basis-48">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              {cfg.singular}
            </div>
            <h2 className="break-words font-display text-2xl font-extrabold">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
            {badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {badges.map((b) => (
                  <Badge key={b} value={b} />
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 max-sm:hidden">
            {can(resKey, 'update') && (
              <Button
                variant="ghost"
                onClick={() => setEditing(true)}
                className="flex-1 sm:flex-none"
              >
                <Pencil className="size-4" /> Editar
              </Button>
            )}
            {can(resKey, 'delete') && (
              <Button
                variant="ghost"
                onClick={() => setDeleting(true)}
                className="flex-1 !text-red-500 sm:flex-none"
              >
                <Trash2 className="size-4" /> Eliminar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Card className="min-w-0 p-4 sm:p-5">
            <h3 className="mb-4 font-bold">Información</h3>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {info.map((f) => (
                <div
                  key={f.key}
                  className={`min-w-0 ${f.type === 'textarea' || f.full ? 'sm:col-span-2' : ''}`}
                >
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {f.label}
                  </dt>
                  <dd className="mt-1 text-sm">{renderValue(f)}</dd>
                </div>
              ))}
              {resKey !== 'clients' &&
                resKey !== 'agents' &&
                lat !== undefined &&
                lat !== '' && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Coordenadas
                    </dt>
                    <dd className="mt-1 text-sm">
                      {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                    </dd>
                  </div>
                )}
            </dl>
          </Card>
          {(cfg.related || [])
            .filter((rel) => can(rel.res))
            .map((rel) => (
              <Related
                key={rel.title}
                rel={rel}
                row={row}
                resKey={resKey}
                data={data}
                navigationState={navigationState}
              />
            ))}
        </div>
        <div className="min-w-0 space-y-5">
          <Extras resKey={resKey} row={row} data={data} can={can} />
        </div>
      </div>

      {fileError && (
        <p role="alert" className="text-sm text-red-500">
          {fileError}
        </p>
      )}
      {editing && (
        <RecordForm
          cfg={cfg}
          record={row}
          data={data}
          onClose={closeEditing}
          onSave={async (vals) => {
            await update(cfg.collection, row.id, vals)
            closeEditing()
          }}
          onDelete={
            can(resKey, 'delete')
              ? () => {
                  setEditing(false)
                  setDeleting(true)
                }
              : undefined
          }
        />
      )}
      {deleting && (
        <Modal
          size="max-w-md"
          title={`Eliminar ${cfg.singular}`}
          subtitle="Esta acción no se puede deshacer."
          onClose={() => setDeleting(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await remove(cfg.collection, row.id)
                    setDeleting(false)
                    navigate(backPath, { state: backState })
                  } catch (error) {
                    setFileError(error.message)
                    setDeleting(false)
                  }
                }}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm">
            ¿Seguro que deseas eliminar <b>{title}</b>?
          </p>
        </Modal>
      )}
    </div>
  )
}
