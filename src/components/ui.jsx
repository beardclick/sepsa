import { useEffect } from 'react'
import {
  Building2,
  UserRound,
  FileSignature,
  CalendarClock,
  ShieldAlert,
  Target,
  FileText,
  Users,
  Radio,
  LayoutDashboard,
  Settings,
  X,
  CalendarDays,
  MapPin,
} from 'lucide-react'
import { toneOf } from '../config'
import { initials } from '../duty'

const ICONS = {
  Building2,
  UserRound,
  FileSignature,
  CalendarClock,
  ShieldAlert,
  Target,
  FileText,
  Users,
  Radio,
  LayoutDashboard,
  Settings,
  CalendarDays,
  MapPin,
}
export const Icon = ({ name, ...p }) => {
  const C = ICONS[name] || LayoutDashboard
  return <C {...p} />
}

const TONE_CLS = {
  green:
    'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-emerald-500/25',
  amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-amber-500/25',
  red: 'bg-red-500/12 text-red-700 dark:text-red-400 ring-red-500/30',
  gray: 'bg-soft text-muted ring-line',
}

export function Badge({ value }) {
  if (!value) return <span className="text-muted">—</span>
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${TONE_CLS[toneOf(value)]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {value}
    </span>
  )
}

export const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-line bg-card ${className}`}>
    {children}
  </div>
)

export function Button({ variant = 'primary', className = '', ...p }) {
  const v = {
    primary: 'bg-accent text-accent-fg hover:opacity-90',
    ghost: 'border border-line bg-card text-fg hover:bg-soft',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant]
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${v} ${className}`}
    />
  )
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'max-w-2xl',
}) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm anim-fade"
        onClick={onClose}
      />
      <div
        className={`anim-pop relative flex max-h-[92dvh] w-full ${size} flex-col rounded-t-3xl sm:rounded-2xl border border-line bg-card shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-fg cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Foto / logo con respaldo de iniciales
export function Thumb({
  src,
  name = '',
  size = 'size-10',
  round = true,
  text = 'text-xs',
}) {
  const shape = round ? 'rounded-full' : 'rounded-xl'
  return src ? (
    <img
      src={src}
      alt={name}
      className={`${size} ${shape} shrink-0 object-cover ring-1 ring-line`}
    />
  ) : (
    <div
      className={`${size} ${shape} ${text} grid shrink-0 place-items-center bg-accent-soft font-bold text-accent`}
    >
      {initials(name)}
    </div>
  )
}
