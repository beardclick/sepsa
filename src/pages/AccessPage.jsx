import { useState } from 'react'
import { useStore } from '../store'
import { MODULES, ACTIONS, credentials } from '../access'
import { Button, Card, Modal } from '../components/ui'
export default function AccessPage() {
  const { data, user, can, add, update, remove } = useStore()
  const [editing, setEditing] = useState(null),
    [role, setRole] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(null)
  const patch = (p) => setEditing((v) => ({ ...v, ...p }))
  const save = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (
        data.users.some(
          (u) =>
            u.id !== editing.id &&
            u.username.toLowerCase() === editing.username.trim().toLowerCase(),
        )
      )
        throw new Error('Ese usuario ya existe.')
      if (editing.role === 'agent' && !editing.agent)
        throw new Error('Selecciona el agente asociado.')
      if (
        editing.agent &&
        data.users.some((u) => u.id !== editing.id && u.agent === editing.agent)
      )
        throw new Error('Este agente ya tiene un acceso.')
      if (
        (!editing.id && !editing.password) ||
        (editing.password && editing.password.length < 8)
      )
        throw new Error('La contraseña debe tener al menos 8 caracteres.')
      const original = data.users.find((u) => u.id === editing.id)
      if (
        original?.role === 'admin' &&
        (editing.role !== 'admin' || !editing.activo) &&
        !data.users.some(
          (u) => u.id !== original.id && u.role === 'admin' && u.activo,
        )
      )
        throw new Error('Debe quedar al menos un administrador activo.')
      const { password, ...values } = editing
      values.nombre = values.nombre.trim()
      values.username = values.username.trim()
      if (password) Object.assign(values, await credentials(password))
      if (editing.id) update('users', editing.id, values)
      else add('users', values)
      setEditing(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Administra usuarios, contraseñas y permisos por módulo. Asocia los
        accesos de agentes con su ficha.
      </p>
      <Card className="p-5">
        <div className="mb-4 flex justify-between">
          <h2 className="text-lg font-bold">Usuarios</h2>
          {can('users', 'create') && (
            <Button
              onClick={() => {
                setEditing({
                  nombre: '',
                  username: '',
                  password: '',
                  role: 'supervisor',
                  activo: true,
                  agent: '',
                })
                setError('')
              }}
            >
              Añadir usuario
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {data.users.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
            >
              <div className="mr-auto">
                <p className="font-semibold">
                  {u.nombre} {u.id === user.id ? '(tú)' : ''}
                </p>
                <p className="text-xs text-muted">
                  {u.username} ·{' '}
                  {data.roles.find((r) => r.id === u.role)?.nombre} ·{' '}
                  {u.activo ? 'Activo' : 'Inactivo'}
                </p>
              </div>
              {can('users', 'update') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing({ ...u, password: '' })
                    setError('')
                  }}
                >
                  Editar
                </Button>
              )}
              {can('users', 'delete') && (
                <Button
                  variant="ghost"
                  disabled={
                    u.id === user.id ||
                    (u.role === 'admin' &&
                      data.users.filter((x) => x.role === 'admin' && x.activo)
                        .length <= 1)
                  }
                  onClick={() => setDeleting({ collection: 'users', row: u })}
                >
                  Eliminar
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <div className="mb-4 flex justify-between">
          <h2 className="text-lg font-bold">Roles y permisos</h2>
          {can('users', 'create') && (
            <Button
              onClick={() => {
                setRole({ nombre: '', permissions: {} })
                setError('')
              }}
            >
              Crear rol
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {data.roles.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
            >
              <span className="mr-auto font-semibold">{r.nombre}</span>
              {can('users', 'update') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRole(structuredClone(r))
                    setError('')
                  }}
                >
                  Permisos
                </Button>
              )}
              {can('users', 'delete') && (
                <Button
                  variant="ghost"
                  disabled={
                    r.id === 'admin' || data.users.some((u) => u.role === r.id)
                  }
                  onClick={() => setDeleting({ collection: 'roles', row: r })}
                >
                  Eliminar
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>
      {editing && (
        <Modal
          title={editing.id ? 'Editar usuario' : 'Añadir usuario'}
          onClose={() => setEditing(null)}
          footer={
            <Button disabled={busy} form="user-form">
              Guardar
            </Button>
          }
        >
          <form
            id="user-form"
            onSubmit={save}
            className="grid gap-4 sm:grid-cols-2"
          >
            {[
              ['nombre', 'Nombre'],
              ['username', 'Usuario'],
              [
                'password',
                editing.id ? 'Nueva contraseña (opcional)' : 'Contraseña',
              ],
            ].map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  className="input mt-1"
                  type={key === 'password' ? 'password' : 'text'}
                  required={key !== 'password' || !editing.id}
                  autoComplete={key === 'password' ? 'new-password' : 'off'}
                  value={editing[key]}
                  onChange={(e) => patch({ [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="text-sm">
              Rol
              <select
                className="input mt-1"
                value={editing.role}
                onChange={(e) => patch({ role: e.target.value })}
              >
                {data.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Agente asociado
              <select
                className="input mt-1"
                value={editing.agent || ''}
                onChange={(e) => patch({ agent: e.target.value })}
              >
                <option value="">Sin agente</option>
                {data.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.activo}
                onChange={(e) => patch({ activo: e.target.checked })}
              />
              Acceso activo
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-500 sm:col-span-2">
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}
      {role && (
        <Modal
          title="Permisos del rol"
          onClose={() => setRole(null)}
          footer={
            <Button
              onClick={() => {
                const nombre = role.nombre.trim()
                if (!nombre) return setError('Escribe el nombre del rol.')
                if (
                  data.roles.some(
                    (r) =>
                      r.id !== role.id &&
                      r.nombre.toLowerCase() === nombre.toLowerCase(),
                  )
                )
                  return setError('Ya existe ese rol.')
                if (role.id === 'admin')
                  role.permissions.users = Object.keys(ACTIONS)
                if (role.id) update('roles', role.id, { ...role, nombre })
                else add('roles', { ...role, nombre })
                setRole(null)
              }}
            >
              Guardar permisos
            </Button>
          }
        >
          <label className="block text-sm">
            Nombre del rol
            <input
              className="input my-2"
              value={role.nombre}
              onChange={(e) => setRole({ ...role, nombre: e.target.value })}
            />
          </label>
          <p className="mb-3 text-xs text-muted">
            El rol Administradores conserva la administración de usuarios para
            evitar perder el acceso.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Módulo</th>
                  {Object.values(ACTIONS).map((a) => (
                    <th key={a} className="p-2">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODULES).map(([k, label]) => (
                  <tr key={k} className="border-t border-line">
                    <td className="py-3">{label}</td>
                    {Object.keys(ACTIONS).map((action) => (
                      <td key={action} className="text-center">
                        <input
                          aria-label={`${label}: ${ACTIONS[action]}`}
                          type="checkbox"
                          disabled={role.id === 'admin' && k === 'users'}
                          checked={!!role.permissions[k]?.includes(action)}
                          onChange={(e) => {
                            const p = new Set(role.permissions[k] || [])
                            if (e.target.checked) {
                              p.add(action)
                              p.add('view')
                            } else {
                              p.delete(action)
                              if (action === 'view') p.clear()
                            }
                            setRole({
                              ...role,
                              permissions: { ...role.permissions, [k]: [...p] },
                            })
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Eliminar"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  remove(deleting.collection, deleting.row.id)
                  setDeleting(null)
                }}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <p>¿Eliminar {deleting.row.nombre}?</p>
        </Modal>
      )}
    </div>
  )
}
