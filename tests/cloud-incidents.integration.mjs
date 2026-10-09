import assert from 'node:assert/strict'
import { once } from 'node:events'
import WebSocket from 'ws'

const base = 'http://127.0.0.1:8787'
const password = 'Local-only-test-password-2026'
const suffix = Date.now()
const sockets = [],
  created = [],
  users = [],
  shifts = [],
  rounds = []
async function request(path, method = 'GET', body, cookie) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json()
  return {
    status: response.status,
    ...payload,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  }
}
async function connect(cookie) {
  const socket = new WebSocket(
    base.replace('http:', 'ws:') + '/api/incidents/live',
    { headers: { Cookie: cookie, Origin: base } },
  )
  const messages = []
  socket.on('message', (raw) => messages.push(JSON.parse(String(raw))))
  await once(socket, 'open')
  sockets.push(socket)
  return { socket, messages }
}
async function waitFor(test) {
  const start = Date.now()
  while (!test()) {
    if (Date.now() - start > 10000)
      throw new Error('No llegó el aviso WebSocket.')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

let admin
try {
  const state = await request('/api/auth/state')
  admin = state.initialized
    ? await request('/api/auth/login', 'POST', {
        email: 'admin@example.com',
        password,
      })
    : await request('/api/auth/bootstrap', 'POST', {
        name: 'Admin de pruebas',
        email: 'admin@example.com',
        password,
        setupKey: 'local-integration-only',
      })
  assert.ok(admin.cookie, JSON.stringify(admin))
  const agent = await request(
    '/api/agents',
    'POST',
    {
      nombre: 'Agente de pruebas',
      documento: `doc-${suffix}`,
      email: `agent-${suffix}@example.com`,
      password,
      sitio: 'site-test',
      clienteNombre: 'Puesto de pruebas',
    },
    admin.cookie,
  )
  assert.equal(agent.status, 201, JSON.stringify(agent))
  const agentId = agent.agentId
  assert.equal(agent.user.agent, agentId)
  assert.equal(agent.user.role, 'agent')
  const duplicate = await request(
    '/api/agents',
    'POST',
    {
      nombre: 'Duplicado',
      documento: 'test',
      email: agent.user.username,
      password,
    },
    admin.cookie,
  )
  assert.equal(duplicate.status, 400)
  const supervisor = await request(
    '/api/admin/users',
    'POST',
    {
      name: 'Supervisor',
      email: `supervisor-${suffix}@example.com`,
      password,
      roleId: 'supervisor',
    },
    admin.cookie,
  )
  assert.equal(agent.status, 201)
  assert.equal(supervisor.status, 201)
  users.push(agent.user.id, supervisor.user.id)
  const agentLogin = await request('/api/auth/login', 'POST', {
    email: agent.user.username,
    password,
  })
  const scheduled = await request(
    '/api/shifts',
    'POST',
    {
      shifts: [
        {
          agente: agentId,
          cliente: 'site-test',
          fecha: '2026-10-08',
          inicio: '18:00',
          fin: '06:00',
          estado: 'Programado',
          agenteNombre: 'Agente de pruebas',
          clienteNombre: 'Puesto de pruebas',
        },
        {
          agente: 'other-agent',
          cliente: 'other-site',
          fecha: '2026-10-08',
          inicio: '06:00',
          fin: '18:00',
          estado: 'Programado',
        },
      ],
    },
    admin.cookie,
  )
  assert.equal(scheduled.status, 201)
  shifts.push(...scheduled.shifts.map((s) => s.id))
  assert.equal(
    (await request('/api/shifts', 'GET', undefined, admin.cookie)).shifts[0].id,
    shifts[1],
  )
  const myShifts = await request(
    '/api/shifts',
    'GET',
    undefined,
    agentLogin.cookie,
  )
  assert.equal(myShifts.status, 200)
  assert.equal(myShifts.shifts.length, 1)
  assert.equal(myShifts.shifts[0].agente, agentId)
  assert.equal(myShifts.shifts[0].fin, '06:00')
  assert.equal(
    (
      await request(
        '/api/shifts',
        'POST',
        scheduled.shifts[0],
        agentLogin.cookie,
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await request(
        `/api/shifts/${shifts[0]}`,
        'PATCH',
        { fin: '07:00' },
        agentLogin.cookie,
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await request(
        `/api/shifts/${shifts[0]}`,
        'PATCH',
        { fin: '07:00' },
        admin.cookie,
      )
    ).status,
    200,
  )
  assert.equal(
    (await request('/api/shifts', 'GET', undefined, agentLogin.cookie))
      .shifts[0].fin,
    '07:00',
  )
  const orderedShifts = (
    await request('/api/shifts', 'GET', undefined, admin.cookie)
  ).shifts
  assert.equal(orderedShifts[0].id, shifts[1])
  assert.equal(
    orderedShifts.find((s) => s.id === shifts[0]).createdAt,
    scheduled.shifts[0].createdAt,
  )
  const supervisorLogin = await request('/api/auth/login', 'POST', {
    email: supervisor.user.username,
    password,
  })
  const chief = await request(
    '/api/admin/users',
    'POST',
    {
      name: 'Jefe rondas',
      email: `chief-${suffix}@example.com`,
      password,
      roleId: 'chief',
    },
    admin.cookie,
  )
  assert.equal(chief.status, 201)
  users.push(chief.user.id)
  const chiefLogin = await request('/api/auth/login', 'POST', {
    email: chief.user.username,
    password,
  })
  const roundInput = {
    titulo: 'Ronda nocturna',
    lugar: 'David, puesto central',
    fecha: '2026-10-10',
    inicio: '22:00',
    fin: '01:00',
    asignados: [supervisor.user.id, chief.user.id],
    comentarios: 'Revisar accesos',
  }
  assert.equal(
    (await request('/api/rounds', 'POST', roundInput, supervisorLogin.cookie))
      .status,
    403,
  )
  assert.equal(
    (await request('/api/rounds', 'GET', undefined, agentLogin.cookie)).status,
    403,
  )
  assert.equal(
    (
      await request(
        '/api/rounds',
        'POST',
        { ...roundInput, asignados: [agent.user.id] },
        admin.cookie,
      )
    ).status,
    400,
  )
  const round = await request('/api/rounds', 'POST', roundInput, admin.cookie)
  assert.equal(round.status, 201, JSON.stringify(round))
  rounds.push(round.round.id)
  const hidden = await request(
    '/api/rounds',
    'POST',
    { ...roundInput, titulo: 'Solo jefe', asignados: [chief.user.id] },
    admin.cookie,
  )
  assert.equal(hidden.status, 201)
  rounds.push(hidden.round.id)
  const supervisorRounds = await request(
    '/api/rounds',
    'GET',
    undefined,
    supervisorLogin.cookie,
  )
  assert.equal(supervisorRounds.rounds.length, 1)
  assert.equal(supervisorRounds.rounds[0].id, round.round.id)
  const chiefRounds = await request(
    '/api/rounds',
    'GET',
    undefined,
    chiefLogin.cookie,
  )
  assert.equal(chiefRounds.rounds.length, 2)
  assert.equal(chiefRounds.rounds[0].id, hidden.round.id)
  assert.equal(
    (
      await request(
        '/api/rounds/' + round.round.id,
        'PATCH',
        roundInput,
        chiefLogin.cookie,
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await request(
        '/api/rounds/' + round.round.id,
        'DELETE',
        undefined,
        supervisorLogin.cookie,
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await request(
        '/api/rounds/' + round.round.id,
        'PATCH',
        { ...roundInput, asignados: [chief.user.id] },
        admin.cookie,
      )
    ).status,
    200,
  )
  assert.equal(
    (await request('/api/rounds', 'GET', undefined, supervisorLogin.cookie))
      .rounds.length,
    0,
  )
  assert.equal(
    (
      await request(
        '/api/rounds/' + hidden.round.id,
        'DELETE',
        undefined,
        admin.cookie,
      )
    ).status,
    200,
  )
  console.log(
    'PASS: rondas compartidas, asignación múltiple, aislamiento y CRUD exclusivo del administrador.',
  )
  const adminLive = await connect(admin.cookie),
    supervisorLive = await connect(supervisorLogin.cookie)
  const saved = await request(
    '/api/incidents',
    'POST',
    {
      titulo: 'Reporte del agente',
      severidad: 'Alta',
      descripcion: 'Integración local',
      fecha: '2026-10-01',
      agente: 'otro-agente',
      cliente: 'otro-puesto',
      createdBy: 'falso',
    },
    agentLogin.cookie,
  )
  assert.equal(saved.status, 201, JSON.stringify(saved))
  created.push(saved.incident.id)
  assert.equal(saved.incident.agente, agentId)
  assert.equal(saved.incident.cliente, 'site-test')
  assert.equal(saved.incident.createdBy, agent.user.id)
  await waitFor(
    () =>
      adminLive.messages.some((m) => m.id === saved.incident.id) &&
      supervisorLive.messages.some((m) => m.id === saved.incident.id),
  )
  assert.equal(
    adminLive.messages.find((m) => m.id === saved.incident.id).notify,
    true,
  )
  assert.equal(
    supervisorLive.messages.find((m) => m.id === saved.incident.id).notify,
    true,
  )
  assert.equal(
    (
      await request('/api/incidents', 'GET', undefined, supervisorLogin.cookie)
    ).incidents.some((i) => i.id === saved.incident.id),
    true,
  )
  assert.equal((await request('/api/incidents', 'GET')).status, 401)
  assert.equal(
    (
      await request(
        `/api/incidents/${saved.incident.id}`,
        'PATCH',
        { estado: 'Resuelto' },
        agentLogin.cookie,
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await request(
        `/api/incidents/${saved.incident.id}`,
        'DELETE',
        undefined,
        supervisorLogin.cookie,
      )
    ).status,
    403,
  )
  const own = await request(
    '/api/incidents',
    'POST',
    { titulo: 'Reporte del administrador', severidad: 'Baja' },
    admin.cookie,
  )
  assert.equal(own.status, 201)
  created.push(own.incident.id)
  await waitFor(() => adminLive.messages.some((m) => m.id === own.incident.id))
  assert.equal(
    adminLive.messages.find((m) => m.id === own.incident.id).notify,
    false,
  )
  const mine = await request(
    '/api/incidents',
    'GET',
    undefined,
    agentLogin.cookie,
  )
  assert.equal(
    mine.incidents.some((i) => i.id === own.incident.id),
    false,
  )
  assert.equal(
    mine.incidents.some((i) => i.id === saved.incident.id),
    true,
  )
  const updated = await request(
    `/api/incidents/${saved.incident.id}`,
    'PATCH',
    { estado: 'Resuelto' },
    supervisorLogin.cookie,
  )
  assert.equal(updated.status, 200)
  assert.equal(
    (
      await request('/api/incidents', 'GET', undefined, agentLogin.cookie)
    ).incidents.find((i) => i.id === saved.incident.id).estado,
    'Resuelto',
  )
  assert.equal(updated.incident.createdBy, agent.user.id)
  await request(
    `/api/admin/users/${supervisor.user.id}`,
    'PATCH',
    { active: false },
    admin.cookie,
  )
  const closing = once(supervisorLive.socket, 'close')
  await request(
    `/api/incidents/${saved.incident.id}`,
    'PATCH',
    { estado: 'Abierto' },
    admin.cookie,
  )
  assert.equal((await closing)[0], 1008)
  const newEmail = `updated-agent-${suffix}@example.com`
  const newPassword = 'New-agent-password-2026'
  const resetAccess = await request(
    `/api/admin/users/${agent.user.id}`,
    'PATCH',
    { email: newEmail, password: newPassword },
    admin.cookie,
  )
  assert.equal(resetAccess.status, 200)
  assert.equal(resetAccess.user.agent, agentId)
  assert.equal(resetAccess.user.username, newEmail)
  assert.equal(
    (await request('/api/auth/me', 'GET', undefined, agentLogin.cookie)).status,
    401,
  )
  assert.equal(
    (await request('/api/auth/login', 'POST', { email: newEmail, password }))
      .status,
    401,
  )
  const newLogin = await request('/api/auth/login', 'POST', {
    email: newEmail,
    password: newPassword,
  })
  assert.equal(newLogin.status, 200)
  assert.equal(newLogin.user.id, agent.user.id)
  console.log(
    'PASS: D1 compartido, identidad del agente, avisos entre sesiones, exclusión del creador, permisos y revocación.',
  )
} finally {
  for (const socket of sockets) socket.close()
  if (admin?.cookie) {
    for (const id of rounds)
      await request(`/api/rounds/${id}`, 'DELETE', undefined, admin.cookie)
    for (const id of shifts)
      await request(`/api/shifts/${id}`, 'DELETE', undefined, admin.cookie)
    for (const id of created)
      await request(`/api/incidents/${id}`, 'DELETE', undefined, admin.cookie)
    for (const id of users)
      await request(`/api/admin/users/${id}`, 'DELETE', undefined, admin.cookie)
  }
}
