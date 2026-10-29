const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

const API = 'https://api.telegram.org'
const MAX_TEXT = 4000

export const telegramReady = (env) => !!env.TELEGRAM_BOT_TOKEN

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function day(offset = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(
    new Date(Date.now() + offset * 86400000),
  )
}

async function apiCall(env, method, body) {
  const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function sendTelegramMessage(env, chatId, text) {
  if (!telegramReady(env) || !chatId) return { ok: false }
  return apiCall(env, 'sendMessage', {
    chat_id: chatId,
    text: String(text).slice(0, MAX_TEXT),
    disable_web_page_preview: true,
  })
}

async function setWebhook(env, url, secret) {
  return apiCall(env, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message'],
  })
}

async function settings(env) {
  const row = await env.DB.prepare(
    'SELECT chat_id,enabled,notify_incidents,notify_shifts,notify_reports FROM telegram_settings WHERE id=1',
  ).first()
  return row || {
    chat_id: '',
    enabled: 0,
    notify_incidents: 1,
    notify_shifts: 1,
    notify_reports: 1,
  }
}

export async function notifyTelegram(env, kind, text) {
  if (!telegramReady(env)) return
  try {
    const cfg = await settings(env)
    if (!cfg.enabled || !cfg.chat_id || !cfg[`notify_${kind}`]) return
    await sendTelegramMessage(env, cfg.chat_id, text)
  } catch (error) {
    console.error('Telegram notify:', error)
  }
}

const clip = (value, max = 300) =>
  String(value ?? '').trim().slice(0, max) || '—'

export function formatIncident(incident) {
  return [
    '🚨 Nuevo incidente',
    `📌 ${clip(incident.titulo, 200)}`,
    `⚡ Severidad: ${incident.severidad || '—'}`,
    `📍 Sitio: ${clip(incident.clienteNombre || incident.cliente, 120)}`,
    `👤 Agente: ${clip(incident.agenteNombre || incident.agente, 120)}`,
    `📅 Fecha: ${incident.fecha || '—'}`,
    incident.descripcion
      ? `\n${clip(incident.descripcion, 600)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatShifts(records) {
  if (!records.length) return 'Sin turnos nuevos.'
  if (records.length === 1) {
    const s = records[0]
    return [
      '🕐 Nuevo turno',
      `👤 ${clip(s.agenteNombre || s.agente, 120)}`,
      `📍 ${clip(s.clienteNombre || s.cliente, 120)}`,
      `📅 ${s.fecha || '—'}  ⏰ ${s.inicio || '—'}–${s.fin || '—'}`,
      `Estado: ${s.estado || 'Programado'}`,
    ].join('\n')
  }
  const lines = records.slice(0, 15).map(
    (s) =>
      `• ${clip(s.agenteNombre || s.agente, 60)} — ${s.fecha} ${s.inicio}–${s.fin} @ ${clip(s.clienteNombre || s.cliente, 60)}`,
  )
  if (records.length > 15) lines.push(`… y ${records.length - 15} turnos más.`)
  return [`🕐 ${records.length} turnos programados`, ...lines].join('\n')
}

export function formatReport(report, sender) {
  const sections = (report.sections || [])
    .map((s) => `• ${s.title || s.key}: ${s.rows?.length ?? 0}`)
    .join('\n')
  return [
    `📊 Informe diario ${report.fecha || '—'}`,
    `Enviado por ${sender || '—'}`,
    '',
    sections || 'Sin secciones.',
    '',
    report.comentarios ? `Comentarios: ${clip(report.comentarios, 800)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function loadContext(env) {
  const agents = (
    await env.DB.prepare('SELECT payload FROM incident_directory').all()
  ).results.map((r) => JSON.parse(r.payload))
  const shifts = (
    await env.DB.prepare('SELECT payload FROM shifts ORDER BY rowid DESC LIMIT 400').all()
  ).results.map((r) => JSON.parse(r.payload))
  const rounds = (
    await env.DB.prepare('SELECT payload FROM rounds ORDER BY rowid DESC LIMIT 100').all()
  ).results.map((r) => JSON.parse(r.payload))
  const incidents = (
    await env.DB.prepare('SELECT payload FROM incidents ORDER BY sequence DESC LIMIT 200').all()
  ).results.map((r) => JSON.parse(r.payload))
  return { agents, shifts, rounds, incidents }
}

function helpText() {
  return [
    '🤖 Asistente SEPSA',
    '',
    'Comandos disponibles:',
    '/turnos [hoy|mañana|ayer|AAAA-MM-DD] — turnos del día',
    '/proximos — próximos turnos desde hoy',
    '/rondas [fecha] — rondas del día',
    '/incidentes [abiertos|recientes] — incidentes',
    '/agentes — directorio de agentes',
    '/ayuda — esta ayuda',
    '',
    'También puedes escribir una pregunta en lenguaje natural mencionando al bot (por ejemplo "@bot próximos turnos de mañana").',
  ].join('\n')
}

function parseDateArg(arg, fallbackOffset = 0) {
  const value = String(arg || '').trim().toLowerCase()
  if (!value) return day(fallbackOffset)
  if (value === 'hoy') return day(0)
  if (value === 'mañana' || value === 'manana') return day(1)
  if (value === 'ayer') return day(-1)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return null
}

function listShiftsForDate(ctx, date) {
  const rows = ctx.shifts
    .filter((s) => s.fecha === date)
    .sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''))
  if (!rows.length) return `No hay turnos registrados para ${date}.`
  const lines = rows
    .slice(0, 25)
    .map(
      (s) =>
        `• ${clip(s.inicio, 5)}–${clip(s.fin, 5)} — ${clip(s.agenteNombre || s.agente, 60)} @ ${clip(s.clienteNombre || s.cliente, 60)} (${s.estado || 'Programado'})`,
    )
  if (rows.length > 25) lines.push(`… y ${rows.length - 25} turnos más.`)
  return [`🕐 Turnos del ${date} (${rows.length})`, ...lines].join('\n')
}

function listUpcoming(ctx) {
  const today = day(0)
  const rows = ctx.shifts
    .filter((s) => s.fecha >= today)
    .sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio))
  if (!rows.length) return 'No hay turnos próximos registrados.'
  const lines = rows
    .slice(0, 20)
    .map(
      (s) =>
        `• ${s.fecha} ${clip(s.inicio, 5)} — ${clip(s.agenteNombre || s.agente, 60)} @ ${clip(s.clienteNombre || s.cliente, 60)}`,
    )
  if (rows.length > 20) lines.push(`… y ${rows.length - 20} turnos más.`)
  return [`📅 Próximos turnos (${rows.length})`, ...lines].join('\n')
}

function listRounds(ctx, date) {
  const target = date || day(0)
  const rows = ctx.rounds
    .filter((r) => r.fecha === target)
    .sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''))
  if (!rows.length)
    return `No hay rondas registradas para ${target}.`
  const lines = rows.slice(0, 10).map(
    (r) =>
      `• ${clip(r.inicio, 5)}–${clip(r.fin, 5)} — ${clip(r.titulo || r.lugar, 160)} (${r.asignados?.length ?? 0} responsable(s))`,
  )
  return [`🛡️ Rondas del ${target} (${rows.length})`, ...lines].join('\n')
}

function listIncidents(ctx, mode) {
  if (mode === 'recientes' || mode === 'todos') {
    const rows = ctx.incidents.slice(0, 15)
    if (!rows.length) return 'No hay incidentes registrados.'
    const lines = rows.map(
      (i) =>
        `• [${i.estado || '—'}] ${clip(i.titulo, 120)} — ${clip(i.agenteNombre || i.agente, 40)} (${i.fecha || '—'})`,
    )
    return [`🚨 Incidentes recientes (${rows.length})`, ...lines].join('\n')
  }
  const rows = ctx.incidents.filter((i) => i.estado !== 'Resuelto').slice(0, 15)
  if (!rows.length) return 'No hay incidentes abiertos. 🎉'
  const lines = rows.map(
    (i) =>
      `• [${i.severidad || '—'}] ${clip(i.titulo, 120)} — ${clip(i.agenteNombre || i.agente, 40)} (${i.fecha || '—'})`,
  )
  return [`🚨 Incidentes abiertos (${rows.length})`, ...lines].join('\n')
}

function listAgents(ctx) {
  if (!ctx.agents.length) return 'No hay agentes en el directorio.'
  const lines = ctx.agents.slice(0, 30).map(
    (a) => `• ${clip(a.nombre, 80)} — ${clip(a.sitio || a.clienteNombre, 80) || 'Sin puesto'}`,
  )
  if (ctx.agents.length > 30)
    lines.push(`… y ${ctx.agents.length - 30} agentes más.`)
  return [`👥 Agentes (${ctx.agents.length})`, ...lines].join('\n')
}

async function answerAI(env, question, ctx) {
  if (!env.AI) return null
  try {
    const model = env.TELEGRAM_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct'
    const compact = {
      fecha_hoy: day(0),
      agentes: ctx.agents.map((a) => ({
        nombre: a.nombre,
        sitio: a.sitio,
        cliente: a.clienteNombre,
      })),
      turnos: ctx.shifts.map((s) => ({
        agente: s.agenteNombre || s.agente,
        puesto: s.clienteNombre || s.cliente,
        fecha: s.fecha,
        inicio: s.inicio,
        fin: s.fin,
        tipo: s.tipo,
        estado: s.estado,
      })),
      rondas: ctx.rounds.map((r) => ({
        titulo: r.titulo,
        recorrido: r.lugar,
        fecha: r.fecha,
        inicio: r.inicio,
        fin: r.fin,
        responsables: r.asignados?.length ?? 0,
      })),
      incidentes: ctx.incidents.map((i) => ({
        titulo: i.titulo,
        severidad: i.severidad,
        estado: i.estado,
        agente: i.agenteNombre || i.agente,
        sitio: i.clienteNombre || i.cliente,
        fecha: i.fecha,
      })),
    }
    const result = await env.AI.run(model, {
      messages: [
        {
          role: 'system',
          content:
            'Eres el asistente del CRM de seguridad SEPSA. Responde en español, breve y claro, usando SOLO los datos entregados. Si el dato no está, dilo sin inventar. La fecha de hoy está en fecha_hoy.',
        },
        {
          role: 'user',
          content: `Datos:\n${JSON.stringify(compact)}\n\nPregunta: ${question}`,
        },
      ],
      max_tokens: 512,
    })
    return (
      result?.response || result?.text || result?.result?.response || null
    )
  } catch (error) {
    console.error('Telegram AI:', error)
    return null
  }
}

async function routeMessage(env, text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower === '/start' || lower.startsWith('/ayuda') || lower.startsWith('/help'))
    return helpText()
  const [rawCmd, ...rest] = trimmed.split(/\s+/)
  const cmd = rawCmd.toLowerCase()
  const arg = rest.join(' ').trim()
  const ctx = await loadContext(env)
  if (cmd === '/turnos') {
    const date = parseDateArg(arg || 'hoy')
    if (!date) return 'Fecha no válida. Usa hoy, mañana, ayer o AAAA-MM-DD.'
    return listShiftsForDate(ctx, date)
  }
  if (cmd === '/proximos') return listUpcoming(ctx)
  if (cmd === '/rondas') {
    const date = parseDateArg(arg || 'hoy')
    if (!date) return 'Fecha no válida. Usa hoy, mañana, ayer o AAAA-MM-DD.'
    return listRounds(ctx, date)
  }
  if (cmd === '/incidentes') {
    const mode = (arg || 'abiertos').toLowerCase()
    return listIncidents(ctx, mode)
  }
  if (cmd === '/agentes') return listAgents(ctx)
  // Lenguaje natural (IA).
  const ai = await answerAI(env, trimmed, ctx)
  if (ai) return ai
  return (
    'No encontré una respuesta automática. Usa /ayuda para ver los comandos disponibles.'
  )
}

export async function handleTelegram(request, env, user) {
  const path = new URL(request.url).pathname
  const manager = ['admin', 'superadmin'].includes(user.role)
  if (!manager)
    return json({ error: 'Solo Admin y Superadmin pueden configurar Telegram.' }, 403)
  if (path === '/api/telegram/config') {
    if (request.method === 'GET') {
      const cfg = await settings(env)
      return json({
        configured: telegramReady(env),
        chatId: cfg.chat_id,
        enabled: !!cfg.enabled,
        notifyIncidents: !!cfg.notify_incidents,
        notifyShifts: !!cfg.notify_shifts,
        notifyReports: !!cfg.notify_reports,
      })
    }
    if (request.method === 'PUT') {
      const input = await request.json().catch(() => ({}))
      const chatId =
        typeof input.chatId === 'string' ? input.chatId.trim() : ''
      if (chatId && !/^-?\d{5,}$/.test(chatId))
        return json({ error: 'El ID del chat debe ser numérico.' }, 400)
      const flag = (key) => (input[key] === undefined ? 1 : input[key] ? 1 : 0)
      await env.DB.prepare(
        `INSERT INTO telegram_settings (id,chat_id,enabled,notify_incidents,notify_shifts,notify_reports,updated_at) VALUES (1,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET chat_id=excluded.chat_id,enabled=excluded.enabled,notify_incidents=excluded.notify_incidents,notify_shifts=excluded.notify_shifts,notify_reports=excluded.notify_reports,updated_at=CURRENT_TIMESTAMP`,
      )
        .bind(
          chatId,
          input.enabled ? 1 : 0,
          flag('notifyIncidents'),
          flag('notifyShifts'),
          flag('notifyReports'),
        )
        .run()
      let webhook = null
      if (telegramReady(env) && input.enabled && chatId) {
        const base = new URL(request.url).origin
        const secret = await sha256Hex(env.TELEGRAM_BOT_TOKEN)
        webhook = await setWebhook(env, `${base}/telegram/webhook`, secret)
      }
      return json({ ok: true, webhook: webhook?.description ? webhook : null })
    }
  }
  if (path === '/api/telegram/report' && request.method === 'POST') {
    if (!manager)
      return json({ error: 'Solo Admin y Superadmin pueden enviar informes a Telegram.' }, 403)
    const cfg = await settings(env)
    if (!telegramReady(env) || !cfg.enabled || !cfg.chat_id)
      return json({ error: 'Telegram no está configurado.' }, 503)
    if (!cfg.notify_reports)
      return json({ error: 'Las notificaciones de informes están desactivadas.' }, 409)
    if (Number(request.headers.get('content-length') || 0) > 2000000)
      return json({ error: 'Informe demasiado grande.' }, 413)
    const input = await request.json().catch(() => ({}))
    const r = input.report
    if (
      !r ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha || '') ||
      !Array.isArray(r.sections) ||
      !r.sections.length
    )
      return json({ error: 'Informe inválido.' }, 400)
    const text = formatReport(r, user.nombre)
    const result = await sendTelegramMessage(env, cfg.chat_id, text)
    if (result && result.ok) return json({ ok: true })
    return json(
      {
        error:
          result?.description || 'No se pudo enviar el informe a Telegram.',
      },
      502,
    )
  }
  return json({ error: 'Ruta no encontrada.' }, 404)
}

export async function handleTelegramWebhook(request, env) {
  if (request.method !== 'POST')
    return json({ error: 'Método no permitido.' }, 405)
  if (!telegramReady(env))
    return json({ error: 'Telegram no configurado.' }, 503)
  const expected = await sha256Hex(env.TELEGRAM_BOT_TOKEN)
  const provided =
    request.headers.get('x-telegram-bot-api-secret-token') || ''
  if (provided !== expected) return json({ error: 'No autorizado.' }, 401)
  const update = await request.json().catch(() => ({}))
  const message = update?.message || update?.edited_message
  if (!message?.chat?.id || typeof message.text !== 'string')
    return json({ ok: true })
  const cfg = await settings(env)
  if (!cfg.enabled || !cfg.chat_id) return json({ ok: true })
  if (String(message.chat.id) !== String(cfg.chat_id))
    return json({ ok: true })
  const isCommand = message.text.startsWith('/')
  const privateChat = message.chat.type === 'private'
  const mentioned = (message.entities || []).some(
    (entity) => entity.type === 'mention',
  )
  if (!isCommand && !privateChat && !mentioned) return json({ ok: true })
  const reply = await routeMessage(env, message.text)
  if (reply) await sendTelegramMessage(env, message.chat.id, reply)
  return json({ ok: true })
}
