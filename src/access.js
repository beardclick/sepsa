export const MODULES = {
  dashboard: 'Dashboard',
  clients: 'Clientes',
  agents: 'Agentes',
  contracts: 'Contratos',
  shifts: 'Turnos y calendario',
  rounds: 'Rondas',
  incidents: 'Incidentes',
  equipment: 'Equipos y categorías',
  leads: 'Prospectos',
  reports: 'Informes',
  settings: 'Ajustes',
  users: 'Usuarios y permisos',
  portal: 'Portal del agente',
}
export const ACTIONS = {
  view: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
}
export const fullPermissions = () =>
  Object.fromEntries(Object.keys(MODULES).map((k) => [k, Object.keys(ACTIONS)]))
export function initialRoles() {
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
  return [
    { id: 'admin', nombre: 'Administradores', permissions: fullPermissions() },
    {
      id: 'chief',
      nombre: 'Jefes de seguridad',
      permissions: Object.fromEntries([
        ...ops.map((k) => [k, ['view', 'create', 'update']]),
        ['rounds', ['view']],
      ]),
    },
    {
      id: 'supervisor',
      nombre: 'Supervisores',
      permissions: Object.fromEntries(
        [
          'dashboard',
          'rounds',
          'agents',
          'shifts',
          'incidents',
          'equipment',
          'reports',
          'portal',
        ].map((k) => [
          k,
          k === 'incidents' ? ['view', 'create', 'update'] : ['view'],
        ]),
      ),
    },
    {
      id: 'agent',
      nombre: 'Agentes',
      permissions: { portal: ['view', 'create'] },
    },
  ]
}
export const moduleForPath = (path) =>
  ({
    '': 'dashboard',
    clientes: 'clients',
    agentes: 'agents',
    contratos: 'contracts',
    turnos: 'shifts',
    rondas: 'rounds',
    calendario: 'shifts',
    incidentes: 'incidents',
    equipos: 'equipment',
    prospectos: 'leads',
    informes: 'reports',
    ajustes: 'settings',
    usuarios: 'users',
    'portal-agente': 'portal',
  })[path.split('/')[1]]
export const homeFor = (permissions) =>
  Object.entries({
    dashboard: '/',
    portal: '/portal-agente',
    clients: '/clientes',
    agents: '/agentes',
    contracts: '/contratos',
    shifts: '/turnos',
    rounds: '/rondas',
    incidents: '/incidentes',
    equipment: '/equipos',
    leads: '/prospectos',
    reports: '/informes',
    settings: '/ajustes',
    users: '/usuarios',
  }).find(([k]) => permissions?.[k]?.includes('view'))?.[1]
export async function passwordHash(password, salt) {
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
      iterations: 210000,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return Array.from(new Uint8Array(bits), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}
export async function credentials(password) {
  const salt = crypto.randomUUID()
  return { salt, passwordHash: await passwordHash(password, salt) }
}
