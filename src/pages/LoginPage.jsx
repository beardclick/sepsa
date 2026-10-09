import { useState } from 'react'
import { useStore } from '../store'
import { credentials, passwordHash } from '../access'
import { Button, Card } from '../components/ui'
export default function LoginPage() {
  const { data, setup, login } = useStore()
  const initial = data.users.find((u) => u.id === 'uadmin' && !u.passwordHash)
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (initial) {
        if (password.length < 8) throw new Error('Usa al menos 8 caracteres.')
        setup(await credentials(password))
        login(initial.id)
      } else {
        const user = data.users.find(
          (u) =>
            u.activo &&
            u.username.toLowerCase() === username.trim().toLowerCase(),
        )
        if (
          !user?.salt ||
          (await passwordHash(password, user.salt)) !== user.passwordHash
        )
          throw new Error('Usuario o contraseña incorrectos.')
        login(user.id)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-4">
      <Card className="w-full max-w-md p-7">
        <img src="/shield.png" alt="SEPSA" className="mx-auto mb-4 h-16" />
        <h1 className="text-center text-2xl font-bold">
          {initial ? 'Configura el administrador' : 'Acceso a SEPSA CRM'}
        </h1>
        <p className="my-3 text-sm text-muted">
          {initial
            ? 'Crea la contraseña del usuario admin para comenzar.'
            : 'Ingresa con el usuario que te asignó el administrador.'}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {!initial && (
            <label className="block text-sm">
              Usuario
              <input
                className="input mt-1"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
          )}
          <label className="block text-sm">
            Contraseña
            <input
              className="input mt-1"
              type="password"
              autoComplete={initial ? 'new-password' : 'current-password'}
              required
              minLength={initial ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          <Button disabled={busy} className="w-full">
            {busy ? 'Procesando…' : initial ? 'Crear acceso' : 'Entrar'}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted">
          Los accesos y datos de esta versión se guardan en este navegador.
        </p>
      </Card>
    </div>
  )
}
