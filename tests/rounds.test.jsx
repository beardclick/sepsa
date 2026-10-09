import React from 'react'
import { it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RoundsPage from '../src/pages/RoundsPage'
let role = 'admin'
vi.mock('../src/store', () => ({
  useStore: () => ({ user: { id: 'viewer', role }, can: () => true }),
}))
const round = {
  id: 'r1',
  titulo: 'Ronda accesos',
  lugar: 'David',
  fecha: '2026-10-10',
  inicio: '22:00',
  fin: '01:00',
  asignados: ['s1'],
  comentarios: 'Verificar puertas',
}
afterEach(() => vi.unstubAllGlobals())
const server = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path) => ({
      ok: true,
      json: async () =>
        path.endsWith('assignees')
          ? {
              users: [
                { id: 's1', nombre: 'Supervisor Uno', role: 'supervisor' },
              ],
            }
          : { rounds: [round] },
    })),
  )
it('el administrador abre la creación con botón y puede editar responsables', async () => {
  role = 'admin'
  server()
  render(<RoundsPage />)
  await screen.findByText('Ronda accesos')
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Nueva ronda' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: /Supervisor Uno/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Eliminar ronda' })).toBeNull()
})
it('el supervisor consulta horarios y comentarios sin acciones de administración', async () => {
  role = 'supervisor'
  server()
  render(<RoundsPage />)
  await screen.findByText('Ronda accesos')
  expect(screen.getByText('10/10/26')).toBeTruthy()
  expect(screen.getByText(/10:00 PM/)).toBeTruthy()
  expect(screen.getByText('Termina al día siguiente')).toBeTruthy()
  expect(screen.getByText('Verificar puertas')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nueva ronda' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
})

it('permite retirar responsables eliminados de una ronda existente', async () => {
  role = 'admin'
  vi.stubGlobal('fetch', vi.fn(async path => ({ ok: true, json: async () => path.endsWith('assignees') ? { users: [] } : { rounds: [round] } })))
  render(<RoundsPage />)
  await screen.findByText('Ronda accesos')
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  const missing = screen.getByRole('checkbox', { name: /Usuario no disponible/ })
  expect(missing.checked).toBe(true)
  fireEvent.click(missing)
  expect(screen.getByRole('button', { name: 'Guardar ronda' }).disabled).toBe(true)
})
