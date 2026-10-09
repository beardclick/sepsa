import { useEffect, useRef, useState } from 'react'
import { incidentRequest, withIncidentNames } from './cloudIncidents'
import { buildSeed } from './seed'

export function useCloudShifts(enabled, user, permissions, data, setData) {
  const latest = useRef(data)
  latest.current = data
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const view =
    permissions?.shifts?.includes('view') ||
    permissions?.portal?.includes('view')
  const create =
    user?.role !== 'agent' && permissions?.shifts?.includes('create')
  useEffect(() => {
    setReady(false)
    setError('')
    if (!enabled || !user?.id || !view) return
    let disposed = false,
      loading = false
    const refresh = async () => {
      if (disposed || loading) return
      loading = true
      try {
        const result = await incidentRequest('/api/shifts')
        if (disposed) return
        setData((d) => {
          const agents = [...d.agents],
            clients = [...d.clients]
          for (const s of result.shifts) {
            if (!agents.some((a) => a.id === s.agente))
              agents.push({
                id: s.agente,
                nombre: s.agenteNombre || 'Agente',
                sitio: s.cliente,
              })
            if (!clients.some((c) => c.id === s.cliente))
              clients.push({
                id: s.cliente,
                nombre: s.clienteNombre || 'Puesto asignado',
              })
          }
          return { ...d, shifts: result.shifts, agents, clients }
        })
        setReady(true)
      } catch (e) {
        if (!disposed) setError(`Turnos: ${e.message}`)
      } finally {
        loading = false
      }
    }
    const initialize = async () => {
      const seed = new Set(buildSeed().shifts.map((s) => s.id))
      const records = [
        ...latest.current.shifts,
        ...(latest.current.localShiftArchive || []),
      ]
      const old = records.filter(
        (s, index) =>
          !s.shared &&
          !seed.has(s.id) &&
          records.findIndex((r) => r.id === s.id) === index,
      )
      if (create && old.length) {
        setData((d) => ({
          ...d,
          localShiftArchive: [
            ...(d.localShiftArchive || []).filter(
              (s) => !old.some((row) => row.id === s.id),
            ),
            ...old,
          ],
        }))
        try {
          for (let i = 0; i < old.length; i += 100)
            await incidentRequest('/api/shifts/import', 'POST', {
              shifts: old
                .slice(i, i + 100)
                .map((s) => withIncidentNames(s, latest.current)),
            })
          setData((d) => ({
            ...d,
            localShiftArchive: d.localShiftArchive.map((s) =>
              old.some((row) => row.id === s.id) ? { ...s, shared: true } : s,
            ),
          }))
        } catch (e) {
          if (!disposed)
            setError(
              `Los turnos anteriores quedan respaldados en este navegador: ${e.message}`,
            )
        }
      }
      await refresh()
    }
    initialize()
    const timer = setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => {
      disposed = true
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [enabled, user?.id, user?.role, view, create, setData])
  return { shiftsReady: enabled ? ready : true, shiftSyncError: error }
}
