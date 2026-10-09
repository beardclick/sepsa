import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { NavLink } from '../nav'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { NAV, NAV_SECTIONS } from '../config'
import { useStore } from '../store'
import { moduleForPath } from '../access'
import IncidentNotifications from './IncidentNotifications'
import { Icon } from './ui'

function useTheme() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('sepsa-theme', dark ? 'dark' : 'light')
    } catch {}
  }, [dark])
  return [dark, setDark]
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/shield.png" alt="" className="h-11 w-auto" />
      <div className="leading-tight">
        <div className="font-display text-lg font-extrabold tracking-wide">
          SEPSA <span className="text-accent">CRM</span>
        </div>
        <div className="text-[11px] leading-tight text-muted">
          Seguridad Especializada
          <br />
          Panameña
        </div>
      </div>
    </div>
  )
}

function NavList({ onNavigate, expandedMenu, setExpandedMenu }) {
  const { can } = useStore()
  const available = NAV.filter((n) => can(moduleForPath(n.to)))
  return (
    <nav className="flex flex-col gap-5">
      {NAV_SECTIONS.filter((sec) =>
        available.some((n) => n.section === sec),
      ).map((sec) => (
        <div key={sec} className="flex flex-col gap-1">
          <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted/80">
            {sec}
          </div>
          {available
            .filter((n) => n.section === sec)
            .map((n) => {
              const child =
                n.to === '/equipos'
                  ? {
                      to: '/equipos/categorias',
                      label: 'Categorías de equipos',
                    }
                  : n.to === '/contratos'
                    ? {
                        to: '/contratos/servicios',
                        label: 'Tipos de servicios',
                      }
                    : null
              const isOpen = expandedMenu === n.to
              return (
                <div key={n.to}>
                  <div className="flex items-center">
                    <NavLink
                      to={n.to}
                      end={n.to === '/'}
                      onClick={() => {
                        setExpandedMenu(child ? n.to : null)
                        onNavigate?.()
                      }}
                      className={({ isActive }) =>
                        `flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-soft hover:text-fg'}`
                      }
                    >
                      <Icon name={n.icon} className="size-[18px]" />
                      {n.label}
                    </NavLink>
                    {child && (
                      <button
                        type="button"
                        aria-label={`Submenú de ${n.label}`}
                        aria-expanded={isOpen}
                        onClick={() => setExpandedMenu(isOpen ? null : n.to)}
                        className="rounded-lg p-2 text-muted hover:bg-soft"
                      >
                        {isOpen ? '⌃' : '⌄'}
                      </button>
                    )}
                  </div>
                  {child && isOpen && (
                    <NavLink
                      to={child.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `ml-7 mt-1 block rounded-lg border-l border-line px-3 py-2 text-xs ${isActive ? 'bg-accent-soft font-bold text-accent' : 'text-muted hover:bg-soft'}`
                      }
                    >
                      {child.label}
                    </NavLink>
                  )}
                </div>
              )
            })}
        </div>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { user, role, logout, storageError } = useStore()
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useTheme()
  const { pathname } = useLocation()
  const [expandedMenu, setExpandedMenu] = useState(
    () =>
      ['/equipos', '/contratos'].find((root) => pathname.startsWith(root)) ||
      null,
  )
  useEffect(() => {
    setExpandedMenu(
      ['/equipos', '/contratos'].find((root) => pathname.startsWith(root)) ||
        null,
    )
  }, [pathname])
  const current = NAV.find((n) =>
    n.to === '/' ? pathname === '/' : pathname.startsWith(n.to),
  )

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar escritorio */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-card/60 p-5 backdrop-blur lg:flex">
        <Brand />
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <NavList
            expandedMenu={expandedMenu}
            setExpandedMenu={setExpandedMenu}
          />
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-soft p-3">
          <div className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-accent-fg">
            AD
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{user?.nombre}</div>
            <div className="text-xs text-muted">{role?.nombre}</div>
          </div>
        </div>
      </aside>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 anim-fade"
            onClick={() => setOpen(false)}
          />
          <aside className="anim-fade absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col gap-6 border-r border-line bg-card p-5">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="rounded-lg p-1.5 text-muted hover:bg-soft cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavList
                expandedMenu={expandedMenu}
                setExpandedMenu={setExpandedMenu}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg border border-line bg-card p-2 lg:hidden cursor-pointer"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold sm:text-xl">
              {current?.label || 'SEPSA CRM'}
            </h1>
          </div>
          <button
            className="rounded-lg border border-line px-3 py-2 text-xs font-semibold"
            onClick={logout}
          >
            Salir
          </button>
          <div id="header-actions" className="flex sm:hidden" />
          <span className="hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold sm:inline-flex">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />{' '}
            Sistema operativo
          </span>
          <IncidentNotifications />
          <button
            onClick={() => setDark(!dark)}
            aria-label="Cambiar tema"
            title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="rounded-lg border border-line bg-card p-2 hover:bg-soft cursor-pointer"
          >
            {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6">
          {storageError && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500"
            >
              {storageError}
            </p>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
