const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
const can = (user, action) =>
  user.roleData.permissions?.shifts?.includes(action)
function prepare(input) {
  if (
    !input.agente ||
    !input.cliente ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.inicio) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.fin)
  )
    throw new Error('Revisa el agente, puesto, fecha y horario del turno.')
  if (
    !['Programado', 'Completado', 'Ausente'].includes(
      input.estado || 'Programado',
    )
  )
    throw new Error('Estado de turno no válido.')
  return Object.fromEntries(
    [
      'agente',
      'cliente',
      'fecha',
      'inicio',
      'fin',
      'tipo',
      'estado',
      'agenteNombre',
      'clienteNombre',
    ].map((key) => [
      key,
      String(input[key] || (key === 'estado' ? 'Programado' : '')).slice(
        0,
        250,
      ),
    ]),
  )
}
export async function handleShifts(request, env, user) {
  const path = new URL(request.url).pathname,
    method = request.method
  if (path === '/api/shifts' && method === 'GET') {
    const manager = user.role !== 'agent' && can(user, 'view')
    if (!manager && !user.roleData.permissions?.portal?.includes('view'))
      return json({ error: 'No tienes permiso para ver turnos.' }, 403)
    const rows = manager
      ? await env.DB.prepare(
          'SELECT id,payload FROM shifts ORDER BY rowid DESC',
        ).all()
      : await env.DB.prepare(
          'SELECT id,payload FROM shifts WHERE agent_id=? ORDER BY rowid DESC',
        )
          .bind(user.agent || '__unassigned__')
          .all()
    return json({
      shifts: rows.results.map((r) => ({
        ...JSON.parse(r.payload),
        id: r.id,
        shared: true,
      })),
    })
  }
  if (
    (path === '/api/shifts' || path === '/api/shifts/import') &&
    method === 'POST'
  ) {
    if (!can(user, 'create') || user.role === 'agent')
      return json({ error: 'No tienes permiso para crear turnos.' }, 403)
    try {
      const input = await request.json(),
        imported = path.endsWith('/import')
      const items = input.shifts || [input]
      if (!Array.isArray(items) || !items.length || items.length > 100)
        throw new Error('Envía entre 1 y 100 turnos.')
      const records = items.map((item) => ({
        ...prepare(item),
        ...(imported
          ? Number.isFinite(Date.parse(item.createdAt))
            ? { createdAt: new Date(item.createdAt).toISOString() }
            : {}
          : { createdAt: new Date().toISOString() }),
        id:
          imported && /^[\w-]+$/.test(item.id) ? item.id : crypto.randomUUID(),
        shared: true,
      }))
      await env.DB.batch(
        records.map(({ id, shared, ...payload }) =>
          env.DB.prepare(
            `${imported ? 'INSERT OR IGNORE' : 'INSERT'} INTO shifts (id,agent_id,payload) VALUES (?,?,?)`,
          ).bind(id, payload.agente, JSON.stringify(payload)),
        ),
      )
      return json({ shifts: records }, 201)
    } catch (error) {
      return json({ error: error.message }, 400)
    }
  }
  const match = path.match(/^\/api\/shifts\/([\w-]+)$/)
  if (match && ['PATCH', 'DELETE'].includes(method)) {
    if (
      user.role === 'agent' ||
      !can(user, method === 'PATCH' ? 'update' : 'delete')
    )
      return json({ error: 'No tienes permiso para modificar turnos.' }, 403)
    const row = await env.DB.prepare('SELECT payload FROM shifts WHERE id=?')
      .bind(match[1])
      .first()
    if (!row) return json({ error: 'Turno no encontrado.' }, 404)
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM shifts WHERE id=?').bind(match[1]).run()
      return json({ ok: true })
    }
    try {
      const shift = {
        ...prepare({
          ...JSON.parse(row.payload),
          ...(await request.json()),
        }),
        ...(JSON.parse(row.payload).createdAt
          ? { createdAt: JSON.parse(row.payload).createdAt }
          : {}),
      }
      await env.DB.prepare('UPDATE shifts SET agent_id=?,payload=? WHERE id=?')
        .bind(shift.agente, JSON.stringify(shift), match[1])
        .run()
      return json({ shift: { ...shift, id: match[1], shared: true } })
    } catch (error) {
      return json({ error: error.message }, 400)
    }
  }
  return json({ error: 'Ruta no encontrada.' }, 404)
}
