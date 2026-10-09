import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { buildSeed } from '../src/seed'
import { RESOURCES, NAV, fdate, ftime } from '../src/config'
import { normalizeData, StoreProvider, useStore } from '../src/store'
import { makeReport, renderReportPdf, reportDate } from '../src/reports'
import { credentials, passwordHash } from '../src/access'
import ResourcePage from '../src/pages/ResourcePage'
import DetailPage from '../src/pages/DetailPage'
import ReportsPage from '../src/pages/ReportsPage'
import AgentPortal from '../src/pages/AgentPortal'
import CalendarPage from '../src/pages/CalendarPage'
import SettingsPage from '../src/pages/SettingsPage'
import CatalogPage from '../src/pages/CatalogPage'
import AccessPage from '../src/pages/AccessPage'
import RecordForm from '../src/components/RecordForm'
import AgentAccess from '../src/components/AgentAccess'
import Layout from '../src/components/Layout'
import App from '../src/App'
import IncidentNotifications from '../src/components/IncidentNotifications'
import ShiftPlanner from '../src/components/ShiftPlanner'
import Dashboard from '../src/pages/Dashboard'
import { weeklyShifts, analyzeShiftPlan, weekStart } from '../src/schedule'
import { dayKey } from '../src/duty'
let api
function Capture() {
  api = useStore()
  return null
}
function mount(children, role = 'admin', path = '/') {
  const data = normalizeData(buildSeed())
  data.users = [
    {
      id: 'test',
      nombre: 'Prueba',
      username: 'prueba',
      role,
      activo: true,
      agent: 'a1',
    },
  ]
  localStorage.setItem('sepsa-crm-data-v3', JSON.stringify(data))
  sessionStorage.setItem('sepsa-session', 'test')
  return render(
    <StoreProvider>
      <Capture />
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </StoreProvider>,
  )
}
describe('Datos y formatos', () => {
  it('migra sin facturación y conserva registros y categorías', () => {
    const legacy = { ...buildSeed(), invoices: [{ id: 'old' }] }
    legacy.clients[0].nombre = 'Cliente conservado'
    const data = normalizeData(legacy)
    expect(data.invoices).toBeUndefined()
    expect(data.clients[0].nombre).toBe('Cliente conservado')
    expect(data.equipment[0].categoria).toBe('cat0')
    expect(data.categories.map((c) => c.nombre)).toContain('Armas')
    expect(RESOURCES.invoices).toBeUndefined()
    expect(NAV.some((n) => /factura|mapa/i.test(n.to + n.label))).toBe(false)
    expect(
      Object.values(RESOURCES)
        .flatMap((r) => r.related || [])
        .some((r) => r.res === 'invoices'),
    ).toBe(false)
  })
  it('presenta fecha corta y horas AM/PM incluyendo medianoche y mediodía', () => {
    expect(fdate('2026-10-08')).toBe('08/10/26')
    expect(ftime('00:05')).toBe('12:05 AM')
    expect(ftime('12:00')).toBe('12:00 PM')
    expect(ftime('18:30')).toBe('06:30 PM')
  })
  it('protege contraseñas con sal y verifica credenciales', async () => {
    const saved = await credentials('clave-de-prueba')
    expect(saved.passwordHash).not.toContain('clave-de-prueba')
    expect(await passwordHash('clave-de-prueba', saved.salt)).toBe(
      saved.passwordHash,
    )
    expect(await passwordHash('incorrecta', saved.salt)).not.toBe(
      saved.passwordHash,
    )
  })
})
describe('Permisos y operación', () => {
  it('ordena incidentes por creación y conserva el orden al editar', () => {
    mount(<ResourcePage resKey="incidents" />)
    const old = {
      ...api.data.incidents[0],
      id: 'old-order',
      titulo: 'Antiguo Z',
      fecha: '2026-12-01',
      createdAt: '2026-10-01T00:00:00Z',
    }
    const recent = {
      ...old,
      id: 'new-order',
      titulo: 'Reciente A',
      fecha: '2026-01-01',
      createdAt: '2026-10-08T00:00:00Z',
    }
    act(() => api.replaceAll({ ...api.data, incidents: [old, recent] }))
    const first = () => within(screen.getByRole('table')).getAllByRole('row')[1]
    expect(first().textContent).toContain('Reciente A')
    act(() =>
      api.update('incidents', old.id, {
        titulo: 'Editado Z',
        createdAt: '2026-12-30T00:00:00Z',
      }),
    )
    expect(first().textContent).toContain('Reciente A')
    expect(api.data.incidents.find((r) => r.id === old.id).createdAt).toBe(
      old.createdAt,
    )
    fireEvent.click(screen.getByRole('button', { name: /Título/ }))
    expect(first().textContent).toContain('Editado Z')
  })
  it('bloquea mutaciones no permitidas al supervisor y oculta acciones de equipos', () => {
    mount(<ResourcePage resKey="equipment" />, 'supervisor')
    const count = api.data.equipment.length
    act(() => {
      expect(api.add('equipment', { nombre: 'Prohibido' })).toBe(false)
      expect(api.remove('equipment', 'e1')).toBe(false)
    })
    expect(api.data.equipment.length).toBe(count)
    expect(screen.queryByRole('button', { name: 'Agregar equipo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  })
  it('filtra los equipos por categoría', () => {
    mount(<ResourcePage resKey="equipment" />)
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Filtrar por categoría' }),
      { target: { value: 'cat0' } },
    )
    expect(screen.queryByText('Camioneta patrulla 03')).toBeNull()
    expect(screen.getAllByText('Radio Motorola T800').length).toBeGreaterThan(0)
  })
  it('crea un equipo desde la ficha del agente y mantiene su asignación', () => {
    mount(
      <Routes>
        <Route path="/agentes/:id" element={<DetailPage resKey="agents" />} />
      </Routes>,
      'admin',
      '/agentes/a1',
    )
    expect(screen.queryByText('Dotación del agente')).toBeNull()
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Equipo asignado' })).getByRole(
        'button',
        { name: 'Agregar equipo' },
      ),
    )
    expect(screen.getByLabelText('Asignado a').disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Equipo *'), {
      target: { value: 'Chaleco nuevo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear equipo' }))
    expect(api.data.equipment[0]).toMatchObject({
      nombre: 'Chaleco nuevo',
      asignado: 'a1',
      estado: 'Asignado',
    })
  })
  it('permite al agente reportar solamente con su identidad y puesto', () => {
    mount(<AgentPortal />, 'agent')
    expect(api.can('incidents')).toBe(false)
    act(() => {
      expect(
        api.submitIncident({
          titulo: 'Novedad',
          agente: 'a2',
          cliente: 'c2',
          fecha: '2000-01-01',
          estado: 'Resuelto',
        }),
      ).toBe(true)
    })
    expect(api.data.incidents[0]).toMatchObject({
      titulo: 'Novedad',
      agente: 'a1',
      cliente: 'c1',
      fecha: '2000-01-01',
      estado: 'Abierto',
    })
    expect(screen.getByText('Novedad')).toBeTruthy()
  })
  it('renombra tipos de servicio sin romper contratos o prospectos y protege catálogos en uso', () => {
    mount(<CatalogPage collection="serviceTypes" />)
    act(() =>
      api.renameCatalog('serviceTypes', 'srv0', 'Vigilancia especializada'),
    )
    expect(api.data.contracts[0].servicio).toBe('Vigilancia especializada')
    expect(api.data.leads[0].servicio).toBe('Vigilancia especializada')
    act(() => {
      expect(api.remove('serviceTypes', 'srv0')).toBe(false)
      expect(api.remove('categories', 'cat0')).toBe(false)
      expect(api.remove('users', 'test')).toBe(false)
    })
  })
  it('renderiza calendario, ajustes, permisos y formularios sin errores', () => {
    mount(
      <>
        <CalendarPage />
        <SettingsPage />
        <AccessPage />
      </>,
    )
    expect(screen.getByText('Roles y permisos')).toBeTruthy()
    expect(screen.getByText('Exportar respaldo')).toBeTruthy()
  })
  it('ubica nuevos clientes en David con mapa sin campos de coordenadas', () => {
    const data = normalizeData(buildSeed())
    let values
    render(
      <RecordForm
        cfg={RESOURCES.clients}
        data={data}
        onClose={() => {}}
        onSave={(v) => {
          values = v
        }}
      />,
    )
    expect(screen.queryByLabelText(/Latitud del puesto/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Nombre / Razón social *'), {
      target: { value: 'Nuevo cliente' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cliente' }))
    expect(values).toMatchObject({
      lat: 8.4273,
      lng: -82.4308,
      ciudad: 'David, Chiriquí',
    })
  })
})

describe('Edición desde fichas relacionadas', () => {
  function detailRoutes(path = '/agentes/a1') {
    return mount(
      <Routes>
        {Object.entries(RESOURCES).map(([key, cfg]) => (
          <Route
            key={key}
            path={`/${cfg.path}/:id`}
            element={<DetailPage key={key} resKey={key} />}
          />
        ))}
      </Routes>,
      'admin',
      path,
    )
  }
  it('edita un equipo directamente en Equipo asignado y conserva la ficha del agente', async () => {
    detailRoutes()
    const assigned = screen.getByRole('region', { name: 'Equipo asignado' })
    fireEvent.click(
      within(assigned).getByRole('button', {
        name: 'Editar equipo Radio Motorola T800',
      }),
    )
    fireEvent.change(screen.getByLabelText('Equipo *'), {
      target: { value: 'Radio actualizado' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(api.data.equipment.find((e) => e.id === 'e1').nombre).toBe(
      'Radio actualizado',
    )
    expect(screen.getByRole('heading', { name: 'Jorge Ramírez' })).toBeTruthy()
    expect(within(assigned).getByText('Radio actualizado')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
  it.each(['guardar', 'cancelar'])(
    'vuelve al agente al %s la edición de la ficha de un equipo',
    async (action) => {
      detailRoutes()
      const assigned = screen.getByRole('region', { name: 'Equipo asignado' })
      fireEvent.click(within(assigned).getAllByRole('link')[0])
      expect(
        screen.getByRole('link', { name: 'Volver a Jorge Ramírez' }),
      ).toBeTruthy()
      fireEvent.click(
        screen.getAllByRole('button', { name: 'Editar', exact: true })[0],
      )
      if (action === 'guardar') {
        fireEvent.change(screen.getByLabelText('Equipo *'), {
          target: { value: 'Radio cambiado' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      } else fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: 'Jorge Ramírez' }),
        ).toBeTruthy(),
      )
      expect(
        screen.getByRole('region', { name: 'Equipo asignado' }),
      ).toBeTruthy()
      expect(screen.queryByRole('dialog')).toBeNull()
    },
  )
  it('vuelve al cliente después de editar un contrato relacionado', async () => {
    detailRoutes('/clientes/c1')
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Contratos' })).getAllByRole(
        'link',
      )[0],
    )
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Editar', exact: true })[0],
    )
    fireEvent.change(screen.getByLabelText('Agentes requeridos'), {
      target: { value: '8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(api.data.contracts[0].agentes).toBe(8)
    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: 'Banco del Istmo – Sucursal David',
        }),
      ).toBeTruthy(),
    )
  })
  it('regresa a la ficha de origen después de eliminar el registro relacionado', async () => {
    detailRoutes()
    fireEvent.click(
      within(
        screen.getByRole('region', { name: 'Equipo asignado' }),
      ).getAllByRole('link')[0],
    )
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Editar', exact: true })[0],
    )
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Eliminar', exact: true })[0],
    )
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Eliminar',
      }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Jorge Ramírez' }),
      ).toBeTruthy(),
    )
    expect(api.data.equipment.some((e) => e.id === 'e1')).toBe(false)
  })
  it('mantiene el regreso al listado para una ficha abierta directamente', () => {
    detailRoutes('/equipos/e1')
    expect(
      screen
        .getByRole('link', { name: 'Volver a Equipos' })
        .getAttribute('href'),
    ).toBe('/equipos')
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Editar', exact: true })[0],
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(
      screen.getByRole('heading', { name: 'Radio Motorola T800' }),
    ).toBeTruthy()
  })
})
describe('Informes', () => {
  it('genera una sola captura diaria y permite actualizarla conservando el id', async () => {
    mount(<ReportsPage />)
    await waitFor(() => expect(api.data.reports.length).toBe(1))
    const id = api.data.reports[0].id
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Generar informe' }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Comentario de cierre' },
    })
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Generar informe',
      }),
    )
    expect(
      screen.getByText(`Ya existe un informe del ${fdate(reportDate())}.`),
    ).toBeTruthy()
    expect(api.data.reports[0].comentarios).not.toBe('Comentario de cierre')
    fireEvent.click(
      screen.getByRole('button', { name: 'Actualizar informe existente' }),
    )
    expect(api.data.reports).toHaveLength(1)
    expect(api.data.reports[0].id).toBe(id)
    expect(api.data.reports[0].comentarios).toBe('Comentario de cierre')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('cancelar la advertencia conserva el informe anterior', async () => {
    mount(<ReportsPage />)
    await waitFor(() => expect(api.data.reports).toHaveLength(1))
    const before = JSON.stringify(api.data.reports)
    fireEvent.click(screen.getByRole('button', { name: 'Generar informe' }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'No guardar' },
    })
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Generar informe',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(JSON.stringify(api.data.reports)).toBe(before)
  })
  it('incluye solo las secciones elegidas y los incidentes del día y genera un PDF paginado', async () => {
    const data = normalizeData(buildSeed())
    const date = reportDate()
    data.incidents = [
      { id: 'today', titulo: 'Incidente de hoy', fecha: date, agente: 'a1' },
      { id: 'old', titulo: 'No incluir', fecha: '2000-01-01' },
    ]
    const r = makeReport(data, date, ['incidents'], 'Comentarios del día')
    expect(r.sections).toHaveLength(1)
    expect(r.sections[0].rows).toHaveLength(1)
    const big = {
      ...r,
      sections: [
        {
          ...r.sections[0],
          rows: Array.from({ length: 140 }, () => r.sections[0].rows[0]),
        },
      ],
    }
    const pdf = await renderReportPdf(big)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
    const output = pdf.output()
    expect(output.startsWith('%PDF-')).toBe(true)
    expect(output).toContain('Comentarios del')
    expect(output).not.toContain('No incluir')
  })
})

describe('Rutas y navegación', () => {
  function openApp(path, role) {
    const data = normalizeData(buildSeed())
    data.users = [
      {
        id: 'route-user',
        nombre: 'Usuario',
        username: 'usuario',
        role,
        activo: true,
        agent: 'a1',
      },
    ]
    localStorage.setItem('sepsa-crm-data-v3', JSON.stringify(data))
    sessionStorage.setItem('sepsa-session', 'route-user')
    window.location.hash = path
    render(<App />)
  }
  it('redirige al agente que intenta entrar directamente en contratos', async () => {
    openApp('/contratos', 'agent')
    await waitFor(() =>
      expect(screen.getByText('Hola, Jorge Ramírez')).toBeTruthy(),
    )
    expect(screen.queryByRole('link', { name: 'Contratos' })).toBeNull()
    expect(
      screen.queryByRole('link', { name: 'Usuarios y permisos' }),
    ).toBeNull()
  })
  it('abre el submenú de categorías como catálogo y excluye facturación y mapa', async () => {
    openApp('/equipos/categorias', 'admin')
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Categorías de equipos' }),
      ).toBeTruthy(),
    )
    expect(screen.queryByText('Registro no encontrado')).toBeNull()
    expect(
      screen.queryByRole('link', { name: /Facturación|Mapa en vivo/ }),
    ).toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Submenú de Equipos' })
        .getAttribute('aria-expanded'),
    ).toBe('true')
  })
  it('abre solamente un submenú a la vez y permite cerrarlo', async () => {
    openApp('/equipos/categorias', 'admin')
    const equipment = await screen.findByRole('button', {
      name: 'Submenú de Equipos',
    })
    const contracts = screen.getByRole('button', {
      name: 'Submenú de Contratos',
    })
    fireEvent.click(contracts)
    expect(contracts.getAttribute('aria-expanded')).toBe('true')
    expect(equipment.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(equipment)
    expect(contracts.getAttribute('aria-expanded')).toBe('false')
    expect(equipment.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(equipment)
    expect(equipment.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('Avisos de incidentes', () => {
  it('avisa al recibir un incidente sin repetir los existentes o las ediciones', () => {
    mount(<IncidentNotifications />)
    expect(screen.queryByText('Nuevo incidente')).toBeNull()
    const id = 'remote-ui'
    act(() =>
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'sepsa-crm-data-v3',
          newValue: JSON.stringify({
            ...api.data,
            incidents: [
              {
                id,
                titulo: 'Alerta nueva',
                severidad: 'Alta',
                cliente: 'c1',
                createdBy: 'other-user',
              },
              ...api.data.incidents,
            ],
          }),
        }),
      ),
    )
    expect(screen.getByText('Nuevo incidente')).toBeTruthy()
    expect(screen.getByText('Alerta nueva')).toBeTruthy()
    act(() => api.update('incidents', id, { estado: 'Resuelto' }))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Notificaciones: 1 sin leer' }),
    )
    expect(screen.getByRole('link', { name: /Alerta nueva/ })).toBeTruthy()
  })
  it('recibe el aviso de un incidente agregado desde otra pestaña', () => {
    mount(<IncidentNotifications />)
    const remote = {
      ...api.data,
      incidents: [
        {
          id: 'remote',
          titulo: 'Aviso remoto',
          severidad: 'Media',
          cliente: 'c2',
        },
        ...api.data.incidents,
      ],
    }
    act(() => {
      const serialized = JSON.stringify(remote)
      localStorage.setItem('sepsa-crm-data-v3', serialized)
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'sepsa-crm-data-v3',
          newValue: serialized,
        }),
      )
    })
    expect(api.data.incidents[0].id).toBe('remote')
    expect(screen.getByText('Aviso remoto')).toBeTruthy()
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })
  it('no muestra al agente incidentes de otros agentes', () => {
    mount(<IncidentNotifications />, 'agent')
    const remote = {
      ...api.data,
      incidents: [
        { id: 'other', titulo: 'Incidente privado ajeno', agente: 'a2' },
        ...api.data.incidents,
      ],
    }
    act(() =>
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'sepsa-crm-data-v3',
          newValue: JSON.stringify(remote),
        }),
      ),
    )
    expect(screen.queryByText('Incidente privado ajeno')).toBeNull()
    expect(screen.queryByText('Nuevo incidente')).toBeNull()
    act(() =>
      api.submitIncident({ titulo: 'Mi nuevo incidente', severidad: 'Baja' }),
    )
    expect(api.data.incidents[0].titulo).toBe('Mi nuevo incidente')
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('Programación semanal y próximas 48 horas', () => {
  it('genera los días independientes de dos semanas y cruza correctamente el cambio de año', () => {
    const result = weeklyShifts('a5', 'c3', [
      {
        start: '2026-12-28',
        days: [0, 1, 2, 4],
        inicio: '06:00',
        fin: '18:00',
        tipo: 'Diurno',
      },
      {
        start: '2027-01-04',
        days: [1, 2, 3, 4, 5],
        inicio: '18:00',
        fin: '06:00',
        tipo: 'Nocturno',
      },
    ])
    expect(result).toHaveLength(9)
    expect(result.map((s) => s.fecha)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2027-01-01',
      '2027-01-05',
      '2027-01-06',
      '2027-01-07',
      '2027-01-08',
      '2027-01-09',
    ])
    expect(weekStart('2027-01-03')).toBe('2026-12-28')
  })
  it('detecta conflictos nocturnos sin bloquear turnos contiguos', () => {
    const existing = [
      {
        agente: 'a1',
        fecha: '2026-10-08',
        inicio: '18:00',
        fin: '06:00',
        estado: 'Programado',
      },
    ]
    const { accepted, conflicts } = analyzeShiftPlan(
      [
        { agente: 'a1', fecha: '2026-10-09', inicio: '05:00', fin: '07:00' },
        { agente: 'a1', fecha: '2026-10-09', inicio: '06:00', fin: '18:00' },
      ],
      existing,
    )
    expect(conflicts).toHaveLength(1)
    expect(accepted).toHaveLength(1)
    expect(accepted[0].inicio).toBe('06:00')
  })
  it('crea el patrón semanal desde el formulario sin salir de la ficha del agente', () => {
    mount(
      <Routes>
        <Route path="/agentes/:id" element={<DetailPage resKey="agents" />} />
      </Routes>,
      'admin',
      '/agentes/a5',
    )
    const before = api.data.shifts.length
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Turnos' })).getByRole(
        'button',
        { name: 'Programar semanas' },
      ),
    )
    const current = screen.getByRole('group', { name: 'Esta semana' })
    for (const day of ['Lunes', 'Martes', 'Miércoles', 'Viernes'])
      fireEvent.click(within(current).getByRole('button', { name: day }))
    const next = screen.getByRole('group', { name: 'Próxima semana' })
    fireEvent.click(within(next).getByRole('button', { name: 'Mar–Sáb' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear 9 turnos' }))
    expect(api.data.shifts).toHaveLength(before + 9)
    expect(
      api.data.shifts
        .slice(0, 9)
        .every((s) => s.agente === 'a5' && s.cliente === 'c3'),
    ).toBe(true)
    expect(screen.getByRole('heading', { name: 'Miguel Batista' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('9 turnos creados.')).toBeTruthy()
  })
  it('evita duplicados de forma atómica y permite omitir conflictos explícitamente', () => {
    mount(<div />)
    const candidates = weeklyShifts('a5', 'c3', [
      {
        start: '2099-01-05',
        days: [0, 1],
        inicio: '06:00',
        fin: '18:00',
        tipo: 'Diurno',
      },
    ])
    act(() => api.addShiftPlan(candidates))
    const before = api.data.shifts.length
    act(() => expect(api.addShiftPlan(candidates).error).toBeTruthy())
    expect(api.data.shifts).toHaveLength(before)
    const extra = { ...candidates[0], fecha: '2099-01-08' }
    act(() =>
      expect(api.addShiftPlan([...candidates, extra], true)).toMatchObject({
        created: 1,
        skipped: 2,
      }),
    )
    expect(api.data.shifts).toHaveLength(before + 1)
  })
  it('impide crear programaciones a un usuario sin permiso', () => {
    mount(<div />, 'supervisor')
    act(() =>
      expect(api.addShiftPlan([]).error).toBe(
        'No tienes permiso para crear turnos.',
      ),
    )
  })
  it('muestra solamente turnos que comienzan dentro de las próximas 48 horas', () => {
    vi.useFakeTimers()
    try {
      const now = new Date(2026, 9, 8, 12, 0)
      vi.setSystemTime(now)
      mount(<Dashboard />)
      const shifts = [1, 48, 49].map((hours, index) => {
        const start = new Date(now.getTime() + hours * 3600000)
        const end = new Date(start.getTime() + 3600000)
        const time = (d) =>
          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        return {
          id: `window${index}`,
          agente: `a${index + 1}`,
          cliente: 'c1',
          fecha: dayKey(start),
          inicio: time(start),
          fin: time(end),
          tipo: 'Diurno',
          estado: 'Programado',
        }
      })
      act(() => api.replaceAll({ ...api.data, shifts }))
      const list = screen.getByRole('list', { name: 'Agentes por entrar' })
      expect(within(list).getByText('Jorge Ramírez')).toBeTruthy()
      expect(within(list).getByText('Luis Herrera')).toBeTruthy()
      expect(within(list).queryByText('Pedro Samudio')).toBeNull()
      expect(screen.getByText('Por entrar (48 h)')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Alta automática de acceso de agente', () => {
  it('crea el usuario vinculado sin guardar su contraseña ni coordenadas en la ficha', async () => {
    mount(<ResourcePage resKey="agents" />)
    fireEvent.click(
      screen.getAllByRole('button', { name: /Agregar agente/ })[0],
    )
    expect(screen.queryByLabelText(/Latitud|Longitud/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Nombre completo *'), {
      target: { value: 'Agente nuevo' },
    })
    fireEvent.change(screen.getByLabelText('Documento *'), {
      target: { value: 'doc-nuevo' },
    })
    fireEvent.change(screen.getByLabelText('Correo de acceso *'), {
      target: { value: 'nuevo@example.com' },
    })
    fireEvent.change(
      screen.getByLabelText('Contraseña inicial (mínimo 12 caracteres) *'),
      { target: { value: 'Clave-inicial-segura-2026' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Crear agente' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const agent = api.data.agents.find((a) => a.nombre === 'Agente nuevo')
    const user = api.data.users.find((u) => u.agent === agent.id)
    expect(user).toMatchObject({
      role: 'agent',
      username: 'nuevo@example.com',
      activo: true,
    })
    expect(user.passwordHash).toBeTruthy()
    expect(agent.password).toBeUndefined()
    expect(
      api.data.agents.every((a) => a.lat === undefined && a.lng === undefined),
    ).toBe(true)
  })
})

describe('Acceso de agentes existentes e identidad de la sesión', () => {
  it('edita el correo y restablece la contraseña manteniendo la misma cuenta vinculada', async () => {
    mount(<AgentAccess agent={buildSeed().agents[0]} />)
    const previous = await credentials('Anterior-clave-2026')
    act(() =>
      api.add('users', {
        nombre: 'Agente existente',
        username: 'anterior@example.com',
        role: 'agent',
        agent: 'a1',
        activo: true,
        ...previous,
      }),
    )
    const accessId = api.data.users.find((u) => u.agent === 'a1').id
    fireEvent.click(screen.getByRole('button', { name: 'Editar acceso' }))
    expect(screen.getByLabelText('Correo de acceso').value).toBe(
      'anterior@example.com',
    )
    fireEvent.change(screen.getByLabelText('Correo de acceso'), {
      target: { value: 'nuevo-correo@example.com' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Restablecer contraseña' }),
    )
    fireEvent.change(screen.getByLabelText(/Nueva contraseña/), {
      target: { value: 'Nueva-clave-segura-2026' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar acceso' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const saved = api.data.users.find((u) => u.id === accessId)
    expect(saved).toMatchObject({
      username: 'nuevo-correo@example.com',
      role: 'agent',
      agent: 'a1',
    })
    expect(saved.passwordHash).not.toBe(previous.passwordHash)
    expect(saved.passwordHash).toBe(
      await passwordHash('Nueva-clave-segura-2026', saved.salt),
    )
    expect(saved.password).toBeUndefined()
  })
  it('muestra el correo conectado tanto en escritorio como en el menú móvil', () => {
    mount(<Layout />)
    act(() =>
      api.update('users', 'test', { username: 'conectado@example.com' }),
    )
    expect(screen.getByLabelText('Cuenta conectada').textContent).toContain(
      'conectado@example.com',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(screen.getAllByLabelText('Cuenta conectada')).toHaveLength(2)
    expect(screen.getAllByText('conectado@example.com')).toHaveLength(2)
  })
})

describe('Panel operativo del agente y acciones de edición', () => {
  it('cuenta los segundos restantes de un turno nocturno y detecta su final', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T23:59:58-05:00'))
    let rendered
    try {
      rendered = mount(<AgentPortal />, 'agent')
      act(() =>
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'sepsa-crm-data-v3',
            newValue: JSON.stringify({
              ...api.data,
              shifts: [
                {
                  id: 'night',
                  agente: 'a1',
                  cliente: 'c1',
                  fecha: '2026-10-08',
                  inicio: '18:00',
                  fin: '00:00',
                  estado: 'Programado',
                },
              ],
            }),
          }),
        ),
      )
      expect(screen.getByRole('timer').textContent).toBe('00:00:02')
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByRole('timer').textContent).toBe('00:00:01')
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.queryByRole('timer')).toBeNull()
      expect(screen.getByText('Fuera de turno')).toBeTruthy()
    } finally {
      rendered?.unmount()
      vi.useRealTimers()
    }
  })
  it('ofrece fecha y severidad al reportar y muestra los estados actualizados', () => {
    mount(<AgentPortal />, 'agent')
    fireEvent.click(screen.getByRole('button', { name: 'Reportar incidente' }))
    expect(screen.getByLabelText('Fecha')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Severidad'), {
      target: { value: 'Crítica' },
    })
    expect(screen.getByLabelText('Severidad').value).toBe('Crítica')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    act(() =>
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'sepsa-crm-data-v3',
          newValue: JSON.stringify({
            ...api.data,
            incidents: [
              {
                id: 'resolved',
                titulo: 'Seguimiento actualizado',
                agente: 'a1',
                fecha: '2026-10-01',
                estado: 'Resuelto',
                severidad: 'Alta',
              },
            ],
          }),
        }),
      ),
    )
    expect(screen.getByText('Seguimiento actualizado')).toBeTruthy()
    expect(screen.getByText('Resuelto')).toBeTruthy()
  })
  it('permite eliminar un registro únicamente después de abrir su edición', () => {
    mount(<ResourcePage resKey="equipment" />)
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Eliminar',
      }),
    ).toBeTruthy()
  })
  it('oculta cuentas y rol de agentes de la administración sin borrar sus accesos', () => {
    mount(<AccessPage />)
    act(() => {
      api.add('users', {
        nombre: 'Agente oculto',
        username: 'agente@example.com',
        role: 'agent',
        agent: 'a1',
        activo: true,
      })
      api.add('users', {
        nombre: 'Supervisor visible',
        username: 'supervisor@example.com',
        role: 'supervisor',
        activo: true,
      })
    })
    expect(screen.queryByText('Agente oculto')).toBeNull()
    expect(screen.queryByText('Agentes', { exact: true })).toBeNull()
    expect(screen.getByText('Supervisor visible')).toBeTruthy()
    expect(api.data.users.some((u) => u.role === 'agent')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull()
  })
})
