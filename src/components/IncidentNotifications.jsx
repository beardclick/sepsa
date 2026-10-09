import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Bell, ShieldAlert, X } from 'lucide-react'
import { useStore } from '../store'
import { Link } from '../nav'
import { Badge } from './ui'

const noticeTime = (value) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Panama',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))

function IncidentToast({ notice, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notice.id), 8000)
    return () => clearTimeout(timer)
  }, [notice.id, onDismiss])
  return (
    <div
      role="status"
      className="anim-pop pointer-events-auto rounded-2xl border border-line border-l-4 border-l-accent bg-card p-4 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 size-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Nuevo incidente</p>
          <time dateTime={notice.createdAt} className="text-xs text-muted">
            {noticeTime(notice.createdAt)}
          </time>
          <p className="mt-1 break-words text-sm">{notice.titulo}</p>
          {notice.site && (
            <p className="mt-1 text-xs text-muted">{notice.site}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            <Badge value={notice.severidad} />
            <Link
              to={notice.to}
              onClick={() => onDismiss(notice.id)}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Ver incidente
            </Link>
          </div>
        </div>
        <button
          aria-label="Cerrar notificación"
          className="rounded-lg p-1 text-muted hover:bg-soft"
          onClick={() => onDismiss(notice.id)}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

export default function IncidentNotifications({ onUnseenChange } = {}) {
  const { pathname } = useLocation()
  const viewingIncidents =
    pathname === '/incidentes' || pathname.startsWith('/incidentes/')
  const { data, user, can, incidentsReady = true } = useStore()
  const previous = useRef({
    userId: user?.id,
    ids: new Set(data.incidents.map((i) => i.id)),
    ready: incidentsReady,
  })
  const [notices, setNotices] = useState([]),
    [toastIds, setToastIds] = useState([]),
    [open, setOpen] = useState(false)
  const visible = can('incidents') && user?.role !== 'agent'
  useEffect(() => {
    const ids = new Set(data.incidents.map((i) => i.id))
    if (
      previous.current.userId !== user?.id ||
      !incidentsReady ||
      !previous.current.ready
    ) {
      previous.current = { userId: user?.id, ids, ready: incidentsReady }
      setNotices([])
      setToastIds([])
      setOpen(false)
      return
    }
    const added = data.incidents.filter(
      (i) =>
        !previous.current.ids.has(i.id) &&
        visible &&
        i.createdBy !== user?.id &&
        !i.imported,
    )
    previous.current.ids = ids
    if (!added.length) return
    const fresh = added.map((i) => ({
      id: i.id,
      titulo: i.titulo,
      severidad: i.severidad,
      site:
        i.clienteNombre || data.clients.find((c) => c.id === i.cliente)?.nombre,
      to: can('incidents') ? `/incidentes/${i.id}` : '/portal-agente',
      unread: true,
      unseen: !viewingIncidents,
      createdAt: i.createdAt || new Date().toISOString(),
    }))
    setNotices((current) => [...fresh, ...current].slice(0, 30))
    setToastIds((current) =>
      [...fresh.map((i) => i.id), ...current].slice(0, 3),
    )
  }, [
    data.incidents, user?.id, user?.agent, visible, can, incidentsReady, viewingIncidents,
  ])
  // Al cambiar de permisos, se retiran los avisos que ya no puede ver el usuario.
  const allowedNotices = notices.filter((n) =>
    data.incidents.some((i) => i.id === n.id && visible),
  )
  const unseen = allowedNotices.filter((n) => n.unseen).length
  useEffect(() => {
    onUnseenChange?.(unseen)
  }, [unseen, onUnseenChange])
  useEffect(() => {
    if (viewingIncidents)
      setNotices((current) =>
        current.some((n) => n.unseen)
          ? current.map((n) => ({ ...n, unseen: false }))
          : current,
      )
  }, [viewingIncidents, data.incidents])
  const unread = allowedNotices.filter((n) => n.unread).length
  const stableDismiss = useCallback((id) => {
    setToastIds((ids) => ids.filter((x) => x !== id))
  }, [])
  if (!visible) return null
  return (
    <div className="relative">
      <button
        aria-label={
          unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'
        }
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          if (!open)
            setNotices((current) =>
              current.map((n) => ({ ...n, unread: false })),
            )
        }}
        className="relative rounded-lg border border-line bg-card p-2 cursor-pointer"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar panel de notificaciones"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-3 w-80 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
            <h2 className="border-b border-line p-4 text-sm font-bold">
              Notificaciones
            </h2>
            <div className="max-h-80 overflow-y-auto">
              {!allowedNotices.length && (
                <p className="p-4 text-sm text-muted">
                  Sin incidentes nuevos desde que abriste la sesión.
                </p>
              )}
              {allowedNotices.map((n) => (
                <Link
                  key={n.id}
                  to={n.to}
                  onClick={() => {
                    setOpen(false)
                    stableDismiss(n.id)
                  }}
                  className="block border-b border-line p-3 last:border-0 hover:bg-soft"
                >
                  <p className="text-xs font-semibold text-accent">
                    Nuevo incidente
                  </p>
                  <time dateTime={n.createdAt} className="text-xs text-muted">
                    {noticeTime(n.createdAt)}
                  </time>
                  <p className="mt-1 break-words text-sm font-semibold">
                    {n.titulo}
                  </p>
                  <p className="mt-1 text-xs text-muted">{n.site}</p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
      {createPortal(
        <div
          aria-label="Avisos de incidentes"
          className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col gap-3 sm:left-auto sm:w-96"
        >
          {allowedNotices
            .filter((n) => toastIds.includes(n.id))
            .map((n) => (
              <IncidentToast key={n.id} notice={n} onDismiss={stableDismiss} />
            ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
