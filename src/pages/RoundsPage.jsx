import { roundStops, routeTimeline } from '../roundRoute'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { incidentRequest } from '../cloudIncidents'
import { DatePicker, TimePicker } from '../components/DateTimePicker'
import { Button, Card, Modal } from '../components/ui'
import { fdate, ftime } from '../config'
import { dayKey } from '../duty'
const blank = () => ({
  titulo: '',
  paradas: [{ lugar: '', inicio: '08:00', fin: '09:00' }],
  fecha: dayKey(new Date()),
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
    [detailId, setDetailId] = useState(null),
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
    setForm({
      ...record,
      paradas: roundStops(record).map((stop) => ({ ...stop })),
      asignados: [...record.asignados],
    })
  }
  const detail = rounds.find((round) => round.id === detailId)
  const changeStop = (index, key, value) =>
    change(
      'paradas',
      form.paradas.map((stop, i) =>
        i === index ? { ...stop, [key]: value } : stop,
      ),
    )
  const moveStop = (index, direction) => {
    const stops = [...form.paradas]
    ;[stops[index], stops[index + direction]] = [
      stops[index + direction],
      stops[index],
    ]
    change('paradas', stops)
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
                  'Recorrido',
                  'Fecha',
                  'Horario',
                  ...(admin ? ['Responsables'] : []),
                  'Acciones',
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
                  <td className="p-4">
                    <p>
                      {roundStops(r)
                        .map((stop) => stop.lugar)
                        .join(' → ')}
                    </p>
                    <p className="text-xs text-muted">
                      {roundStops(r).length} lugares
                    </p>
                  </td>
                  <td className="p-4 whitespace-nowrap">{fdate(r.fecha)}</td>
                  <td className="p-4 whitespace-nowrap">
                    {ftime(roundStops(r)[0].inicio)} –{' '}
                    {ftime(roundStops(r).at(-1).fin)}
                    {routeTimeline(roundStops(r)).at(-1).endDay > 0 && (
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
                    </>
                  )}
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setDetailId(r.id)}>
                        Ver detalles
                      </Button>
                      {admin && can('rounds', 'update') && (
                        <Button variant="ghost" onClick={() => open(r)}>
                          Editar
                        </Button>
                      )}
                    </div>
                  </td>
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
      {detail && (
        <Modal title="Detalles de ronda" onClose={() => setDetailId(null)}>
          <div className="space-y-4">
            <h3 className="text-lg font-bold">{detail.titulo}</h3>
            <p className="text-sm">Fecha de inicio: {fdate(detail.fecha)}</p>
            <ol className="space-y-3">
              {routeTimeline(roundStops(detail)).map((stop, index) => (
                <li key={index} className="rounded-xl border border-line p-4">
                  <p className="font-semibold">
                    {index + 1}. {stop.lugar}
                  </p>
                  <p className="mt-1 text-sm">
                    {ftime(stop.inicio)} – {ftime(stop.fin)}
                  </p>
                  {stop.startDay > 0 && (
                    <p className="text-xs text-muted">
                      {stop.startDay} día(s) después del inicio
                    </p>
                  )}
                  {stop.endDay > stop.startDay && (
                    <p className="text-xs text-muted">
                      Termina al día siguiente
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {admin && (
              <p className="text-sm">
                <strong>Responsables: </strong>
                {detail.asignados
                  .map(
                    (id) =>
                      users.find((u) => u.id === id)?.nombre ||
                      'Usuario no disponible',
                  )
                  .join(', ')}
              </p>
            )}
            {detail.comentarios && (
              <div>
                <p className="text-sm font-bold">Comentarios</p>
                <p className="whitespace-pre-wrap text-sm">
                  {detail.comentarios}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              {admin && can('rounds', 'update') && (
                <Button
                  onClick={() => {
                    setDetailId(null)
                    open(detail)
                  }}
                >
                  Editar ronda
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDetailId(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}
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
            <div className="max-w-sm">
              <label htmlFor="round-date" className="text-sm font-semibold">
                Fecha de inicio de la ronda
              </label>
              <DatePicker
                id="round-date"
                value={form.fecha}
                onChange={(value) => change('fecha', value)}
              />
            </div>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-bold">
                Recorrido en orden de visita
              </legend>
              {form.paradas.map((stop, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-xl border border-line bg-soft/40 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto text-sm font-bold">
                      Lugar {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === 0}
                      aria-label={`Subir lugar ${index + 1}`}
                      onClick={() => moveStop(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === form.paradas.length - 1}
                      aria-label={`Bajar lugar ${index + 1}`}
                      onClick={() => moveStop(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={form.paradas.length === 1}
                      onClick={() =>
                        change(
                          'paradas',
                          form.paradas.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Quitar lugar
                    </Button>
                  </div>
                  <label className="block text-sm font-semibold">
                    Lugar
                    <input
                      className="input mt-1"
                      required
                      maxLength={300}
                      value={stop.lugar}
                      onChange={(e) =>
                        changeStop(index, 'lugar', e.target.value)
                      }
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label
                        htmlFor={`round-start-${index}`}
                        className="text-sm font-semibold"
                      >
                        Desde
                      </label>
                      <TimePicker
                        id={`round-start-${index}`}
                        value={stop.inicio}
                        onChange={(value) => changeStop(index, 'inicio', value)}
                      />
                    </div>
                    <div className="min-w-0">
                      <label
                        htmlFor={`round-end-${index}`}
                        className="text-sm font-semibold"
                      >
                        Hasta
                      </label>
                      <TimePicker
                        id={`round-end-${index}`}
                        value={stop.fin}
                        onChange={(value) => changeStop(index, 'fin', value)}
                      />
                    </div>
                  </div>
                  {routeTimeline(form.paradas)[index].startDay > 0 && (
                    <p className="text-xs text-muted">
                      Visita {routeTimeline(form.paradas)[index].startDay}{' '}
                      día(s) después de la fecha de inicio.
                    </p>
                  )}
                  {stop.fin < stop.inicio && (
                    <p className="text-xs text-muted">
                      La visita termina al día siguiente.
                    </p>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                disabled={form.paradas.length >= 50}
                onClick={() =>
                  change('paradas', [
                    ...form.paradas,
                    {
                      lugar: '',
                      inicio: form.paradas.at(-1).fin,
                      fin: form.paradas.at(-1).fin,
                    },
                  ])
                }
              >
                Agregar lugar
              </Button>
              <p className="text-xs text-muted">
                Los horarios siguen el orden del recorrido. Si una hora es
                anterior al fin de la visita previa, corresponde al día
                siguiente.
              </p>
            </fieldset>
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
