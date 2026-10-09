import { useState } from 'react'
import { useStore } from '../store'
import { credentials } from '../access'
import { Button, Card, Modal } from './ui'

export default function AgentAccess({ agent }) {
  const { data, can, add, update, authStatus } = useStore()
  const access = data.users.find((u) => u.agent === agent.id)
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reset, setReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  if (!can('users') || !can('users', access ? 'update' : 'create')) return null

  const save = async (event) => {
    event.preventDefault()
    setError('')
    const username = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username))
      return setError('Indica un correo válido.')
    if ((reset || !access) && password.length < 12)
      return setError('La contraseña debe tener al menos 12 caracteres.')
    if (
      data.users.some(
        (u) => u.id !== access?.id && u.username.toLowerCase() === username,
      )
    )
      return setError('Este correo ya tiene un acceso.')
    setBusy(true)
    try {
      const values = access
        ? { username }
        : {
            nombre: agent.nombre,
            username,
            role: 'agent',
            activo: true,
            agent: agent.id,
          }
      if (reset || !access) {
        if (authStatus.available) values.password = password
        else Object.assign(values, await credentials(password))
      }
      const saved = access
        ? await update('users', access.id, values)
        : await add('users', values)
      if (!saved) throw new Error('No tienes permiso para guardar el acceso.')
      setMessage(
        reset
          ? 'Correo guardado y contraseña restablecida.'
          : 'Acceso guardado correctamente.',
      )
      setPassword('')
      setEditing(false)
    } catch (error) {
      setError(error.message || 'No se pudo guardar el acceso.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Acceso al panel</h3>
            <p className="mt-1 break-all text-sm text-muted">
              {access?.username ||
                'Este agente todavía no tiene una cuenta vinculada.'}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setEmail(access?.username || agent.email || '')
              setPassword('')
              setReset(!access)
              setError('')
              setMessage('')
              setEditing(true)
            }}
          >
            {access ? 'Editar acceso' : 'Crear acceso'}
          </Button>
        </div>
        {message && (
          <p role="status" className="mt-3 text-sm text-accent">
            {message}
          </p>
        )}
      </Card>
      {editing && (
        <Modal
          title="Acceso del agente"
          onClose={() => !busy && setEditing(false)}
          footer={
            <>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" form="agent-access-form" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar acceso'}
              </Button>
            </>
          }
        >
          <form
            id="agent-access-form"
            onSubmit={save}
            className="space-y-4"
            noValidate
          >
            <label className="block text-sm font-medium">
              Correo de acceso
              <input
                className="input mt-1"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </label>
            {access && !reset && (
              <Button type="button" variant="ghost" onClick={() => setReset(true)}>
                Restablecer contraseña
              </Button>
            )}
            {reset && (
              <label className="block text-sm font-medium">
                Nueva contraseña
                <input
                  className="input mt-1"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
                <span className="mt-1 block text-xs text-muted">
                  Mínimo 12 caracteres. Deberá iniciar sesión con esta nueva
                  contraseña.
                </span>
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}
    </>
  )
}
