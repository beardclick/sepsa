import { useState } from 'react'
import { useStore } from '../store'
import { Button, Card, Modal } from '../components/ui'
export default function CatalogPage({ collection }) {
  const { data, add, remove, renameCatalog, can } = useStore()
  const module = collection === 'categories' ? 'equipment' : 'contracts'
  const [editing, setEditing] = useState(null),
    [nombre, setNombre] = useState(''),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState(null)
  const title =
    collection === 'categories' ? 'Categorías de equipos' : 'Tipos de servicios'
  const used = (r) =>
    collection === 'categories'
      ? data.equipment.some((e) => e.categoria === r.id)
      : [...data.contracts, ...data.leads].some((e) => e.servicio === r.nombre)
  const save = (e) => {
    e.preventDefault()
    const name = nombre.trim()
    if (!name) return setError('Escribe un nombre.')
    if (
      data[collection].some(
        (r) =>
          r.id !== editing.id &&
          r.nombre.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      return setError('Ya existe ese nombre.')
    if (editing.id) renameCatalog(collection, editing.id, name)
    else add(collection, { nombre: name })
    setEditing(null)
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {can(module, 'create') && (
          <Button
            onClick={() => {
              setEditing({})
              setNombre('')
              setError('')
            }}
          >
            Agregar
          </Button>
        )}
      </div>
      <Card className="divide-y divide-line">
        {!data[collection].length && (
          <p className="p-5 text-muted">
            Sin registros. Agrega uno para usarlo en los formularios.
          </p>
        )}
        {data[collection].map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
            <span className="mr-auto font-semibold">{r.nombre}</span>
            {can(module, 'update') && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(r)
                  setNombre(r.nombre)
                  setError('')
                }}
              >
                Editar
              </Button>
            )}

            {used(r) && <span className="text-xs text-muted">En uso</span>}
          </div>
        ))}
      </Card>
      {editing && (
        <Modal
          title={editing.id ? 'Editar' : 'Agregar'}
          onClose={() => setEditing(null)}
          footer={
            <>
              {editing.id && can(module, 'delete') && (
                <Button
                  variant="ghost"
                  disabled={used(editing)}
                  onClick={() => {
                    setDeleting(editing)
                    setEditing(null)
                  }}
                >
                  Eliminar
                </Button>
              )}
              <Button form="catalog-form">Guardar</Button>
            </>
          }
        >
          <form id="catalog-form" onSubmit={save}>
            <label className="block text-sm">
              Nombre
              <input
                autoFocus
                className="input mt-2"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-500">
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Eliminar registro"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  remove(collection, deleting.id)
                  setDeleting(null)
                }}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <p>¿Eliminar {deleting.nombre}?</p>
        </Modal>
      )}
    </div>
  )
}
