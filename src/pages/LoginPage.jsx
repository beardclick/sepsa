import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { credentials, passwordHash } from '../access'
import { Button, Card } from '../components/ui'
export default function LoginPage() {
  const { data, setup, login, bootstrap, authStatus } = useStore()
  const localInitial = data.users.find((u) => u.id === 'uadmin' && !u.passwordHash)
  const initial = authStatus.available ? !authStatus.initialized : !!localInitial
  const [username, setUsername] = useState(authStatus.adminEmail || ''),
    [name, setName] = useState(''),
    [setupKey, setSetupKey] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => { if (authStatus.adminEmail) setUsername(authStatus.adminEmail) }, [authStatus.adminEmail])
  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (initial) {
        if (authStatus.available) {
          if (password.length < 12) throw new Error('Usa una contraseña de al menos 12 caracteres.')
          await bootstrap({ name, email: username, password, setupKey })
        } else {
          if (password.length < 8) throw new Error('Usa al menos 8 caracteres.')
          setup(await credentials(password))
          await login(localInitial.username, password)
        }
      } else {
        if (authStatus.available) await login(username, password)
        else {
          const user = data.users.find((u) => u.activo && u.username.toLowerCase() === username.trim().toLowerCase())
          if (!user?.salt || (await passwordHash(password, user.salt)) !== user.passwordHash) throw new Error('Usuario o contraseña incorrectos.')
          await login(user.username, password)
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  if (authStatus.loading) return <div className="grid min-h-screen place-items-center bg-bg text-sm text-muted">Conectando con el servicio de acceso…</div>
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
          {initial && authStatus.available && <>
            <label className="block text-sm">Nombre completo<input className="input mt-1" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="block text-sm">Correo de administrador<input className="input mt-1" type="email" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} /></label>
            <label className="block text-sm">Clave de configuración<input className="input mt-1" type="password" autoComplete="off" required value={setupKey} onChange={(e) => setSetupKey(e.target.value)} /></label>
          </>}
          {!initial && (
            <label className="block text-sm">
              {authStatus.available ? 'Correo electrónico' : 'Usuario'}
              <input
                className="input mt-1"
                type={authStatus.available ? 'email' : 'text'}
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
              minLength={initial ? (authStatus.available ? 12 : 8) : undefined}
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
          {authStatus.available ? 'El acceso usa cuentas protegidas en el servidor.' : authStatus.error || 'Modo de desarrollo local.'}
        </p>
      </Card>
    </div>
  )
}
