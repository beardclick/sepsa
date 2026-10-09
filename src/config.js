// Definición declarativa de cada módulo: campos del formulario y columnas de la tabla.
export const SERVICES = [
  'Vigilancia física',
  'Monitoreo CCTV',
  'Monitoreo GPS',
  'Escolta y patrullaje',
  'Alarmas y sensores',
  'Entrenamiento táctico',
]

export const RESOURCES = {
  clients: {
    path: 'clientes',
    collection: 'clients',
    singular: 'cliente',
    title: 'Clientes',
    subtitle: 'Empresas, conjuntos y entidades que protegemos',
    titleKey: 'nombre',
    icon: 'Building2',
    imgKey: 'logo',
    related: [
      { title: 'Contratos', res: 'contracts', by: 'cliente' },
      { title: 'Agentes asignados', res: 'agents', by: 'sitio' },
      { title: 'Incidentes', res: 'incidents', by: 'cliente' },
    ],
    filterKey: 'estado',
    fields: [
      { key: 'logo', label: 'Logo / Foto', type: 'image', full: true },
      {
        key: 'nombre',
        label: 'Nombre / Razón social',
        required: true,
        col: true,
        full: true,
      },
      {
        key: 'tipo',
        label: 'Tipo',
        type: 'select',
        options: ['Empresa', 'Industrial', 'Residencial', 'Gobierno'],
        col: true,
      },
      { key: 'contacto', label: 'Persona de contacto', col: true },
      { key: 'telefono', label: 'Teléfono', type: 'tel', col: true },
      { key: 'email', label: 'Correo', type: 'email' },
      { key: 'ciudad', label: 'Ciudad', col: true },
      {
        key: 'ubicacion',
        label: 'Ubicación del cliente',
        type: 'location',
        full: true,
      },
      {
        key: 'estado',
        label: 'Estado',
        type: 'select',
        options: ['Activo', 'Prospecto', 'Inactivo'],
        col: true,
        badge: true,
      },
    ],
  },
  agents: {
    path: 'agentes',
    collection: 'agents',
    singular: 'agente',
    title: 'Agentes',
    subtitle: 'Personal operativo de seguridad',
    titleKey: 'nombre',
    icon: 'UserRound',
    imgKey: 'foto',
    related: [
      { title: 'Turnos', res: 'shifts', by: 'agente' },
      { title: 'Incidentes reportados', res: 'incidents', by: 'agente' },
      { title: 'Equipo asignado', res: 'equipment', by: 'asignado' },
    ],
    filterKey: 'estado',
    fields: [
      { key: 'foto', label: 'Foto del agente', type: 'image', full: true },
      {
        key: 'nombre',
        label: 'Nombre completo',
        required: true,
        col: true,
        full: true,
      },
      { key: 'documento', label: 'Documento', required: true, col: true },
      {
        key: 'cargo',
        label: 'Cargo',
        type: 'select',
        options: ['Guardia', 'Supervisor', 'Escolta', 'Operador CCTV'],
        col: true,
      },
      { key: 'telefono', label: 'Teléfono', type: 'tel', col: true },
      {
        key: 'sitio',
        label: 'Puesto asignado',
        type: 'select',
        ref: 'clients',
        col: true,
      },
      { key: 'licencia', label: 'Vence licencia', type: 'date', col: true },
      { key: 'ingreso', label: 'Fecha de ingreso', type: 'date' },
      { key: 'emergencia', label: 'Contacto de emergencia' },
      {
        key: 'email',
        label: 'Correo de acceso',
        type: 'email',
        required: true,
        createOnly: true,
      },
      {
        key: 'password',
        label: 'Contraseña inicial (mínimo 12 caracteres)',
        type: 'password',
        required: true,
        createOnly: true,
      },
      {
        key: 'estado',
        label: 'Estado',
        type: 'select',
        options: ['Activo', 'Descanso', 'Licencia', 'Retirado'],
        col: true,
        badge: true,
      },
    ],
  },
  contracts: {
    path: 'contratos',
    collection: 'contracts',
    singular: 'contrato',
    title: 'Contratos',
    subtitle: 'Servicios contratados y su vigencia',
    icon: 'FileSignature',
    related: [
      {
        title: 'Incidentes en el sitio',
        res: 'incidents',
        by: 'cliente',
        via: 'cliente',
      },
    ],
    filterKey: 'estado',
    fields: [
      {
        key: 'cliente',
        label: 'Cliente',
        type: 'select',
        ref: 'clients',
        required: true,
        col: true,
      },
      {
        key: 'servicio',
        label: 'Servicio',
        type: 'select',
        catalog: 'serviceTypes',
        col: true,
      },
      { key: 'documentos', label: 'Documentos PDF', type: 'pdf', full: true },
      {
        key: 'agentes',
        label: 'Agentes requeridos',
        type: 'number',
        col: true,
      },
      { key: 'valor', label: 'Valor mensual', type: 'money', col: true },
      { key: 'inicio', label: 'Inicio', type: 'date', col: true },
      { key: 'fin', label: 'Fin', type: 'date', col: true },
      {
        key: 'estado',
        label: 'Estado',
        type: 'select',
        options: ['Vigente', 'Por vencer', 'Vencido'],
        col: true,
        badge: true,
      },
    ],
  },
  shifts: {
    path: 'turnos',
    collection: 'shifts',
    singular: 'turno',
    title: 'Turnos',
    subtitle: 'Programación de agentes por puesto',
    icon: 'CalendarClock',
    dateRange: 'fecha',
    related: [
      {
        title: 'Otros turnos del agente',
        res: 'shifts',
        by: 'agente',
        via: 'agente',
      },
    ],
    filterKey: 'estado',
    fields: [
      {
        key: 'agente',
        label: 'Agente',
        type: 'select',
        ref: 'agents',
        required: true,
        col: true,
      },
      {
        key: 'cliente',
        label: 'Puesto / Cliente',
        type: 'select',
        ref: 'clients',
        required: true,
        col: true,
      },
      { key: 'fecha', label: 'Fecha', type: 'date', required: true, col: true },
      { key: 'inicio', label: 'Hora inicio', type: 'time', col: true },
      { key: 'fin', label: 'Hora fin', type: 'time', col: true },
      {
        key: 'tipo',
        label: 'Tipo',
        type: 'select',
        options: ['Diurno', 'Nocturno', '24 horas'],
      },
      {
        key: 'estado',
        label: 'Estado',
        type: 'select',
        options: ['Programado', 'Completado', 'Ausente'],
        col: true,
        badge: true,
      },
    ],
  },
  incidents: {
    path: 'incidentes',
    collection: 'incidents',
    singular: 'incidente',
    title: 'Incidentes',
    subtitle: 'Reportes y novedades de seguridad',
    icon: 'ShieldAlert',
    dateRange: 'fecha',
    imgKey: 'evidencia',
    related: [
      {
        title: 'Otros incidentes del sitio',
        res: 'incidents',
        by: 'cliente',
        via: 'cliente',
      },
    ],
    filterKey: 'estado',
    fields: [
      { key: 'titulo', label: 'Título', required: true, col: true, full: true },
      {
        key: 'cliente',
        label: 'Cliente / Sitio',
        type: 'select',
        ref: 'clients',
        col: true,
      },
      {
        key: 'agente',
        label: 'Agente reportante',
        type: 'select',
        ref: 'agents',
        col: true,
      },
      { key: 'fecha', label: 'Fecha', type: 'date', col: true },
      {
        key: 'severidad',
        label: 'Severidad',
        type: 'select',
        options: ['Baja', 'Media', 'Alta', 'Crítica'],
        col: true,
        badge: true,
      },
      {
        key: 'estado',
        label: 'Estado',
        type: 'select',
        options: ['Abierto', 'En curso', 'Resuelto'],
        col: true,
        badge: true,
      },
      {
        key: 'descripcion',
        label: 'Descripción',
        type: 'textarea',
        full: true,
      },
      {
        key: 'evidencia',
        label: 'Foto / evidencia',
        type: 'image',
        full: true,
      },
    ],
  },
  leads: {
    path: 'prospectos',
    collection: 'leads',
    singular: 'prospecto',
    title: 'Prospectos',
    subtitle: 'Embudo comercial y cotizaciones',
    icon: 'Target',
    filterKey: 'etapa',
    fields: [
      {
        key: 'empresa',
        label: 'Empresa',
        required: true,
        col: true,
        full: true,
      },
      { key: 'contacto', label: 'Contacto', col: true },
      { key: 'telefono', label: 'Teléfono', type: 'tel', col: true },
      {
        key: 'servicio',
        label: 'Servicio de interés',
        type: 'select',
        catalog: 'serviceTypes',
        col: true,
      },
      { key: 'valor', label: 'Valor estimado', type: 'money', col: true },
      {
        key: 'etapa',
        label: 'Etapa',
        type: 'select',
        options: [
          'Nuevo',
          'Contactado',
          'Cotizado',
          'Negociación',
          'Ganado',
          'Perdido',
        ],
        col: true,
        badge: true,
      },
    ],
  },
  equipment: {
    path: 'equipos',
    collection: 'equipment',
    singular: 'equipo',
    title: 'Equipos',
    subtitle: 'Inventario y dotación asignada',
    icon: 'Radio',
    imgKey: 'foto',
    filterKey: 'estado',
    fields: [
      { key: 'foto', label: 'Foto del equipo', type: 'image', full: true },
      { key: 'nombre', label: 'Equipo', required: true, col: true, full: true },
      {
        key: 'categoria',
        label: 'Categoría',
        type: 'select',
        catalog: 'categories',
        required: true,
        col: true,
      },
      { key: 'tipo', label: 'Tipo de equipo', col: true },
      { key: 'serie', label: 'Serie / Placa', col: true },
      {
        key: 'asignado',
        label: 'Asignado a',
        type: 'select',
        ref: 'agents',
        col: true,
      },
      {
        key: 'estado',
        label: 'Estado',
        type: 'select',
        options: ['Disponible', 'Asignado', 'Mantenimiento', 'Baja'],
        col: true,
        badge: true,
      },
    ],
  },
}

// Menú lateral agrupado por secciones
const nav = (key, section) => ({
  to: `/${RESOURCES[key].path}`,
  label: RESOURCES[key].title,
  icon: RESOURCES[key].icon,
  section,
})
export const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    section: 'Operaciones',
  },
  {
    to: '/calendario',
    label: 'Calendario',
    icon: 'CalendarDays',
    section: 'Operaciones',
  },
  nav('shifts', 'Operaciones'),
  nav('agents', 'Operaciones'),
  nav('incidents', 'Operaciones'),
  nav('equipment', 'Operaciones'),
  nav('clients', 'Operaciones'),
  nav('contracts', 'Comercial'),
  nav('leads', 'Comercial'),
  {
    to: '/informes',
    label: 'Informes',
    icon: 'FileText',
    section: 'Operaciones',
  },
  {
    to: '/portal-agente',
    label: 'Mis incidentes',
    icon: 'ShieldAlert',
    section: 'Operaciones',
  },
  {
    to: '/usuarios',
    label: 'Usuarios y permisos',
    icon: 'Users',
    section: 'Sistema',
  },
  { to: '/ajustes', label: 'Ajustes', icon: 'Settings', section: 'Sistema' },
]
export const NAV_SECTIONS = ['Operaciones', 'Comercial', 'Sistema']

const TONES = {
  green: [
    'Activo',
    'Vigente',
    'Completado',
    'Resuelto',
    'Disponible',
    'Ganado',
  ],
  amber: [
    'Prospecto',
    'Por vencer',
    'Programado',
    'En curso',
    'Media',
    'Descanso',
    'Cotizado',
    'Contactado',
    'Negociación',
    'Asignado',
  ],
  red: [
    'Vencido',
    'Ausente',
    'Abierto',
    'Alta',
    'Crítica',
    'Perdido',
    'Mantenimiento',
    'Licencia',
  ],
}
export const toneOf = (v) =>
  Object.keys(TONES).find((t) => TONES[t].includes(v)) || 'gray'

export const money = (n) => '$' + Number(n || 0).toLocaleString('en-US')
export const fdate = (s) =>
  s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : '—'
export const ftime = (s) => {
  if (!s) return '—'
  const [h, m] = s.split(':')
  return `${String(Number(h) % 12 || 12).padStart(2, '0')}:${m} ${Number(h) < 12 ? 'AM' : 'PM'}`
}

// ---- Utilidades de navegación / títulos ----
export const byCollection = Object.fromEntries(
  Object.entries(RESOURCES).map(([k, r]) => [r.collection, k]),
)
export const detailPath = (collection, id) =>
  `/${RESOURCES[byCollection[collection]].path}/${id}`

export function titleOf(resKey, row, data) {
  const find = (col, id) => data[col]?.find((r) => r.id === id)
  switch (resKey) {
    case 'clients':
    case 'agents':
      return row.nombre
    case 'contracts':
      return `${find('clients', row.cliente)?.nombre || 'Contrato'} · ${row.servicio}`
    case 'incidents':
      return row.titulo
    case 'shifts':
      return `${find('agents', row.agente)?.nombre || 'Turno'} · ${fdate(row.fecha)}`
    case 'leads':
      return row.empresa
    case 'equipment':
      return row.nombre
    default:
      return row.id
  }
}
