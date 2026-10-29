import React from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TelegramSettings from '../src/components/TelegramSettings'
import {
  formatIncident,
  formatShifts,
  formatReport,
} from '../worker/telegram'

afterEach(() => vi.unstubAllGlobals())

describe('Formato de mensajes de Telegram', () => {
  it('resume un incidente con sus datos principales', () => {
    const text = formatIncident({
      titulo: 'Intruso en bodega',
      severidad: 'Alta',
      clienteNombre: 'Planta Norte',
      agenteNombre: 'Ana Pérez',
      fecha: '2026-10-28',
      descripcion: 'Se detectó movimiento sospechoso.',
    })
    expect(text).toContain('Nuevo incidente')
    expect(text).toContain('Intruso en bodega')
    expect(text).toContain('Alta')
    expect(text).toContain('Planta Norte')
    expect(text).toContain('Ana Pérez')
  })

  it('resume uno o varios turnos', () => {
    const single = formatShifts([
      { agenteNombre: 'Luis', clienteNombre: 'Torre 2', fecha: '2026-10-28', inicio: '08:00', fin: '16:00' },
    ])
    expect(single).toContain('Nuevo turno')
    expect(single).toContain('Luis')
    const many = formatShifts(
      Array.from({ length: 20 }, (_, i) => ({
        agenteNombre: `A${i}`,
        clienteNombre: 'Sitio',
        fecha: '2026-10-28',
        inicio: '08:00',
        fin: '16:00',
      })),
    )
    expect(many).toContain('20 turnos programados')
    expect(many).toContain('5 turnos más')
  })

  it('resume un informe con sus secciones y comentarios', () => {
    const text = formatReport(
      {
        fecha: '2026-10-28',
        comentarios: 'Jornada tranquila',
        sections: [
          { title: 'Incidentes del día', rows: [{}, {}, {}] },
          { title: 'Turnos del día', rows: [{}] },
        ],
      },
      'Admin',
    )
    expect(text).toContain('Informe diario 2026-10-28')
    expect(text).toContain('Incidentes del día: 3')
    expect(text).toContain('Jornada tranquila')
  })
})

describe('Configuración de Telegram', () => {
  const config = {
    configured: false,
    chatId: '',
    enabled: false,
    notifyIncidents: true,
    notifyShifts: true,
    notifyReports: true,
  }

  it('carga la configuración y la guarda', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/api/telegram/config') && !options.method)
        return { ok: true, json: async () => config }
      if (url.endsWith('/api/telegram/config') && options.method === 'PUT')
        return { ok: true, json: async () => ({ ok: true, webhook: null }) }
      return { ok: false, json: async () => ({ error: 'Ruta no encontrada.' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<TelegramSettings />)
    await waitFor(() =>
      expect(screen.getByText('Notificaciones y bot de Telegram')).toBeTruthy(),
    )
    expect(screen.getByText(/Falta configurar el token/)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Ej. -1001234567890'), {
      target: { value: '-1001234567890' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuración/ }))
    await waitFor(() =>
      expect(screen.getByText('Configuración guardada.')).toBeTruthy(),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/telegram/config'),
      expect.objectContaining({ method: 'PUT' }),
    )
  })
})
