import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { buildSeed } from './seed'
import { SERVICES } from './config'
import { initialRoles } from './access'
import { makeReport, reportDate } from './reports'
import { analyzeShiftPlan } from './schedule'
const KEY = 'sepsa-crm-data-v3'
const Ctx = createContext(null)
export function normalizeData(raw) {
  const seed = buildSeed()
  const data = Object.fromEntries(
    Object.keys(seed).map((k) => [
      k,
      Array.isArray(raw?.[k]) ? raw[k] : seed[k],
    ]),
  )
  data.categories =
    raw?.categories ||
    ['Comunicación', 'Equipamiento', 'Armas', 'Vehículos'].map((nombre, i) => ({
      id: `cat${i}`,
      nombre,
    }))
  data.serviceTypes =
    raw?.serviceTypes ||
    SERVICES.map((nombre, i) => ({ id: `srv${i}`, nombre }))
  data.equipment = data.equipment.map((e) => ({
    ...e,
    categoria:
      e.categoria ||
      (e.tipo === 'Radio' ? 'cat0' : e.tipo === 'Vehículo' ? 'cat3' : 'cat1'),
  }))
  data.roles = raw?.roles?.length ? raw.roles : initialRoles()
  data.users = raw?.users || [
    {
      id: 'uadmin',
      nombre: 'Administrador',
      username: 'admin',
      role: 'admin',
      activo: true,
    },
  ]
  data.reports = raw?.reports || []
  data.reportSettings = raw?.reportSettings || {
    enabled: true,
    sections: ['incidents', 'shifts', 'agents', 'equipment'],
    comentarios: '',
  }
  return data
}
function load() {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(KEY)))
  } catch {
    return normalizeData()
  }
}
const uid = (p) => `${p}${crypto.randomUUID()}`
export function StoreProvider({ children }) {
  const [data, setData] = useState(load)
  const [cloudUser, setCloudUser] = useState(null)
  const [cloudRole, setCloudRole] = useState(null)
  const [session, setSession] = useState(() => sessionStorage.getItem('sepsa-session'))
  const [authStatus, setAuthStatus] = useState({ loading: true, available: false, initialized: true, adminEmail: '', error: '' })
  const [storageError, setStorageError] = useState('')
  useEffect(() => {
    let active = true
    const initialize = async () => {
      try {
        const stateResponse = await fetch('/api/auth/state', { cache: 'no-store' })
        if (!stateResponse.ok) throw new Error('No se pudo contactar el servicio de acceso.')
        const state = await stateResponse.json()
        if (!active) return
        setAuthStatus({ loading: false, available: true, initialized: !!state.initialized, adminEmail: state.adminEmail || '', error: '' })
        if (!state.initialized) return
        const meResponse = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
        if (meResponse.status === 401) return
        if (!meResponse.ok) throw new Error('No se pudo validar la sesión.')
        const me = await meResponse.json()
        if (!active) return
        setCloudUser(me.user)
        setCloudRole(me.role)
        await loadCloudAdmin(me.user, me.role, active, setData)
      } catch (error) {
        if (!active) return
        if (import.meta.env.DEV) {
          setAuthStatus({ loading: false, available: false, initialized: true, adminEmail: '', error: '' })
        } else {
          setAuthStatus({ loading: false, available: false, initialized: true, adminEmail: '', error: error.message })
        }
      }
    }
    initialize()
    return () => { active = false }
  }, [])
  const localUser = import.meta.env.DEV && !authStatus.available ? data.users.find((u) => u.id === session && u.activo) : null
  const user = authStatus.available ? cloudUser : localUser
  const role = authStatus.available ? cloudRole || data.roles.find((r) => r.id === user?.role) : data.roles.find((r) => r.id === user?.role)
  const can = (module, action = 'view') =>
    !!role?.permissions?.[module]?.includes(action)
  useEffect(() => {
    // El evento storage notifica inmediatamente a las otras pestañas del mismo origen.
    const receive = (event) => {
      if (event.key !== KEY || !event.newValue) return
      try {
        setData(normalizeData(JSON.parse(event.newValue)))
      } catch {}
    }
    window.addEventListener('storage', receive)
    return () => window.removeEventListener('storage', receive)
  }, [])
  useEffect(() => {
    try {
      const serialized = JSON.stringify(data)
      if (localStorage.getItem(KEY) !== serialized)
        localStorage.setItem(KEY, serialized)
      setStorageError('')
    } catch {
      setStorageError(
        'No se pudieron guardar los cambios: el almacenamiento del navegador está lleno. Exporta un respaldo.',
      )
    }
  }, [data])
  useEffect(() => {
    const generate = () =>
      setData((d) => {
        const date = reportDate()
        return !d.reportSettings.enabled ||
          d.reports.some((r) => r.fecha === date)
          ? d
          : {
              ...d,
              reports: [
                makeReport(
                  d,
                  date,
                  d.reportSettings.sections,
                  d.reportSettings.comentarios,
                ),
                ...d.reports,
              ],
            }
      })
    generate()
    const timer = setInterval(generate, 30000)
    return () => clearInterval(timer)
  }, [data.reportSettings])
  const moduleFor = (col) =>
    ({
      categories: 'equipment',
      serviceTypes: 'contracts',
      roles: 'users',
      users: 'users',
      reportSettings: 'reports',
    })[col] || col
  const allowed = (col, action) => can(moduleFor(col), action)
  const login = async (username, password) => {
    if (!authStatus.available) {
      if (!import.meta.env.DEV) throw new Error(authStatus.error || 'El servicio de acceso no está disponible.')
      const { passwordHash } = await import('./access')
      const local = data.users.find((u) => u.activo && u.username.toLowerCase() === username.trim().toLowerCase())
      if (!local?.salt || (await passwordHash(password, local.salt)) !== local.passwordHash) throw new Error('Usuario o contraseña incorrectos.')
      sessionStorage.setItem('sepsa-session', local.id)
      setSession(local.id)
      setAuthStatus((value) => ({ ...value, loading: false, initialized: true }))
      return
    }
    const result = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: username.trim(), password }) })
    const payload = await result.json()
    if (!result.ok) throw new Error(payload.error || 'No se pudo iniciar sesión.')
    setCloudUser(payload.user)
    setCloudRole(payload.role)
    setAuthStatus((value) => ({ ...value, initialized: true }))
    await loadCloudAdmin(payload.user, payload.role, true, setData)
  }
  const bootstrap = async (input) => {
    if (!authStatus.available) throw new Error(authStatus.error || 'El servicio de acceso no está disponible.')
    const result = await fetch('/api/auth/bootstrap', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
    const payload = await result.json()
    if (!result.ok) throw new Error(payload.error || 'No se pudo configurar el acceso.')
    setCloudUser(payload.user)
    setCloudRole(payload.role)
    setAuthStatus((value) => ({ ...value, initialized: true }))
    setData((d) => ({ ...d, users: [payload.user], roles: [payload.role] }))
    await loadCloudAdmin(payload.user, payload.role, true, setData)
  }
  const refreshAdmin = async () => {
    if (!authStatus.available || !user) return
    await loadCloudAdmin(user, role, true, setData)
  }
  const api = useMemo(
    () => ({
      data,
      user,
      role,
      can,
      authStatus,
      storageError,
      login,
      bootstrap,
      logout: async () => {
        if (authStatus.available) await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {})
        sessionStorage.removeItem('sepsa-session')
        setSession(null)
        setCloudUser(null)
        setCloudRole(null)
      },
      setup: (patch) =>
        setData((d) => ({
          ...d,
          users: d.users.map((u) =>
            u.id === 'uadmin' && !u.passwordHash ? { ...u, ...patch } : u,
          ),
        })),
      add: async (col, item) => {
        if (!allowed(col, 'create')) return false
        if (authStatus.available && (col === 'users' || col === 'roles')) {
          const response = await fetch(`/api/admin/${col}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(col === 'users' ? { name: item.nombre, email: item.username, password: item.password, roleId: item.role, active: item.activo, agentId: item.agent } : { name: item.nombre, permissions: item.permissions }) })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'No se pudo guardar.')
          const saved = result.user || result.role
          setData((d) => ({ ...d, [col]: [saved, ...d[col].filter((row) => row.id !== saved.id)] }))
          return saved.id
        }
        const id = uid(col[0])
        setData((d) => ({ ...d, [col]: [{ ...item, id }, ...d[col]] }))
        return id
      },
      addShiftPlan: (items, skipConflicts = false) => {
        if (!can('shifts', 'create'))
          return { error: 'No tienes permiso para crear turnos.' }
        if (
          !Array.isArray(items) ||
          !items.length ||
          items.some(
            (s) =>
              !data.agents.some((a) => a.id === s.agente) ||
              !data.clients.some((c) => c.id === s.cliente) ||
              !/^\d{4}-\d{2}-\d{2}$/.test(s.fecha) ||
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.inicio) ||
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.fin),
          )
        )
          return {
            error:
              'Revisa el agente, el puesto y las fechas y horas de los turnos.',
          }
        const { accepted, conflicts } = analyzeShiftPlan(items, data.shifts)
        if (conflicts.length && !skipConflicts)
          return {
            error:
              'Hay turnos en conflicto. Corrige la selección o elige omitirlos.',
          }
        if (!accepted.length)
          return { error: 'No hay turnos nuevos para crear.' }
        const records = accepted.map((s) => ({
          ...s,
          id: uid('s'),
          estado: 'Programado',
        }))
        setData((d) => ({ ...d, shifts: [...records, ...d.shifts] }))
        return {
          created: records.length,
          skipped: conflicts.length,
          firstDate: records[0].fecha,
        }
      },
      update: async (col, id, patch) => {
        if (!allowed(col, 'update')) return false
        if (authStatus.available && (col === 'users' || col === 'roles')) {
          const response = await fetch(`/api/admin/${col}/${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(col === 'users' ? { name: patch.nombre, email: patch.username, password: patch.password, roleId: patch.role, active: patch.activo, agentId: patch.agent } : { name: patch.nombre, permissions: patch.permissions }) })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'No se pudo guardar.')
          const saved = result.user || result.role
          setData((d) => ({ ...d, [col]: d[col].map((row) => row.id === id ? saved : row) }))
          if (col === 'roles' && user?.role === id) setCloudRole(saved)
          return true
        }
        setData((d) => ({
          ...d,
          [col]: d[col].map((r) =>
            r.id === id ? { ...r, ...patch, id: r.id } : r,
          ),
        }))
        return true
      },
      remove: async (col, id) => {
        if (!allowed(col, 'delete')) return false
        if (authStatus.available && (col === 'users' || col === 'roles')) {
          const response = await fetch(`/api/admin/${col}/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
          const result = response.status === 204 ? {} : await response.json()
          if (!response.ok) throw new Error(result.error || 'No se pudo eliminar.')
          setData((d) => ({ ...d, [col]: d[col].filter((row) => row.id !== id) }))
          return true
        }
        if (
          col === 'categories' &&
          data.equipment.some((e) => e.categoria === id)
        )
          return false
        if (
          col === 'serviceTypes' &&
          [...data.contracts, ...data.leads].some(
            (e) =>
              e.servicio === data.serviceTypes.find((s) => s.id === id)?.nombre,
          )
        )
          return false
        if (
          col === 'roles' &&
          (id === 'admin' || data.users.some((u) => u.role === id))
        )
          return false
        if (
          col === 'users' &&
          (id === user.id ||
            (data.users.find((u) => u.id === id)?.role === 'admin' &&
              data.users.filter((u) => u.role === 'admin' && u.activo).length <=
                1))
        )
          return false
        setData((d) => ({ ...d, [col]: d[col].filter((r) => r.id !== id) }))
        return true
      },
      reportPreferences: (patch) => {
        if (can('reports', 'update'))
          setData((d) => ({
            ...d,
            reportSettings: { ...d.reportSettings, ...patch },
          }))
      },
      submitIncident: (item) => {
        if (
          !can('portal', 'create') ||
          !user?.agent ||
          !data.agents.some((a) => a.id === user.agent)
        )
          return false
        const agent = data.agents.find((a) => a.id === user.agent)
        setData((d) => ({
          ...d,
          incidents: [
            {
              ...item,
              id: uid('i'),
              agente: agent.id,
              cliente: agent.sitio,
              fecha: reportDate(),
              estado: 'Abierto',
            },
            ...d.incidents,
          ],
        }))
        return true
      },
      renameCatalog: (col, id, nombre) => {
        if (!allowed(col, 'update')) return
        setData((d) => {
          const previous = d[col].find((r) => r.id === id)?.nombre
          const out = {
            ...d,
            [col]: d[col].map((r) => (r.id === id ? { ...r, nombre } : r)),
          }
          if (col === 'serviceTypes')
            for (const c of ['contracts', 'leads'])
              out[c] = d[c].map((r) =>
                r.servicio === previous ? { ...r, servicio: nombre } : r,
              )
          return out
        })
      },
      reset: () => {
        if (can('settings', 'delete'))
          setData(
            normalizeData({
              ...buildSeed(),
              users: data.users,
              roles: data.roles,
            }),
          )
      },
      clear: () => {
        if (can('settings', 'delete'))
          setData(
            normalizeData({
              ...Object.fromEntries(
                Object.keys(buildSeed()).map((k) => [k, []]),
              ),
              users: data.users,
              roles: data.roles,
              categories: data.categories,
              serviceTypes: data.serviceTypes,
              reports: [],
            }),
          )
      },
      replaceAll: (obj) => {
        if (can('settings', 'update')) setData(normalizeData(obj))
      },
    }),
    [data, user, role, session, authStatus, storageError],
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

async function loadCloudAdmin(user, role, active, setData) {
  if (!role?.permissions?.users?.includes('view')) {
    setData((d) => ({ ...d, users: [user], roles: [role] }))
    return
  }
  const [usersResponse, rolesResponse] = await Promise.all([
    fetch('/api/admin/users', { credentials: 'same-origin', cache: 'no-store' }),
    fetch('/api/admin/roles', { credentials: 'same-origin', cache: 'no-store' }),
  ])
  if (!usersResponse.ok || !rolesResponse.ok) throw new Error('No se pudo cargar la administración de accesos.')
  const [{ users }, { roles }] = await Promise.all([usersResponse.json(), rolesResponse.json()])
  if (active) setData((d) => ({ ...d, users, roles }))
}
export const useStore = () => useContext(Ctx)
