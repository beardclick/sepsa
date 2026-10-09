import { handleIncidents } from './incidents.js'
export { IncidentHub } from './incident-hub.js'
const SESSION_COOKIE = 'sepsa_session'
const SESSION_SECONDS = 60 * 60 * 24 * 7
const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}
const actions = ['view', 'create', 'update', 'delete']
const moduleKeys = [
  'dashboard',
  'clients',
  'agents',
  'contracts',
  'shifts',
  'incidents',
  'equipment',
  'leads',
  'reports',
  'settings',
  'users',
  'portal',
]
const ops = [
  'dashboard',
  'clients',
  'agents',
  'contracts',
  'shifts',
  'incidents',
  'equipment',
  'reports',
  'portal',
]
const initialRoles = [
  {
    id: 'admin',
    name: 'Administradores',
    permissions: Object.fromEntries(moduleKeys.map((key) => [key, actions])),
  },
  {
    id: 'chief',
    name: 'Jefes de seguridad',
    permissions: Object.fromEntries(
      ops.map((key) => [key, ['view', 'create', 'update']]),
    ),
  },
  {
    id: 'supervisor',
    name: 'Supervisores',
    permissions: Object.fromEntries(
      [
        'dashboard',
        'agents',
        'shifts',
        'incidents',
        'equipment',
        'reports',
        'portal',
      ].map((key) => [
        key,
        key === 'incidents' ? ['view', 'create', 'update'] : ['view'],
      ]),
    ),
  },
  { id: 'agent', name: 'Agentes', permissions: { portal: ['view', 'create'] } },
]

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...headers },
  })
}
function readCookie(request) {
  return (
    request.headers
      .get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1) || ''
  )
}
function hex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}
async function digest(value) {
  return hex(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  )
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return hex(bits)
}
function safeUser(row) {
  return {
    id: row.id,
    nombre: row.name,
    username: row.email,
    role: row.role_id,
    activo: !!row.active,
    agent: row.agent_id || '',
  }
}
function safeRole(row) {
  return {
    id: row.id,
    nombre: row.name,
    permissions: JSON.parse(row.permissions),
  }
}
async function currentUser(request, env) {
  const token = readCookie(request)
  if (!token) return null
  const row = await env.DB.prepare(
    `SELECT u.id,u.name,u.email,u.role_id,u.active,u.agent_id,r.name AS role_name,r.permissions FROM sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id WHERE s.token_hash=? AND s.expires_at>?`,
  )
    .bind(await digest(token), Date.now())
    .first()
  if (!row?.active) return null
  return {
    ...safeUser(row),
    roleData: safeRole({
      id: row.role_id,
      name: row.role_name,
      permissions: row.permissions,
    }),
  }
}
function cookie(value, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
}
function sameOrigin(request) {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}
async function body(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}
function validEmail(value) {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
}
function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128
}
async function createSession(env, userId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)))
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)',
  )
    .bind(await digest(token), userId, Date.now() + SESSION_SECONDS * 1000)
    .run()
  return token
}
async function createUser(env, input, roleId, profile = null) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  const id = crypto.randomUUID()
  const statement = env.DB.prepare(
    'INSERT INTO users (id,name,email,role_id,active,agent_id,password_salt,password_hash) VALUES (?,?,?,?,?,?,?,?)',
  ).bind(
    id,
    input.name.trim(),
    input.email.trim().toLowerCase(),
    roleId,
    input.active === false ? 0 : 1,
    input.agentId || null,
    salt,
    await passwordHash(input.password, salt),
  )

  if (profile)
    await env.DB.batch([
      statement,
      env.DB.prepare(
        'INSERT INTO incident_directory (id,payload) VALUES (?,?)',
      ).bind(input.agentId, JSON.stringify(profile)),
    ])
  else await statement.run()
  return {
    id,
    nombre: input.name.trim(),
    username: input.email.trim().toLowerCase(),
    role: roleId,
    activo: input.active !== false,
    agent: input.agentId || '',
  }
}
async function rateLimit(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown'
  const key = await digest(ip)
  const now = Date.now()
  const row = await env.DB.prepare(
    'SELECT window_started, attempts FROM login_attempts WHERE ip_hash=?',
  )
    .bind(key)
    .first()
  if (row && now - row.window_started < 60_000 && row.attempts >= 10)
    return false
  if (!row || now - row.window_started >= 60_000) {
    await env.DB.prepare(
      'INSERT INTO login_attempts (ip_hash,window_started,attempts) VALUES (?,?,1) ON CONFLICT(ip_hash) DO UPDATE SET window_started=excluded.window_started,attempts=1',
    )
      .bind(key, now)
      .run()
  } else {
    await env.DB.prepare(
      'UPDATE login_attempts SET attempts=attempts+1 WHERE ip_hash=?',
    )
      .bind(key)
      .run()
  }
  return true
}

async function api(request, env) {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method
  if (method !== 'GET' && !sameOrigin(request))
    return response({ error: 'Origen no permitido.' }, 403)
  if (path === '/api/auth/state' && method === 'GET') {
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM users',
    ).first()
    return response({
      initialized: count.count > 0,
      adminEmail: env.BOOTSTRAP_ADMIN_EMAIL || '',
    })
  }
  if (path === '/api/auth/bootstrap' && method === 'POST') {
    const input = await body(request)
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM users',
    ).first()
    if (count.count)
      return response({ error: 'El acceso inicial ya fue configurado.' }, 409)
    const validKey =
      typeof input.setupKey === 'string' &&
      typeof env.BOOTSTRAP_SETUP_KEY === 'string' &&
      input.setupKey.length === env.BOOTSTRAP_SETUP_KEY.length &&
      (await digest(input.setupKey)) === (await digest(env.BOOTSTRAP_SETUP_KEY))
    if (
      !validKey ||
      !validEmail(input.email) ||
      input.email.trim().toLowerCase() !==
        env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase()
    )
      return response(
        { error: 'El enlace de configuración no es válido.' },
        403,
      )
    if (!input.name?.trim() || !validPassword(input.password))
      return response(
        {
          error: 'Indica tu nombre y una contraseña de al menos 12 caracteres.',
        },
        400,
      )
    await env.DB.batch(
      initialRoles.map((role) =>
        env.DB.prepare(
          'INSERT OR IGNORE INTO roles (id,name,permissions) VALUES (?,?,?)',
        ).bind(role.id, role.name, JSON.stringify(role.permissions)),
      ),
    )
    const user = await createUser(
      env,
      { name: input.name, email: input.email, password: input.password },
      'admin',
    )
    const token = await createSession(env, user.id)
    return response({ user, role: initialRoles[0] }, 201, {
      'set-cookie': cookie(token),
    })
  }
  if (path === '/api/auth/login' && method === 'POST') {
    if (!(await rateLimit(request, env)))
      return response({ error: 'Demasiados intentos. Espera un minuto.' }, 429)
    const input = await body(request)
    const row = await env.DB.prepare(
      'SELECT u.id,u.name,u.email,u.role_id,u.active,u.agent_id,u.password_salt,u.password_hash,r.name AS role_name,r.permissions FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=?',
    )
      .bind(
        String(input.email || '')
          .trim()
          .toLowerCase(),
      )
      .first()
    const check = await passwordHash(
      typeof input.password === 'string' ? input.password : '',
      row?.password_salt || 'sepsa-auth-padding',
    )
    if (!row || !row.active || check !== row.password_hash)
      return response({ error: 'Correo o contraseña incorrectos.' }, 401)
    const token = await createSession(env, row.id)
    return response(
      {
        user: safeUser(row),
        role: safeRole({
          id: row.role_id,
          name: row.role_name,
          permissions: row.permissions,
        }),
      },
      200,
      { 'set-cookie': cookie(token) },
    )
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    const token = readCookie(request)
    if (token)
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?')
        .bind(await digest(token))
        .run()
    return response({ ok: true }, 200, { 'set-cookie': cookie('', 0) })
  }
  const user = await currentUser(request, env)
  if (path === '/api/auth/me' && method === 'GET')
    return user
      ? response({
          user: {
            id: user.id,
            nombre: user.nombre,
            username: user.username,
            role: user.role,
            activo: user.activo,
            agent: user.agent,
          },
          role: user.roleData,
        })
      : response({ error: 'No has iniciado sesión.' }, 401)
  if (!user) return response({ error: 'No has iniciado sesión.' }, 401)
  if (path.startsWith('/api/incidents') || path === '/api/incident-directory')
    return handleIncidents(
      request,
      env,
      user,
      await digest(readCookie(request)),
    )
  if (path === '/api/agents' && method === 'POST') {
    if (!user.roleData.permissions?.agents?.includes('create'))
      return response({ error: 'No tienes permiso para crear agentes.' }, 403)
    const input = await body(request)
    if (
      !input.nombre?.trim() ||
      !input.documento?.trim() ||
      !validEmail(input.email) ||
      !validPassword(input.password)
    )
      return response(
        {
          error:
            'Indica nombre, documento, correo válido y contraseña de al menos 12 caracteres.',
        },
        400,
      )
    const agentId = crypto.randomUUID()
    try {
      const access = await createUser(
        env,
        {
          name: input.nombre,
          email: input.email,
          password: input.password,
          agentId,
        },
        'agent',
        {
          id: agentId,
          nombre: input.nombre.trim(),
          sitio: input.sitio || '',
          clienteNombre: input.clienteNombre || '',
        },
      )
      return response({ user: access, agentId }, 201)
    } catch (error) {
      return response(
        {
          error: error.message.includes('UNIQUE')
            ? 'Este correo ya tiene un acceso. Usa otro correo.'
            : 'No se pudo crear el acceso del agente.',
        },
        400,
      )
    }
  }
  const can = (action) => user.roleData.permissions?.users?.includes(action)
  if (path === '/api/admin/users' && method === 'GET') {
    if (!can('view'))
      return response({ error: 'No tienes permiso para ver usuarios.' }, 403)
    const result = await env.DB.prepare(
      'SELECT id,name,email,role_id,active,agent_id FROM users ORDER BY name',
    ).all()
    return response({ users: result.results.map(safeUser) })
  }
  if (path === '/api/admin/roles' && method === 'GET') {
    if (!can('view'))
      return response({ error: 'No tienes permiso para ver roles.' }, 403)
    const result = await env.DB.prepare(
      'SELECT id,name,permissions FROM roles ORDER BY name',
    ).all()
    return response({ roles: result.results.map(safeRole) })
  }
  if (path === '/api/admin/users' && method === 'POST') {
    if (!can('create'))
      return response({ error: 'No tienes permiso para crear usuarios.' }, 403)
    const input = await body(request)
    if (
      !input.name?.trim() ||
      !validEmail(input.email) ||
      !validPassword(input.password)
    )
      return response(
        {
          error:
            'Indica nombre, correo válido y una contraseña de al menos 12 caracteres.',
        },
        400,
      )
    if (input.agentId) {
      const linked = await env.DB.prepare(
        'SELECT id FROM users WHERE agent_id=?',
      )
        .bind(input.agentId)
        .first()
      if (linked)
        return response({ error: 'Este agente ya tiene un acceso.' }, 409)
    }
    try {
      return response({ user: await createUser(env, input, input.roleId) }, 201)
    } catch (error) {
      return response(
        {
          error: error.message.includes('UNIQUE')
            ? 'Ese correo o agente ya existe.'
            : 'No se pudo crear el usuario.',
        },
        400,
      )
    }
  }
  const userMatch = path.match(/^\/api\/admin\/users\/([\w-]+)$/)
  if (userMatch && method === 'PATCH') {
    if (!can('update'))
      return response({ error: 'No tienes permiso para editar usuarios.' }, 403)
    const target = userMatch[1]
    const input = await body(request)
    const previous = await env.DB.prepare('SELECT * FROM users WHERE id=?')
      .bind(target)
      .first()
    if (!previous) return response({ error: 'Usuario no encontrado.' }, 404)
    if (input.email !== undefined && !validEmail(input.email))
      return response({ error: 'Indica un correo válido.' }, 400)
    if (input.name !== undefined && !input.name.trim())
      return response({ error: 'El nombre es obligatorio.' }, 400)
    if (
      input.roleId &&
      !(await env.DB.prepare('SELECT id FROM roles WHERE id=?')
        .bind(input.roleId)
        .first())
    )
      return response({ error: 'Selecciona un rol válido.' }, 400)
    if (input.agentId) {
      const linked = await env.DB.prepare(
        'SELECT id FROM users WHERE agent_id=? AND id<>?',
      )
        .bind(input.agentId, target)
        .first()
      if (linked)
        return response({ error: 'Este agente ya tiene un acceso.' }, 409)
    }
    if (input.roleId === 'admin' && previous.role_id !== 'admin') {
      const adminRole = user.roleData.permissions?.users?.includes('delete')
      if (!adminRole)
        return response(
          { error: 'Solo un administrador puede asignar ese rol.' },
          403,
        )
    }
    if (
      previous.role_id === 'admin' &&
      (input.active === false || (input.roleId && input.roleId !== 'admin'))
    ) {
      const admins = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM users WHERE role_id='admin' AND active=1 AND id<>?",
      )
        .bind(target)
        .first()
      if (!admins.count)
        return response(
          { error: 'Debe quedar al menos un administrador activo.' },
          409,
        )
    }
    const salt = input.password
      ? hex(crypto.getRandomValues(new Uint8Array(16)))
      : previous.password_salt
    const hash = input.password
      ? await passwordHash(input.password, salt)
      : previous.password_hash
    if (input.password && !validPassword(input.password))
      return response(
        { error: 'La contraseña debe tener al menos 12 caracteres.' },
        400,
      )
    try {
      await env.DB.prepare(
        'UPDATE users SET name=?,email=?,role_id=?,active=?,agent_id=?,password_salt=?,password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
      )
        .bind(
          input.name?.trim() || previous.name,
          input.email ? input.email.trim().toLowerCase() : previous.email,
          input.roleId || previous.role_id,
          input.active === undefined ? previous.active : input.active ? 1 : 0,
          input.agentId === undefined
            ? previous.agent_id
            : input.agentId || null,
          salt,
          hash,
          target,
        )
        .run()
      if (input.password)
        await env.DB.prepare('DELETE FROM sessions WHERE user_id=?')
          .bind(target)
          .run()
      const updated = await env.DB.prepare(
        'SELECT id,name,email,role_id,active,agent_id FROM users WHERE id=?',
      )
        .bind(target)
        .first()
      return response({ user: safeUser(updated) })
    } catch {
      return response({ error: 'No se pudo guardar el usuario.' }, 400)
    }
  }
  if (userMatch && method === 'DELETE') {
    if (!can('delete'))
      return response(
        { error: 'No tienes permiso para eliminar usuarios.' },
        403,
      )
    const target = userMatch[1]
    if (target === user.id)
      return response({ error: 'No puedes eliminar tu propio acceso.' }, 400)
    const targetUser = await env.DB.prepare(
      'SELECT role_id FROM users WHERE id=?',
    )
      .bind(target)
      .first()
    if (!targetUser) return response({ error: 'Usuario no encontrado.' }, 404)
    if (targetUser.role_id === 'admin') {
      const admins = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM users WHERE role_id='admin' AND active=1 AND id<>?",
      )
        .bind(target)
        .first()
      if (!admins.count)
        return response(
          { error: 'Debe quedar al menos un administrador activo.' },
          409,
        )
    }
    await env.DB.prepare('DELETE FROM users WHERE id=?').bind(target).run()
    return response({ ok: true })
  }
  const roleMatch = path.match(/^\/api\/admin\/roles\/([\w-]+)$/)
  if (path === '/api/admin/roles' && method === 'POST') {
    if (!can('create'))
      return response({ error: 'No tienes permiso para crear roles.' }, 403)
    const input = await body(request)
    if (
      !input.name?.trim() ||
      !input.permissions ||
      Object.keys(input.permissions).some(
        (key) =>
          !moduleKeys.includes(key) ||
          !Array.isArray(input.permissions[key]) ||
          input.permissions[key].some((action) => !actions.includes(action)),
      )
    )
      return response({ error: 'El rol o sus permisos no son válidos.' }, 400)
    const id = crypto.randomUUID()
    try {
      await env.DB.prepare(
        'INSERT INTO roles (id,name,permissions) VALUES (?,?,?)',
      )
        .bind(id, input.name.trim(), JSON.stringify(input.permissions))
        .run()
      return response(
        {
          role: {
            id,
            nombre: input.name.trim(),
            permissions: input.permissions,
          },
        },
        201,
      )
    } catch {
      return response({ error: 'Ya existe un rol con ese nombre.' }, 409)
    }
  }
  if (roleMatch && method === 'PATCH') {
    if (!can('update'))
      return response({ error: 'No tienes permiso para editar roles.' }, 403)
    const id = roleMatch[1]
    const input = await body(request)
    const previous = await env.DB.prepare('SELECT * FROM roles WHERE id=?')
      .bind(id)
      .first()
    if (!previous) return response({ error: 'Rol no encontrado.' }, 404)
    if (
      !input.name?.trim() ||
      !input.permissions ||
      Object.keys(input.permissions).some(
        (key) =>
          !moduleKeys.includes(key) ||
          !Array.isArray(input.permissions[key]) ||
          input.permissions[key].some((action) => !actions.includes(action)),
      )
    )
      return response({ error: 'El rol o sus permisos no son válidos.' }, 400)
    const permissions = structuredClone(input.permissions)
    if (id === 'admin') permissions.users = actions
    try {
      await env.DB.prepare('UPDATE roles SET name=?,permissions=? WHERE id=?')
        .bind(input.name.trim(), JSON.stringify(permissions), id)
        .run()
      return response({ role: { id, nombre: input.name.trim(), permissions } })
    } catch {
      return response({ error: 'Ya existe un rol con ese nombre.' }, 409)
    }
  }
  if (roleMatch && method === 'DELETE') {
    if (!can('delete'))
      return response({ error: 'No tienes permiso para eliminar roles.' }, 403)
    const id = roleMatch[1]
    if (id === 'admin')
      return response(
        { error: 'El rol Administradores no se puede eliminar.' },
        400,
      )
    const used = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM users WHERE role_id=?',
    )
      .bind(id)
      .first()
    if (used.count)
      return response(
        { error: 'Reasigna los usuarios antes de eliminar este rol.' },
        409,
      )
    await env.DB.prepare('DELETE FROM roles WHERE id=?').bind(id).run()
    return response({ ok: true })
  }
  return response({ error: 'Ruta no encontrada.' }, 404)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      try {
        return await api(request, env)
      } catch (error) {
        console.error('CRM API error:', error)
        return response({ error: 'Error interno del servidor.' }, 500)
      }
    }
    return env.ASSETS.fetch(request)
  },
}
