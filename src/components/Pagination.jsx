import { ChevronLeft, ChevronRight } from 'lucide-react'

export const PAGE_SIZES = [5, 10, 25, 50]

function pageList(page, pages) {
  const set = new Set([1, pages, page, page - 1, page + 1])
  const list = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b)
  const out = []
  list.forEach((p, i) => {
    if (i && p - list[i - 1] > 1) out.push('…' + p)
    out.push(p)
  })
  return out
}

export default function Pagination({ page, pageSize, total, onPage, onSize, sizes = PAGE_SIZES }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(total, page * pageSize)
  const btn = 'grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line p-4 sm:justify-between">
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted">
        <span>{from}–{to} de {total}</span>
        {onSize && (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">Filas</span>
            <select className="input !w-auto !py-1.5" value={pageSize} onChange={(e) => onSize(Number(e.target.value))} aria-label="Filas por página">
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>
      {pages > 1 && (
        <nav className="flex max-w-full flex-wrap items-center justify-center gap-1" aria-label="Paginación">
          <button className={`${btn} border-line hover:bg-soft`} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></button>
          {pageList(page, pages).map((p) =>
            typeof p === 'string' ? (
              <span key={p} className="hidden px-1 text-muted sm:inline">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`${btn} ${p === page ? 'border-accent bg-accent text-accent-fg' : 'border-line hover:bg-soft'} ${p !== page && Math.abs(p - page) > 1 && p !== 1 && p !== pages ? 'hidden sm:grid' : ''}`}
              >{p}</button>
            ),
          )}
          <button className={`${btn} border-line hover:bg-soft`} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></button>
        </nav>
      )}
    </div>
  )
}
