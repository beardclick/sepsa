import { useEffect, useState } from 'react'
import { Button, Card } from './ui'

export async function telegramRequest(path, options) {
  const response = await fetch(`/api/telegram/${path}`, {
    credentials: 'same-origin',
    ...options,
  })
  const result = await response.json()
  if (!response.ok)
    throw new Error(
      result.error || 'No se pudo completar la operación de Telegram.',
    )
  return result
}

export default function TelegramSettings() {
  const [config, setConfig] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    telegramRequest('config')
      .then((result) => active && setConfig(result))
      .catch((error) => active && setMessage(error.message))
    return () => {
      active = false
    }
  }, [])

  const save = async () => {
    setBusy(true)
    setMessage('')
    setSaved(false)
    try {
      const result = await telegramRequest('config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chatId: config.chatId,
          enabled: config.enabled,
          notifyIncidents: config.notifyIncidents,
          notifyShifts: config.notifyShifts,
          notifyReports: config.notifyReports,
        }),
      })
      setSaved(true)
      setMessage(
        result.webhook
          ? 'Configuración guardada y webhook registrado.'
          : 'Configuración guardada.',
      )
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (!config) {
    return (
      <Card className="space-y-3 p-5">
        <h2 className="font-bold">Notificaciones y bot de Telegram</h2>
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : (
          <p className="text-sm text-muted">Cargando configuración…</p>
        )}
      </Card>
    )
  }

  const toggle = (key) =>
    setConfig((current) => ({ ...current, [key]: !current[key] }))

  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-bold">Notificaciones y bot de Telegram</h2>
      <p className="text-sm text-muted">
        Envía avisos al canal o grupo de Telegram y permite consultar turnos,
        rondas, incidentes y agentes desde el chat. Usa un <strong>grupo</strong>{' '}
        para poder hacer preguntas; escribe un comando o menciona al bot para
        consultas en lenguaje natural.
      </p>
      {!config.configured && (
        <p className="text-sm text-amber-600">
          Falta configurar el token del bot como secreto{' '}
          <code>TELEGRAM_BOT_TOKEN</code> en Cloudflare. Sin él no se enviarán
          mensajes ni se registrará el webhook.
        </p>
      )}
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">ID del chat (canal o grupo)</span>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            placeholder="Ej. -1001234567890"
            value={config.chatId}
            onChange={(e) =>
              setConfig((c) => ({ ...c, chatId: e.target.value }))
            }
          />
          <span className="mt-1 block text-xs text-muted">
            Añade el bot al grupo y copia el ID numérico (los grupos suelen
            empezar con «-100»).
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={() => toggle('enabled')}
          />
          Activar Telegram
        </label>
        <div className="flex flex-wrap gap-5 text-sm">
          {[
            ['notifyIncidents', 'Incidentes nuevos'],
            ['notifyShifts', 'Turnos nuevos'],
            ['notifyReports', 'Informes diarios'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!config[key]}
                onChange={() => toggle(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      {message && (
        <p
          role="status"
          className={`text-sm ${saved ? 'text-emerald-600' : ''}`}
        >
          {message}
        </p>
      )}
      <Button disabled={busy} onClick={save}>
        {busy ? 'Guardando…' : 'Guardar configuración de Telegram'}
      </Button>
    </Card>
  )
}
