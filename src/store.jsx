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
  const [session, setSession] = useState(() =>
    sessionStorage.getItem('sepsa-session'),
  )
  const [storageError, setStorageError] = useState('')
  const user = data.users.find((u) => u.id === session && u.activo)
  const role = data.roles.find((r) => r.id === user?.role)
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
  const api = useMemo(
    () => ({
      data,
      user,
      role,
      can,
      storageError,
      login: (id) => {
        sessionStorage.setItem('sepsa-session', id)
        setSession(id)
      },
      logout: () => {
        sessionStorage.removeItem('sepsa-session')
        setSession(null)
      },
      setup: (patch) =>
        setData((d) => ({
          ...d,
          users: d.users.map((u) =>
            u.id === 'uadmin' && !u.passwordHash ? { ...u, ...patch } : u,
          ),
        })),
      add: (col, item) => {
        if (!allowed(col, 'create')) return false
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
      update: (col, id, patch) => {
        if (!allowed(col, 'update')) return false
        setData((d) => ({
          ...d,
          [col]: d[col].map((r) =>
            r.id === id ? { ...r, ...patch, id: r.id } : r,
          ),
        }))
        return true
      },
      remove: (col, id) => {
        if (!allowed(col, 'delete')) return false
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
    [data, session, storageError],
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
export const useStore = () => useContext(Ctx)
