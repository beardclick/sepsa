import { useEffect, useState } from 'react'

export const parseDT = (fecha, hora = '00:00') => {
  const [y, m, d] = fecha.split('-').map(Number)
  const [hh, mm] = (hora || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0)
}

export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Un turno cuyo fin es <= inicio termina al día siguiente (p. ej. 18:00 → 06:00)
export function interval(s) {
  const start = parseDT(s.fecha, s.inicio)
  let end = parseDT(s.fecha, s.fin)
  if (end <= start) end = new Date(end.getTime() + 86400000)
  return { start, end }
}

export function fmtDur(ms) {
  const mins = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m} min`
}

export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

// Posición del agente: la última registrada o, si no hay, la del puesto (con un pequeño desfase para no encimar pines)
export function agentPos(agent, client) {
  const lat = parseFloat(agent.lat), lng = parseFloat(agent.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng]
  const cl = parseFloat(client?.lat), cn = parseFloat(client?.lng)
  if (!Number.isFinite(cl) || !Number.isFinite(cn)) return null
  const h = [...agent.id].reduce((s, c) => s + c.charCodeAt(0), 0)
  return [cl + ((h % 7) - 3) * 0.0006, cn + (((h >> 1) % 7) - 3) * 0.0006]
}

export function computeDuty(data, now) {
  const agents = Object.fromEntries(data.agents.map((a) => [a.id, a]))
  const clients = Object.fromEntries(data.clients.map((c) => [c.id, c]))
  const onDuty = []
  const upcoming = []
  for (const s of data.shifts) {
    if (s.estado !== 'Programado') continue
    const agent = agents[s.agente]
    if (!agent) continue
    const client = clients[s.cliente]
    const { start, end } = interval(s)
    if (start <= now && now < end) {
      onDuty.push({ shift: s, agent, client, start, end, remaining: end - now, progress: (now - start) / (end - start), pos: agentPos(agent, client) })
    } else if (start > now) {
      upcoming.push({ shift: s, agent, client, start, end, startsIn: start - now })
    }
  }
  onDuty.sort((a, b) => a.remaining - b.remaining)
  upcoming.sort((a, b) => a.start - b.start)
  return { onDuty, upcoming }
}

export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
