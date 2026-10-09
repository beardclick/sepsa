const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
export async function handleRounds(request, env, user) {
  const path = new URL(request.url).pathname,
    method = request.method
  const admin = user.role === 'admin',
    permissions = user.roleData.permissions?.rounds || []
  if (
    !['admin', 'chief', 'supervisor'].includes(user.role) ||
    !permissions.includes('view')
  )
    return json({ error: 'No tienes acceso a rondas.' }, 403)
  if (path === '/api/rounds/assignees' && method === 'GET') {
    if (!admin)
      return json({ error: 'Solo el administrador puede asignar rondas.' }, 403)
    const rows = await env.DB.prepare(
      "SELECT id,name,role_id FROM users WHERE active=1 AND role_id IN ('chief','supervisor') ORDER BY name",
    ).all()
    return json({
      users: rows.results.map((r) => ({
        id: r.id,
        nombre: r.name,
        role: r.role_id,
      })),
    })
  }
  if (path === '/api/rounds' && method === 'GET') {
    const rows = admin
      ? await env.DB.prepare(
          'SELECT id,payload,created_at FROM rounds ORDER BY rowid DESC',
        ).all()
      : await env.DB.prepare(
          'SELECT r.id,r.payload,r.created_at FROM rounds r JOIN round_assignments a ON a.round_id=r.id WHERE a.user_id=? ORDER BY r.rowid DESC',
        )
          .bind(user.id)
          .all()
    return json({
      rounds: rows.results.map((r) => ({
        ...JSON.parse(r.payload),
        id: r.id,
        createdAt: r.created_at,
      })),
    })
  }
  const match = path.match(/^\/api\/rounds\/([\w-]+)$/)
  if (
    (path === '/api/rounds' && method === 'POST') ||
    (match && ['PATCH', 'DELETE'].includes(method))
  ) {
    const action =
      method === 'POST' ? 'create' : method === 'PATCH' ? 'update' : 'delete'
    if (!admin || !permissions.includes(action))
      return json(
        { error: 'Solo el administrador puede modificar rondas.' },
        403,
      )
    const id = match?.[1] || crypto.randomUUID()
    if (
      match &&
      !(await env.DB.prepare('SELECT id FROM rounds WHERE id=?')
        .bind(id)
        .first())
    )
      return json({ error: 'Ronda no encontrada.' }, 404)
    if (method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM round_assignments WHERE round_id=?').bind(
          id,
        ),
        env.DB.prepare('DELETE FROM rounds WHERE id=?').bind(id),
      ])
      return json({ ok: true })
    }
    try {
      const input = await request.json()
      const payload = {
        titulo: String(input.titulo || '')
          .trim()
          .slice(0, 160),
        lugar: String(input.lugar || '')
          .trim()
          .slice(0, 300),
        fecha: input.fecha,
        inicio: input.inicio,
        fin: input.fin,
        comentarios: String(input.comentarios || '').slice(0, 3000),
        asignados: [...new Set(input.asignados || [])],
      }
      if (
        !payload.titulo ||
        !payload.lugar ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.fecha) ||
        !['inicio', 'fin'].every((k) =>
          /^([01]\d|2[0-3]):[0-5]\d$/.test(payload[k]),
        ) ||
        payload.inicio === payload.fin ||
        !payload.asignados.length ||
        payload.asignados.length > 100
      )
        throw new Error(
          'Completa el lugar, fecha, horario y al menos un responsable. El horario de inicio y fin debe ser diferente.',
        )
      if (
        !Number.isFinite(Date.parse(payload.fecha + 'T12:00:00Z')) ||
        new Date(payload.fecha + 'T12:00:00Z').toISOString().slice(0, 10) !==
          payload.fecha
      )
        throw new Error('Fecha no válida.')
      for (const assignee of payload.asignados) {
        if (
          !(await env.DB.prepare(
            "SELECT id FROM users WHERE id=? AND active=1 AND role_id IN ('chief','supervisor')",
          )
            .bind(assignee)
            .first())
        )
          throw new Error('Selecciona jefes o supervisores activos.')
      }
      await env.DB.batch([
        method === 'POST'
          ? env.DB.prepare('INSERT INTO rounds (id,payload) VALUES (?,?)').bind(
              id,
              JSON.stringify(payload),
            )
          : env.DB.prepare('UPDATE rounds SET payload=? WHERE id=?').bind(
              JSON.stringify(payload),
              id,
            ),
        env.DB.prepare('DELETE FROM round_assignments WHERE round_id=?').bind(
          id,
        ),
        ...payload.asignados.map((uid) =>
          env.DB.prepare(
            'INSERT INTO round_assignments (round_id,user_id) VALUES (?,?)',
          ).bind(id, uid),
        ),
      ])
      return json({ round: { ...payload, id } }, method === 'POST' ? 201 : 200)
    } catch (error) {
      return json({ error: error.message }, 400)
    }
  }
  return json({ error: 'Ruta no encontrada.' }, 404)
}
