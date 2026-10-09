import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import IncidentNotifications from '../src/components/IncidentNotifications'

let model
vi.mock('../src/store', () => ({ useStore: () => model }))
const incident = (id, createdBy, extra = {}) => ({
  id,
  titulo: `Incidente ${id}`,
  severidad: 'Alta',
  createdBy,
  ...extra,
})
const component = () => (
  <MemoryRouter>
    <IncidentNotifications />
  </MemoryRouter>
)
const receiver = () => {
  model = {
    data: { incidents: [], clients: [] },
    user: { id: 'supervisor', role: 'supervisor' },
    can: (module) => module === 'incidents',
    incidentsReady: true,
  }
}

describe('Avisos entre usuarios', () => {
  it('muestra el toast al receptor y evita avisos por editar el mismo incidente', () => {
    receiver()
    const view = render(component())
    model.data = { ...model.data, incidents: [incident('nuevo', 'agente')] }
    view.rerender(component())
    expect(screen.getByRole('status').textContent).toContain('Incidente nuevo')
    model.data = {
      ...model.data,
      incidents: [incident('nuevo', 'agente', { estado: 'Resuelto' })],
    }
    view.rerender(component())
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })
  it('no muestra al creador el toast ni lo marca como aviso sin leer', () => {
    receiver()
    const view = render(component())
    model.data = {
      ...model.data,
      incidents: [incident('propio', 'supervisor')],
    }
    view.rerender(component())
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeTruthy()
  })
  it('no convierte el historial inicial ni las importaciones en incidentes nuevos', () => {
    receiver()
    model.incidentsReady = false
    const view = render(component())
    model.data = { ...model.data, incidents: [incident('anterior', 'agente')] }
    model.incidentsReady = true
    view.rerender(component())
    model.data = {
      ...model.data,
      incidents: [
        incident('importado', 'agente', { imported: true }),
        ...model.data.incidents,
      ],
    }
    view.rerender(component())
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('el portal del agente no recibe el toast del sistema', () => {
    receiver()
    model.user.role = 'agent'
    model.can = (module) => module === 'portal'
    const view = render(component())
    model.data = { ...model.data, incidents: [incident('portal', 'otro')] }
    view.rerender(component())
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Notificaciones' })).toBeNull()
  })
})
