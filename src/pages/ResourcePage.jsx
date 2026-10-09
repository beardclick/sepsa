import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownAZ, ArrowUpAZ, Plus, Search, Inbox, X } from 'lucide-react'
import { RESOURCES as R, money, titleOf } from '../config'
import { useStore } from '../store'
import { Button, Card, Modal } from '../components/ui'
import DataTable, { display } from '../components/DataTable'
import RecordForm from '../components/RecordForm'
import { DatePicker } from '../components/DateTimePicker'
import Pagination from '../components/Pagination'

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

// Valor comparable según el tipo de columna
const sortValue = (f, r, data) =>
  f.type === 'money' || f.type === 'number'
    ? Number(r[f.key]) || 0
    : f.type === 'date' || f.type === 'time'
      ? r[f.key] || ''
      : display(f, r[f.key], data)

export default function ResourcePage({ resKey }) {
  const cfg = R[resKey]
  const { data, add, update, remove, can } = useStore()
  const items = data[cfg.collection]
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState(null) // {} = nuevo
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [sort, setSort] = useState(null) // { key, dir }
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [searchOpen, setSearchOpen] = useState(false)
  const [slot, setSlot] = useState(null) // botón de agregar en la barra superior (móvil)
  useEffect(() => {
    setSlot(document.getElementById('header-actions'))
  }, [])

  const cols = cfg.fields.filter((f) => f.col)
  const dateField =
    cfg.dateRange && cfg.fields.find((f) => f.key === cfg.dateRange)
  // Click en encabezado: asc → desc → sin orden
  const toggleSort = (key) =>
    setSort((s) =>
      s?.key !== key
        ? { key, dir: 'asc' }
        : s.dir === 'asc'
          ? { key, dir: 'desc' }
          : null,
    )

  const filterField = cfg.fields.find((f) => f.key === cfg.filterKey)
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items.filter((r) => {
      if (category && r.categoria !== category) return false
      if (filter && r[cfg.filterKey] !== filter) return false
      if (dateField) {
        const d = r[dateField.key] || ''
        if (from && (!d || d < from)) return false
        if (to && (!d || d > to)) return false
      }
      if (!s) return true
      return cfg.fields.some((f) =>
        display(f, r[f.key], data).toLowerCase().includes(s),
      )
    })
  }, [items, q, filter, category, from, to, cfg, dateField, data])

  const sorted = useMemo(() => {
    if (!sort) return rows
    const f = cfg.fields.find((x) => x.key === sort.key)
    const m = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = sortValue(f, a, data),
        vb = sortValue(f, b, data)
      return (typeof va === 'number' ? va - vb : collator.compare(va, vb)) * m
    })
  }, [rows, sort, cfg, data])

  useEffect(() => {
    setPage(1)
  }, [q, filter, category, from, to, sort, size])
  const pages = Math.max(1, Math.ceil(sorted.length / size))
  const safePage = Math.min(page, pages)
  const pageRows = sorted.slice((safePage - 1) * size, safePage * size)
  const hasFilters = q || filter || category || from || to

  const moneyField = cfg.fields.find((f) => f.type === 'money')
  const stats = [
    { label: `Total ${cfg.title.toLowerCase()}`, value: items.length },
    {
      label: filterField.options[0],
      value: items.filter((r) => r[cfg.filterKey] === filterField.options[0])
        .length,
    },
    moneyField
      ? {
          label: `${moneyField.label} (total)`,
          value: money(
            items.reduce((s, r) => s + (Number(r[moneyField.key]) || 0), 0),
          ),
        }
      : {
          label: filterField.options[1],
          value: items.filter(
            (r) => r[cfg.filterKey] === filterField.options[1],
          ).length,
        },
  ]

  const save = async (vals) => {
    if (editing.id) await update(cfg.collection, editing.id, vals)
    else await add(cfg.collection, vals)
    setEditing(null)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="hidden text-sm text-muted sm:block">{cfg.subtitle}</p>
        <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
          <label className="relative col-span-2 block max-sm:hidden sm:min-w-56 sm:flex-1">
            <span className="mb-1 hidden text-xs font-semibold uppercase tracking-wider text-muted sm:block">
              Buscar
            </span>
            <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-muted" />
            <input
              className="input !pl-9"
              placeholder={`Buscar ${cfg.title.toLowerCase()}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          {dateField && (
            <>
              <label className="block sm:w-40">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Desde
                </span>
                <DatePicker
                  value={from}
                  max={to || undefined}
                  onChange={setFrom}
                  aria-label={`${dateField.label} desde`}
                />
              </label>
              <label className="block sm:w-40">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Hasta
                </span>
                <DatePicker
                  value={to}
                  min={from || undefined}
                  onChange={setTo}
                  aria-label={`${dateField.label} hasta`}
                />
              </label>
            </>
          )}
          <label className="col-span-2 block sm:w-48">
            <span className="mb-1 hidden text-xs font-semibold uppercase tracking-wider text-muted sm:block">
              {filterField.label}
            </span>
            <select
              className="input"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filtrar"
            >
              <option value="">{filterField.label}: todos</option>
              {filterField.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          {resKey === 'equipment' && (
            <label className="block sm:w-48">
              <span className="mb-1 block text-xs text-muted">Categoría</span>
              <select
                className="input"
                aria-label="Filtrar por categoría"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          {hasFilters && (
            <button
              onClick={() => {
                setQ('')
                setFilter('')
                setCategory('')
                setFrom('')
                setTo('')
              }}
              className="col-span-2 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2.5 text-sm font-semibold text-accent hover:underline cursor-pointer"
            >
              <X className="size-4" /> Limpiar
            </button>
          )}
          {can(resKey, 'create') && (
            <Button
              onClick={() => setEditing({})}
              className="max-sm:!hidden sm:w-auto"
            >
              <Plus className="size-4" /> Agregar {cfg.singular}
            </Button>
          )}
        </div>
      </div>

      {slot &&
        createPortal(
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Buscar"
              aria-expanded={searchOpen}
              className={`relative grid size-10 place-items-center rounded-lg border bg-card cursor-pointer ${searchOpen || q ? 'border-accent text-accent' : 'border-line'}`}
            >
              <Search className="size-5" />
              {q && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />
              )}
            </button>
            {can(resKey, 'create') && (
              <Button
                onClick={() => setEditing({})}
                className="!px-3.5 !py-2.5"
                aria-label={`Agregar ${cfg.singular}`}
              >
                <Plus className="size-4" />{' '}
                <span className="hidden min-[440px]:inline">Agregar</span>
              </Button>
            )}
          </div>,
          slot,
        )}
      {searchOpen &&
        createPortal(
          <div className="sm:hidden">
            <div
              className="fixed inset-0 z-40 anim-fade"
              onClick={() => setSearchOpen(false)}
            />
            <div className="anim-pop fixed inset-x-3 top-[68px] z-50 rounded-2xl border border-line bg-card p-3 shadow-2xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  className="input !pl-9 !pr-10"
                  placeholder={`Buscar ${cfg.title.toLowerCase()}…`}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) =>
                    (e.key === 'Enter' || e.key === 'Escape') &&
                    setSearchOpen(false)
                  }
                />
                {q && (
                  <button
                    onClick={() => setQ('')}
                    aria-label="Borrar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-fg cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <p className="mt-2 px-1 text-xs text-muted">
                {sorted.length} resultado{sorted.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>,
          document.body,
        )}

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 sm:p-4">
            <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted sm:text-xs">
              {s.label}
            </div>
            <div className="mt-1 truncate text-xl font-extrabold sm:text-2xl">
              {s.value}
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line p-3 md:hidden">
          {/* Orden (útil sobre todo en móvil, donde no hay encabezados) */}
          <div className="flex items-center gap-2 md:hidden">
            <select
              className="input"
              value={sort?.key || ''}
              aria-label="Ordenar por"
              onChange={(e) =>
                setSort(
                  e.target.value
                    ? { key: e.target.value, dir: sort?.dir || 'asc' }
                    : null,
                )
              }
            >
              <option value="">Sin orden</option>
              {cols.map((c) => (
                <option key={c.key} value={c.key}>
                  Ordenar: {c.label}
                </option>
              ))}
            </select>
            <button
              disabled={!sort}
              onClick={() =>
                setSort((s) => ({
                  ...s,
                  dir: s.dir === 'asc' ? 'desc' : 'asc',
                }))
              }
              aria-label="Invertir orden"
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-line hover:bg-soft disabled:opacity-40 cursor-pointer"
            >
              {sort?.dir === 'desc' ? (
                <ArrowUpAZ className="size-5" />
              ) : (
                <ArrowDownAZ className="size-5" />
              )}
            </button>
          </div>
        </div>

        {rows.length ? (
          <>
            <DataTable
              resKey={resKey}
              rows={pageRows}
              data={data}
              onEdit={can(resKey, 'update') ? setEditing : null}
              onDelete={can(resKey, 'delete') ? setDeleting : null}
              sort={sort}
              onSort={toggleSort}
            />
            <Pagination
              page={safePage}
              pageSize={size}
              total={sorted.length}
              onPage={setPage}
              onSize={setSize}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-muted">
            <Inbox className="size-10" />
            <p className="font-semibold text-fg">Sin resultados</p>
            <p className="text-sm">
              {items.length
                ? 'Prueba con otros filtros.'
                : `Aún no hay ${cfg.title.toLowerCase()} registrados.`}
            </p>
          </div>
        )}
      </Card>

      {editing && (
        <RecordForm
          cfg={cfg}
          record={editing}
          data={data}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <Modal
          size="max-w-md"
          title={`Eliminar ${cfg.singular}`}
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
                    await remove(cfg.collection, deleting.id)
                    setDeleting(null)
                    setDeleteError('')
                  } catch (error) {
                    setDeleteError(error.message)
                  }
                }}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm">
            ¿Seguro que deseas eliminar <b>{titleOf(resKey, deleting, data)}</b>
            ?
          </p>
          {deleteError && (
            <p role="alert" className="mt-3 text-sm text-red-500">
              {deleteError}
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
