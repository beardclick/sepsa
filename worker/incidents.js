const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
const allowed = (user, module, action = 'view') =>
  !!user.roleData.permissions?.[module]?.includes(action)
const day = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(
    new Date(),
  )
const text = (value, max = 250) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''
const hub = (env) =>
  env.INCIDENT_HUB.get(env.INCIDENT_HUB.idFromName('sepsa-incidents'))
async function publish(env, event) {
  // El guardado en D1 sigue siendo válido si una conexión de avisos falla.
  try {
    await hub(env).fetch('https://hub/publish', {
      method: 'POST',
      body: JSON.stringify(event),
    })
  } catch (error) {
    console.error('Incident broadcast:', error.message)
  }
}
async function parse(request) {
  if (Number(request.headers.get('content-length')) > 1_000_000)
    throw new Error('La evidencia es demasiado grande.')
  return request.json()
}
async function prepare(input, user, env, imported = false) {
  const titulo = text(input.titulo)
  if (!titulo) throw new Error('El título es obligatorio.')
  if (!['Baja', 'Media', 'Alta', 'Crítica'].includes(input.severidad))
    throw new Error('Selecciona una severidad válida.')
  const evidencia = typeof input.evidencia === 'string' ? input.evidencia : ''
  if (
    evidencia &&
    (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(evidencia) ||
      evidencia.length > 700_000)
  )
    throw new Error('La evidencia debe ser una imagen de menos de 500 KB.')
  let agente = text(input.agente),
    cliente = text(input.cliente)
  let agenteNombre = text(input.agenteNombre),
    clienteNombre = text(input.clienteNombre)
  if (user.role === 'agent' || !allowed(user, 'incidents', 'create')) {
    if (!allowed(user, 'portal', 'create') || !user.agent)
      throw new Error('Tu acceso no tiene un agente asociado.')
    const row = await env.DB.prepare(
      'SELECT payload FROM incident_directory WHERE id=?',
    )
      .bind(user.agent)
      .first()
    if (!row)
      throw new Error(
        'El administrador debe actualizar la asociación de tu ficha en Usuarios y permisos.',
      )
    const profile = JSON.parse(row.payload)
    agente = user.agent
    cliente = profile.sitio || ''
    agenteNombre = profile.nombre
    clienteNombre = profile.clienteNombre || ''
  }
  return {
    titulo,
    descripcion: text(input.descripcion, 10000),
    severidad: input.severidad,
    evidencia,
    agente,
    cliente,
    agenteNombre,
    clienteNombre,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(input.fecha) ? input.fecha : day(),
    estado:
      imported && ['Abierto', 'En curso', 'Resuelto'].includes(input.estado)
        ? input.estado
        : 'Abierto',
    createdBy: user.id,
    createdAt: new Date().toISOString(),
    imported,
  }
}
export async function handleIncidents(request, env, user, tokenHash) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method
  if (path === '/api/incidents/live' && method === 'GET') {
    if (!allowed(user, 'incidents') || user.role === 'agent')
      return json({ error: 'No tienes acceso a estos avisos.' }, 403)
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== url.origin
    )
      return json({ error: 'Origen no permitido.' }, 403)
    return hub(env).fetch(
      new Request('https://hub/connect', {
        headers: { Upgrade: 'websocket', 'X-Session-Hash': tokenHash },
      }),
    )
  }
  if (path === '/api/incident-directory') {
    if (method === 'POST') {
      if (
        !allowed(user, 'users', 'update') &&
        !allowed(user, 'users', 'create') &&
        !allowed(user, 'agents', 'update')
      )
        return json({ error: 'No tienes permiso.' }, 403)
      const input = await parse(request)
      const profiles = Array.isArray(input.profiles)
        ? input.profiles.slice(0, 500)
        : []
      const statements = profiles
        .filter((p) => text(p.id) && text(p.nombre))
        .map((p) =>
          env.DB.prepare(
            input.onlyMissing
              ? 'INSERT OR IGNORE INTO incident_directory (id,payload) VALUES (?,?)'
              : 'INSERT INTO incident_directory (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
          ).bind(
            text(p.id),
            JSON.stringify({
              id: text(p.id),
              nombre: text(p.nombre),
              sitio: text(p.sitio),
              clienteNombre: text(p.clienteNombre),
            }),
          ),
        )
      if (statements.length) await env.DB.batch(statements)
      return json({ ok: true })
    }
    if (method === 'GET') {
      if (!allowed(user, 'portal') && !allowed(user, 'incidents'))
        return json({ error: 'No tienes permiso.' }, 403)
      const rows = allowed(user, 'incidents')
        ? await env.DB.prepare('SELECT payload FROM incident_directory').all()
        : await env.DB.prepare(
            'SELECT payload FROM incident_directory WHERE id=?',
          )
            .bind(user.agent || '')
            .all()
      return json({ profiles: rows.results.map((r) => JSON.parse(r.payload)) })
    }
  }
  if (path === '/api/incidents' && method === 'GET') {
    if (!allowed(user, 'incidents') && !allowed(user, 'portal'))
      return json({ error: 'No tienes permiso para ver incidentes.' }, 403)
    if (!allowed(user, 'incidents') && !user.agent)
      return json({ incidents: [] })
    const rows = allowed(user, 'incidents')
      ? await env.DB.prepare(
          'SELECT id,payload FROM incidents ORDER BY sequence DESC',
        ).all()
      : await env.DB.prepare(
          'SELECT id,payload FROM incidents WHERE agent_id=? ORDER BY sequence DESC',
        )
          .bind(user.agent)
          .all()
    return json({
      incidents: rows.results.map((r) => ({
        ...JSON.parse(r.payload),
        id: r.id,
      })),
    })
  }
  if (
    (path === '/api/incidents' || path === '/api/incidents/import') &&
    method === 'POST'
  ) {
    if (
      !allowed(user, 'incidents', 'create') &&
      !allowed(user, 'portal', 'create')
    )
      return json({ error: 'No tienes permiso para crear incidentes.' }, 403)
    try {
      const input = await parse(request),
        imported = path.endsWith('/import')
      const items = imported
        ? Array.isArray(input.incidents)
          ? input.incidents.slice(0, 100)
          : []
        : [input]
      const saved = []
      for (const item of items) {
        const id = imported ? text(item.id) : crypto.randomUUID()
        if (!id) continue
        if (
          imported &&
          (await env.DB.prepare('SELECT id FROM incidents WHERE id=?')
            .bind(id)
            .first())
        )
          continue
        const payload = await prepare(item, user, env, imported)
        const inserted = await env.DB.prepare(
          `${imported ? 'INSERT OR IGNORE' : 'INSERT'} INTO incidents (id,payload,created_by,agent_id) VALUES (?,?,?,?)`,
        )
          .bind(id, JSON.stringify(payload), user.id, payload.agente)
          .run()
        if (inserted.meta.changes) saved.push({ ...payload, id })
      }
      if (saved.length)
        await publish(env, {
          type: imported ? 'incidents.updated' : 'incident.created',
          createdBy: user.id,
          id: saved[0].id,
        })
      return json(
        imported ? { imported: saved.length } : { incident: saved[0] },
        201,
      )
    } catch (error) {
      return json({ error: error.message }, 400)
    }
  }
  const match = path.match(/^\/api\/incidents\/([\w-]+)$/)
  if (match && (method === 'PATCH' || method === 'DELETE')) {
    if (!allowed(user, 'incidents', method === 'PATCH' ? 'update' : 'delete'))
      return json({ error: 'No tienes permiso para esta operación.' }, 403)
    const row = await env.DB.prepare('SELECT payload FROM incidents WHERE id=?')
      .bind(match[1])
      .first()
    if (!row) return json({ error: 'Incidente no encontrado.' }, 404)
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM incidents WHERE id=?')
        .bind(match[1])
        .run()
      await publish(env, {
        type: 'incidents.updated',
        createdBy: user.id,
        id: match[1],
      })
      return json({ ok: true })
    }
    try {
      const input = await parse(request),
        original = JSON.parse(row.payload)
      if (
        input.estado &&
        !['Abierto', 'En curso', 'Resuelto'].includes(input.estado)
      )
        throw new Error('Estado no válido.')
      const validated = await prepare(
        { ...original, ...input },
        { ...user, roleData: { permissions: { incidents: ['create'] } } },
        env,
        true,
      )
      const payload = {
        ...validated,
        fecha: input.fecha || original.fecha,
        estado: input.estado || original.estado,
        createdBy: original.createdBy,
        createdAt: original.createdAt,
        imported: original.imported,
      }
      await env.DB.prepare(
        'UPDATE incidents SET payload=?,agent_id=? WHERE id=?',
      )
        .bind(JSON.stringify(payload), payload.agente, match[1])
        .run()
      await publish(env, {
        type: 'incidents.updated',
        createdBy: user.id,
        id: match[1],
      })
      return json({ incident: { ...payload, id: match[1] } })
    } catch (error) {
      return json({ error: error.message }, 400)
    }
  }
  return json({ error: 'Ruta no encontrada.' }, 404)
}
