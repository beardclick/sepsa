import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { fdate } from '../config'
const keyOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function DatePicker({
  value = '',
  onChange,
  id,
  min,
  max,
  'aria-label': label,
}) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() =>
    value ? new Date(`${value}T12:00:00`) : new Date(),
  )
  const y = cursor.getFullYear(),
    m = cursor.getMonth(),
    offset = (new Date(y, m, 1).getDay() + 6) % 7
  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="input flex items-center justify-between gap-2 text-left cursor-pointer"
      >
        <span>{value ? fdate(value) : 'dd/mm/aa'}</span>
        <CalendarDays className="size-4 text-accent" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar calendario"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[80vw] rounded-2xl border border-line bg-card p-3 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => setCursor(new Date(y, m - 1, 1))}
              >
                <ChevronLeft className="size-4" />
              </button>
              <select
                aria-label="Mes"
                className="input !p-1"
                value={m}
                onChange={(e) =>
                  setCursor(new Date(y, Number(e.target.value), 1))
                }
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(2026, i, 1).toLocaleDateString('es', {
                      month: 'long',
                    })}
                  </option>
                ))}
              </select>
              <input
                type="number"
                aria-label="Año"
                className="input !w-20 !p-1"
                min="1900"
                max="2100"
                value={y}
                onChange={(e) => {
                  const year = Number(e.target.value)
                  if (year >= 1900 && year <= 2100)
                    setCursor(new Date(year, m, 1))
                }}
              />
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => setCursor(new Date(y, m + 1, 1))}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <span key={i} className="py-1 text-muted">
                  {d}
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`s${i}`} />
              ))}
              {Array.from(
                { length: new Date(y, m + 1, 0).getDate() },
                (_, i) => {
                  const key = keyOf(new Date(y, m, i + 1))
                  return (
                    <button
                      type="button"
                      key={key}
                      aria-label={fdate(key)}
                      disabled={!!((min && key < min) || (max && key > max))}
                      className={`rounded-lg py-2 hover:bg-accent-soft disabled:opacity-30 ${key === value ? 'bg-accent text-white' : ''}`}
                      onClick={() => {
                        onChange(key)
                        setOpen(false)
                      }}
                    >
                      {i + 1}
                    </button>
                  )
                },
              )}
            </div>
            <div className="mt-3 flex justify-between text-xs font-semibold text-accent">
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                Limpiar
              </button>
              <button
                type="button"
                disabled={
                  !!(
                    (min && keyOf(new Date()) < min) ||
                    (max && keyOf(new Date()) > max)
                  )
                }
                onClick={() => {
                  onChange(keyOf(new Date()))
                  setOpen(false)
                }}
              >
                Hoy
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
export function TimePicker({ value, onChange, id }) {
  const [h, m] = (value || '06:00').split(':').map(Number)
  const change = (hour, minute, period) =>
    onChange(
      `${String((hour % 12) + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    )
  return (
    <div className="grid w-full min-w-[190px] grid-cols-[16px_minmax(48px,1fr)_8px_minmax(48px,1fr)_minmax(60px,1.2fr)] items-center gap-1 rounded-xl border border-line bg-soft p-1">
      <Clock3 className="size-4 shrink-0 text-accent" />
      <select
        id={id}
        aria-label="Hora"
        className="input min-w-0 !border-0 !py-2 !pl-2 !pr-5 tabular-nums"
        value={h % 12 || 12}
        onChange={(e) =>
          change(Number(e.target.value), m, h < 12 ? 'AM' : 'PM')
        }
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i + 1}>
            {String(i + 1).padStart(2, '0')}
          </option>
        ))}
      </select>
      <span>:</span>
      <select
        aria-label="Minutos"
        className="input min-w-0 !border-0 !py-2 !pl-2 !pr-5 tabular-nums"
        value={m}
        onChange={(e) =>
          change(h % 12 || 12, Number(e.target.value), h < 12 ? 'AM' : 'PM')
        }
      >
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>
            {String(i).padStart(2, '0')}
          </option>
        ))}
      </select>
      <select
        aria-label="AM o PM"
        className="input min-w-0 !border-0 !py-2 !pl-2 !pr-5 tabular-nums"
        value={h < 12 ? 'AM' : 'PM'}
        onChange={(e) => change(h % 12 || 12, m, e.target.value)}
      >
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  )
}
