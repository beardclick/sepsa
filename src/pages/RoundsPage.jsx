import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { incidentRequest } from '../cloudIncidents'
import { DatePicker, TimePicker } from '../components/DateTimePicker'
import { Button, Card, Modal } from '../components/ui'
import { fdate, ftime } from '../config'
import { dayKey } from '../duty'
const blank = () => ({
  titulo: '',
  lugar: '',
  fecha: dayKey(new Date()),
  inicio: '08:00',
  fin: '09:00',
  asignados: [],
  comentarios: '',
})
export default function RoundsPage() {
  const { user, can } = useStore()
  const admin = user?.role === 'admin'
  const [rounds, setRounds] = useState([]),
    [users, setUsers] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [form, setForm] = useState(null),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false)
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const ticket = ++generation.current
    try {
      const result = await incidentRequest('/api/rounds')
      const directory = admin
        ? await incidentRequest('/api/rounds/assignees')
        : { users: [] }
      if (ticket !== generation.current) return
      setRounds(result.rounds)
      setUsers(directory.users)
      setError('')
    } catch (e) {
      if (ticket === generation.current) {
        setRounds([])
        setError(e.message)
      }
    } finally {
      if (ticket === generation.current) setLoading(false)
    }
  }, [user?.id, admin])
  useEffect(() => {
    setRounds([])
    setUsers([])
    setLoading(true)
    refresh()
    const timer = setInterval(refresh, 20000)
    window.addEventListener('focus', refresh)
    window.addEventListener('sepsa:refresh', refresh)
    return () => {
      ++generation.current
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('sepsa:refresh', refresh)
    }
  }, [refresh])
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }))
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await incidentRequest(
        form.id ? '/api/rounds/' + form.id : '/api/rounds',
        form.id ? 'PATCH' : 'POST',
        form,
      )
      setForm(null)
      await refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await incidentRequest('/api/rounds/' + form.id, 'DELETE')
      setForm(null)
      setConfirmDelete(false)
      await refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const open = (record) => {
    setError('')
    setConfirmDelete(false)
    setForm({ ...record, asignados: [...record.asignados] })
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            {admin ? 'Rondas' : 'Mis rondas asignadas'}
          </h2>
          <p className="text-sm text-muted">
            {admin
              ? 'Organiza lugares, horarios y responsables de cada ronda.'
              : 'Consulta los lugares y horarios de tus rondas.'}
          </p>
        </div>
        {admin && can('rounds', 'create') && (
          <Button onClick={() => open(blank())}>Nueva ronda</Button>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-red-500">
          {error}
        </p>
      )}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-soft">
              <tr>
                {[
                  'Ronda',
                  'Lugar',
                  'Fecha',
                  'Horario',
                  ...(admin ? ['Responsables', ''] : []),
                ].map((title, i) => (
                  <th key={i} className="p-4">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="p-4">
                    <p className="font-semibold">{r.titulo}</p>
                    {r.comentarios && (
                      <p className="mt-1 max-w-sm whitespace-pre-wrap text-xs text-muted">
                        {r.comentarios}
                      </p>
                    )}
                  </td>
                  <td className="p-4">{r.lugar}</td>
                  <td className="p-4 whitespace-nowrap">{fdate(r.fecha)}</td>
                  <td className="p-4 whitespace-nowrap">
                    {ftime(r.inicio)} – {ftime(r.fin)}
                    {r.fin < r.inicio && (
                      <p className="text-xs text-muted">
                        Termina al día siguiente
                      </p>
                    )}
                  </td>
                  {admin && (
                    <>
                      <td className="p-4">
                        {r.asignados
                          .map(
                            (id) =>
                              users.find((u) => u.id === id)?.nombre ||
                              'Usuario no disponible',
                          )
                          .join(', ')}
                      </td>
                      <td className="p-4">
                        {can('rounds', 'update') && (
                          <Button variant="ghost" onClick={() => open(r)}>
                            Editar
                          </Button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? (
          <p role="status" className="p-5 text-muted">
            Cargando rondas…
          </p>
        ) : (
          !rounds.length && (
            <p className="p-5 text-muted">
              {admin ? 'Aún no hay rondas.' : 'No tienes rondas asignadas.'}
            </p>
          )
        )}
      </Card>
      {form && (
        <Modal
          title={form.id ? 'Editar ronda' : 'Nueva ronda'}
          onClose={() => {
            if (!busy) setForm(null)
          }}
        >
          <form onSubmit={save} className="space-y-4">
            <label className="block text-sm font-semibold">
              Nombre de la ronda
              <input
                className="input mt-1"
                required
                maxLength={160}
                value={form.titulo}
                onChange={(e) => change('titulo', e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Lugar
              <input
                className="input mt-1"
                required
                maxLength={300}
                value={form.lugar}
                onChange={(e) => change('lugar', e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="round-date" className="text-sm font-semibold">
                  Fecha
                </label>
                <DatePicker
                  id="round-date"
                  value={form.fecha}
                  onChange={(value) => change('fecha', value)}
                />
              </div>
              <div>
                <label htmlFor="round-start" className="text-sm font-semibold">
                  Desde
                </label>
                <TimePicker
                  id="round-start"
                  value={form.inicio}
                  onChange={(value) => change('inicio', value)}
                />
              </div>
              <div>
                <label htmlFor="round-end" className="text-sm font-semibold">
                  Hasta
                </label>
                <TimePicker
                  id="round-end"
                  value={form.fin}
                  onChange={(value) => change('fin', value)}
                />
              </div>
            </div>
            {form.fin < form.inicio && (
              <p className="text-xs text-muted">
                Esta ronda termina al día siguiente.
              </p>
            )}
            <fieldset className="rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-semibold">
                Jefes de seguridad y supervisores
              </legend>
              <div className="max-h-52 space-y-2 overflow-y-auto">
                {[
                  ...users,
                  ...form.asignados
                    .filter((id) => !users.some((u) => u.id === id))
                    .map((id) => ({
                      id,
                      nombre: 'Usuario no disponible (retirar asignación)',
                      role: null,
                    })),
                ].map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.asignados.includes(u.id)}
                      onChange={(e) =>
                        change(
                          'asignados',
                          e.target.checked
                            ? [...form.asignados, u.id]
                            : form.asignados.filter((id) => id !== u.id),
                        )
                      }
                    />
                    {u.nombre}
                    <span className="text-xs text-muted">
                      {u.role === 'chief'
                        ? 'Jefe de seguridad'
                        : u.role === 'supervisor'
                          ? 'Supervisor'
                          : ''}
                    </span>
                  </label>
                ))}
              </div>
              {!users.length && (
                <p className="text-sm text-muted">
                  Crea primero un jefe de seguridad o supervisor activo en
                  Usuarios y permisos.
                </p>
              )}
            </fieldset>
            <label className="block text-sm font-semibold">
              Comentarios
              <textarea
                className="input mt-1"
                rows={3}
                maxLength={3000}
                value={form.comentarios}
                onChange={(e) => change('comentarios', e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {form.id && can('rounds', 'delete') && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  Eliminar ronda
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                Cancelar
              </Button>
              <Button disabled={busy || !form.asignados.length}>
                {busy ? 'Guardando…' : 'Guardar ronda'}
              </Button>
            </div>
            {confirmDelete && (
              <div className="rounded-xl border border-red-500/30 p-3">
                <p className="mb-2 text-sm">
                  ¿Eliminar esta ronda para todos sus responsables?
                </p>
                <Button type="button" disabled={busy} onClick={remove}>
                  Confirmar eliminación
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDelete(false)}
                >
                  Conservar ronda
                </Button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
