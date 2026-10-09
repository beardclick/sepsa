import { useEffect, useRef, useState } from 'react'
import { buildSeed } from './seed'

export async function incidentRequest(path, method = 'GET', input) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: input ? { 'content-type': 'application/json' } : {},
    body: input ? JSON.stringify(input) : undefined,
  })
  const payload = await response.json()
  if (!response.ok)
    throw new Error(payload.error || 'No se pudo sincronizar el incidente.')
  return payload
}
export function withIncidentNames(item, data) {
  return {
    ...item,
    ...(item.agente !== undefined || item.agenteNombre !== undefined
      ? {
          agenteNombre:
            data.agents.find((a) => a.id === item.agente)?.nombre ||
            item.agenteNombre ||
            '',
        }
      : {}),
    ...(item.cliente !== undefined || item.clienteNombre !== undefined
      ? {
          clienteNombre:
            data.clients.find((c) => c.id === item.cliente)?.nombre ||
            item.clienteNombre ||
            '',
        }
      : {}),
  }
}
export async function syncAgentProfile(agentId, data) {
  const agent = data.agents.find((a) => a.id === agentId)
  if (agent)
    await incidentRequest('/api/incident-directory', 'POST', {
      profiles: [
        {
          id: agent.id,
          nombre: agent.nombre,
          sitio: agent.sitio || '',
          clienteNombre:
            data.clients.find((c) => c.id === agent.sitio)?.nombre || '',
        },
      ],
    })
}
export function useCloudIncidents(enabled, user, permissions, data, setData) {
  const latest = useRef(data)
  latest.current = data
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const mayView = permissions?.incidents?.includes('view')
  const mayPortal = permissions?.portal?.includes('view')
  const mayCreate =
    permissions?.incidents?.includes('create') ||
    permissions?.portal?.includes('create')
  const mayDirectory =
    permissions?.users?.includes('update') ||
    permissions?.agents?.includes('update')
  useEffect(() => {
    setReady(false)
    setError('')
    if (!enabled || !user?.id || (!mayView && !mayPortal)) return
    let disposed = false,
      socket,
      retryTimer,
      retryDelay = 1000,
      refreshing = false,
      pending = false,
      migrationProblem = ''
    const refresh = async () => {
      if (disposed) return
      if (refreshing) {
        pending = true
        return
      }
      refreshing = true
      try {
        const result = await incidentRequest('/api/incidents')
        if (disposed) return
        setData((d) => {
          const agents = [...d.agents],
            clients = [...d.clients]
          for (const i of result.incidents) {
            if (
              i.agente &&
              i.agenteNombre &&
              !agents.some((a) => a.id === i.agente)
            )
              agents.push({
                id: i.agente,
                nombre: i.agenteNombre,
                sitio: i.cliente,
              })
            if (
              i.cliente &&
              i.clienteNombre &&
              !clients.some((c) => c.id === i.cliente)
            )
              clients.push({ id: i.cliente, nombre: i.clienteNombre })
          }
          return { ...d, incidents: result.incidents, agents, clients }
        })
        setError(migrationProblem)
        setReady(true)
      } catch (e) {
        if (!disposed) setError(`Incidentes: ${e.message}`)
      } finally {
        refreshing = false
        if (pending) {
          pending = false
          refresh()
        }
      }
    }
    const connect = () => {
      if (disposed || !mayView || user.role === 'agent') return
      const url = new URL('/api/incidents/live', window.location.href)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(url)
      socket.onopen = () => {
        retryDelay = 1000
        refresh()
      }
      socket.onmessage = () => refresh()
      socket.onerror = () => socket.close()
      socket.onclose = () => {
        if (!disposed) {
          retryTimer = setTimeout(connect, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30000)
        }
      }
    }
    const initialize = async () => {
      const old = latest.current.incidents.filter(
        (i) =>
          !i.createdBy &&
          !buildSeed().incidents.some((seed) => seed.id === i.id),
      )
      if (old.length)
        setData((d) => ({
          ...d,
          localIncidentArchive: [
            ...(d.localIncidentArchive || []),
            ...old.filter(
              (i) => !(d.localIncidentArchive || []).some((a) => a.id === i.id),
            ),
          ],
        }))
      try {
        if (mayDirectory)
          await incidentRequest('/api/incident-directory', 'POST', {
            onlyMissing: true,
            profiles: latest.current.agents.map((a) => ({
              id: a.id,
              nombre: a.nombre,
              sitio: a.sitio || '',
              clienteNombre:
                latest.current.clients.find((c) => c.id === a.sitio)?.nombre ||
                '',
            })),
          })
        const context = await incidentRequest('/api/incident-directory')
        if (disposed) return
        setData((d) => {
          const agents = [...d.agents],
            clients = [...d.clients]
          for (const profile of context.profiles) {
            const index = agents.findIndex((a) => a.id === profile.id)
            if (index >= 0) agents[index] = { ...agents[index], ...profile }
            else agents.push(profile)
            if (profile.sitio && !clients.some((c) => c.id === profile.sitio))
              clients.push({
                id: profile.sitio,
                nombre: profile.clienteNombre || 'Puesto asignado',
              })
          }
          return { ...d, agents, clients }
        })
        const eligible = old.filter((i) => mayView || i.agente === user.agent)
        if (mayCreate && eligible.length) {
          for (let index = 0; index < eligible.length; index += 100)
            await incidentRequest('/api/incidents/import', 'POST', {
              incidents: eligible
                .slice(index, index + 100)
                .map((i) => withIncidentNames(i, latest.current)),
            })
        }
      } catch (e) {
        migrationProblem = `Los incidentes anteriores quedan respaldados en este navegador: ${e.message}`
        if (!disposed) setError(migrationProblem)
      }
      await refresh()
      if (disposed) return
      connect()
    }
    initialize()
    const fallback = setInterval(refresh, 20000)
    const focus = () => refresh()
    window.addEventListener('focus', focus)
    window.addEventListener('sepsa:refresh', focus)
    return () => {
      disposed = true
      clearInterval(fallback)
      clearTimeout(retryTimer)
      socket?.close()
      window.removeEventListener('focus', focus)
      window.removeEventListener('sepsa:refresh', focus)
    }
  }, [
    enabled,
    user?.id,
    user?.agent,
    user?.role,
    mayView,
    mayPortal,
    mayCreate,
    mayDirectory,
    setData,
  ])
  return { incidentsReady: enabled ? ready : true, incidentSyncError: error }
}
