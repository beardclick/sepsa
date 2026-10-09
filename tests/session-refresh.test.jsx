import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../src/App'

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => structuredClone(body),
})
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function server() {
  const model = {
    user: {
      id: 'real-session',
      nombre: 'Usuario conectado',
      username: 'sesion@example.com',
      role: 'supervisor',
      activo: true,
      agent: '',
    },
    role: {
      id: 'supervisor',
      nombre: 'Supervisores',
      permissions: {
        dashboard: ['view'],
        equipment: ['view', 'update'],
        incidents: ['view'],
        shifts: ['view'],
      },
    },
    incidents: [],
    shifts: [],
    me: null,
  }
  model.fetch = vi.fn(async (url) => {
    switch (String(url)) {
      case '/api/auth/state':
        return response({ initialized: true })
      case '/api/auth/me':
        return model.me
          ? model.me()
          : response({ user: model.user, role: model.role })
      case '/api/auth/logout':
        return response({ ok: true })
      case '/api/incidents':
        return response({ incidents: model.incidents })
      case '/api/shifts':
        return response({ shifts: model.shifts })
      case '/api/incident-directory':
        return response({ profiles: [] })
      default:
        throw new Error(`Unexpected endpoint: ${url}`)
    }
  })
  vi.stubGlobal('fetch', model.fetch)
  vi.stubGlobal(
    'WebSocket',
    class {
      close() {}
    },
  )
  return model
}
function open(path = '/equipos') {
  window.location.hash = path
  return render(<App />)
}
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Validación y actualización de la sesión', () => {
  it('mantiene la carga hasta validar la cookie sin mostrar el formulario de login', async () => {
    const api = server(),
      pending = deferred()
    api.me = () => pending.promise
    open()
    await waitFor(() =>
      expect(api.fetch).toHaveBeenCalledWith('/api/auth/me', expect.anything()),
    )
    expect(screen.getByText('Cargando tu sesión…')).toBeTruthy()
    expect(screen.queryByText('Acceso a SEPSA CRM')).toBeNull()
    await act(async () =>
      pending.resolve(response({ user: api.user, role: api.role })),
    )
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Equipos' })).toBeTruthy(),
    )
    expect(screen.queryByText('Acceso a SEPSA CRM')).toBeNull()
  })
  it('actualiza los incidentes al navegar y retira el acceso revocado a la sección abierta', async () => {
    const api = server()
    api.incidents = [
      {
        id: 'old',
        titulo: 'Incidente eliminado',
        severidad: 'Baja',
        estado: 'Abierto',
      },
    ]
    open('/incidentes')
    await waitFor(() =>
      expect(screen.getAllByText('Incidente eliminado').length).toBeGreaterThan(
        0,
      ),
    )
    fireEvent.click(screen.getByRole('link', { name: 'Equipos' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Equipos' })).toBeTruthy(),
    )
    api.incidents = []
    fireEvent.click(screen.getByRole('link', { name: 'Incidentes' }))
    await waitFor(() =>
      expect(screen.queryByText('Incidente eliminado')).toBeNull(),
    )
    delete api.role.permissions.equipment
    fireEvent.click(screen.getByRole('link', { name: 'Equipos' }))
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Equipos' })).toBeNull(),
    )
    expect(screen.queryByRole('heading', { name: 'Equipos' })).toBeNull()
    await waitFor(() => expect(window.location.hash).toBe('#/'))
  })
  it('vuelve al login al comprobar una cuenta desactivada o una sesión vencida', async () => {
    const api = server()
    open()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Equipos' })).toBeTruthy(),
    )
    api.me = () => response({ error: 'No has iniciado sesión.' }, 401)
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() =>
      expect(screen.getByText('Acceso a SEPSA CRM')).toBeTruthy(),
    )
    expect(screen.queryByLabelText('Cuenta conectada')).toBeNull()
  })
  it('conserva el panel ante un fallo temporal de red y se recupera al reintentar', async () => {
    const api = server()
    open()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Equipos' })).toBeTruthy(),
    )
    api.me = () => {
      throw new Error('Fallo temporal de conexión')
    }
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() =>
      expect(screen.getByText('Fallo temporal de conexión')).toBeTruthy(),
    )
    expect(screen.getByRole('heading', { name: 'Equipos' })).toBeTruthy()
    expect(screen.queryByText('Acceso a SEPSA CRM')).toBeNull()
    api.me = null
    api.user.username = 'correo-actualizado@example.com'
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() =>
      expect(screen.queryByText('Fallo temporal de conexión')).toBeNull(),
    )
    expect(screen.getByText('correo-actualizado@example.com')).toBeTruthy()
  })
  it('revalida permisos automáticamente aunque no se cambie de sección', async () => {
    vi.useFakeTimers()
    let rendered
    try {
      const api = server()
      await act(async () => {
        rendered = open()
      })
      expect(screen.getByRole('heading', { name: 'Equipos' })).toBeTruthy()
      delete api.role.permissions.equipment
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000)
      })
      expect(screen.queryByRole('link', { name: 'Equipos' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Equipos' })).toBeNull()
    } finally {
      rendered?.unmount()
      vi.useRealTimers()
    }
  })
  it('una respuesta pendiente no restaura la sesión después de salir', async () => {
    const api = server(),
      pending = deferred()
    open()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Equipos' })).toBeTruthy(),
    )
    api.me = () => pending.promise
    act(() => window.dispatchEvent(new Event('focus')))
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    await waitFor(() =>
      expect(screen.getByText('Acceso a SEPSA CRM')).toBeTruthy(),
    )
    await act(async () =>
      pending.resolve(response({ user: api.user, role: api.role })),
    )
    expect(screen.getByText('Acceso a SEPSA CRM')).toBeTruthy()
    expect(screen.queryByLabelText('Cuenta conectada')).toBeNull()
  })
})
