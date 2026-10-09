import { Link } from '../nav'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Badge, Thumb } from './ui'
import { RESOURCES, money, fdate, ftime, titleOf } from '../config'

// Valor legible de un campo (resuelve referencias a otras colecciones)
export function display(field, value, data) {
  if (value === '' || value == null || field.type === 'image') return ''
  if (field.catalog === 'categories')
    return (
      data.categories.find((r) => r.id === value)?.nombre || 'Sin categoría'
    )
  if (field.type === 'pdf') return `${value.length} PDF`
  if (field.type === 'location') return 'Ubicación marcada en el mapa'
  if (field.type === 'time') return ftime(value)
  if (field.ref) {
    const cfg = Object.values(RESOURCES).find((r) => r.collection === field.ref)
    return data[field.ref]?.find((r) => r.id === value)?.[cfg.titleKey] ?? '—'
  }
  if (field.type === 'money') return money(value)
  if (field.type === 'date') return fdate(value)
  return String(value)
}

function Actions({ to, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      <Link
        to={to}
        aria-label="Ver detalles"
        title="Ver detalles"
        className="rounded-lg p-2 text-muted hover:bg-soft hover:text-fg"
      >
        <Eye className="size-4" />
      </Link>
      {onEdit && (
        <button
          onClick={onEdit}
          aria-label="Editar"
          className="rounded-lg p-2 text-muted hover:bg-soft hover:text-fg cursor-pointer"
        >
          <Pencil className="size-4" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label="Eliminar"
          className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}

export default function DataTable({
  resKey,
  rows,
  data,
  onEdit,
  onDelete,
  sort,
  onSort,
}) {
  const cfg = RESOURCES[resKey]
  const cols = cfg.fields.filter((f) => f.col)
  const [first, ...rest] = cols
  const href = (r) => `/${cfg.path}/${r.id}`

  const Cell = ({ field, row }) => {
    const v = display(field, row[field.key], data)
    if (field.badge) return <Badge value={v} />
    if (field === first) {
      return (
        <Link
          to={href(row)}
          className="flex items-center gap-3 hover:text-accent"
        >
          {cfg.imgKey && resKey !== 'incidents' && (
            <Thumb
              src={row[cfg.imgKey]}
              name={titleOf(resKey, row, data)}
              size="size-8"
              round={resKey === 'agents'}
            />
          )}
          <span className="min-w-0 break-words">{v || '—'}</span>
        </Link>
      )
    }
    return v || <span className="text-muted">—</span>
  }

  return (
    <>
      {/* Escritorio / tablet: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              {cols.map((c) => {
                const active = sort?.key === c.key
                const Arrow = !active
                  ? ChevronsUpDown
                  : sort.dir === 'asc'
                    ? ArrowUp
                    : ArrowDown
                return (
                  <th
                    key={c.key}
                    className="whitespace-nowrap px-4 py-3 font-semibold"
                    aria-sort={
                      active
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      onClick={() => onSort(c.key)}
                      className={`inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer hover:text-fg ${active ? 'text-fg' : ''}`}
                    >
                      {c.label}
                      <Arrow
                        className={`size-3.5 ${active ? 'text-accent' : 'opacity-50'}`}
                      />
                    </button>
                  </th>
                )
              })}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-line/60 last:border-0 hover:bg-soft/60"
              >
                {cols.map((c, i) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 ${i === 0 ? 'font-semibold' : 'text-fg/90'}`}
                  >
                    <Cell field={c} row={r} />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <Actions
                    to={href(r)}
                    onEdit={onEdit ? () => onEdit(r) : null}
                    onDelete={onDelete ? () => onDelete(r) : null}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: tarjetas */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 font-semibold">
                <Cell field={first} row={r} />
              </div>
              <Actions
                to={href(r)}
                onEdit={onEdit ? () => onEdit(r) : null}
                onDelete={onDelete ? () => onDelete(r) : null}
              />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {rest.map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-xs uppercase tracking-wider text-muted">
                    {c.label}
                  </dt>
                  <dd className="mt-0.5 break-words">
                    <Cell field={c} row={r} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
