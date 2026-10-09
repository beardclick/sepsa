import { useState } from 'react'
import { LocateFixed, ImagePlus } from 'lucide-react'
import { RESOURCES } from '../config'
import { Button, Modal, Thumb } from './ui'
import { fileToDataUrl } from '../image'
import { DatePicker, TimePicker } from './DateTimePicker'
import LocationPicker from './LocationPicker'
import { savePdf, downloadPdf } from '../files'

const titleKeyOf = (collection) =>
  Object.values(RESOURCES).find((x) => x.collection === collection).titleKey

// Formulario en popup para crear/editar cualquier registro. `record` puede traer valores por defecto (sin id).
export default function RecordForm({
  cfg,
  record,
  data,
  onSave,
  onClose,
  onDelete,
  lockedFields = [],
}) {
  const editing = !!record?.id
  const [values, setValues] = useState(() => {
    const init = {}
    cfg.fields.forEach((f) => {
      init[f.key] =
        record?.[f.key] ??
        (f.type === 'pdf'
          ? []
          : f.type === 'select' && !f.ref
            ? f.catalog
              ? data[f.catalog]?.[0]?.[
                  f.catalog === 'categories' ? 'id' : 'nombre'
                ] || ''
              : f.options[0]
            : '')
    })
    if (cfg.collection === 'clients') {
      init.lat = record?.lat ?? 8.4273
      init.lng = record?.lng ?? -82.4308
      init.ciudad ||= 'David, Chiriquí'
    }
    cfg.fields
      .filter((f) => f.type === 'time')
      .forEach((f) => {
        init[f.key] ||= f.key === 'fin' ? '18:00' : '06:00'
      })
    return init
  })
  const [errors, setErrors] = useState({})
  const [uploading, setUploading] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }))
  const hasCoords =
    cfg.fields.some((f) => f.key === 'lat') &&
    cfg.fields.some((f) => f.key === 'lng')

  const locate = () => {
    if (!navigator.geolocation)
      return setGeoMsg('Tu navegador no permite geolocalización.')
    setGeoMsg('Obteniendo ubicación…')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setValues((s) => ({
          ...s,
          lat: p.coords.latitude.toFixed(6),
          lng: p.coords.longitude.toFixed(6),
        }))
        setGeoMsg('')
      },
      () => setGeoMsg('No se pudo obtener la ubicación (permiso denegado).'),
    )
  }

  const submit = (e) => {
    e.preventDefault()
    const errs = {}
    cfg.fields.forEach((f) => {
      if (f.required && !String(values[f.key]).trim())
        errs[f.key] = 'Campo obligatorio'
    })
    setErrors(errs)
    if (Object.keys(errs).length) return
    const out = { ...values }
    cfg.fields.forEach((f) => {
      if (f.type === 'number' || f.type === 'money')
        out[f.key] = Number(out[f.key]) || 0
      if (f.type === 'coord')
        out[f.key] = out[f.key] === '' ? '' : Number(out[f.key])
    })
    onSave(out)
  }

  return (
    <Modal
      title={`${editing ? 'Editar' : 'Nuevo'} ${cfg.singular}`}
      subtitle={
        editing
          ? 'Actualiza la información y guarda los cambios'
          : 'Completa los datos para registrarlo'
      }
      onClose={onClose}
      footer={
        <>
          {editing && onDelete && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => onDelete(record)}
              className="!text-red-500 sm:mr-auto"
            >
              Eliminar
            </Button>
          )}
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={uploading} type="submit" form="record-form">
            {editing ? 'Guardar cambios' : `Crear ${cfg.singular}`}
          </Button>
        </>
      }
    >
      <form
        id="record-form"
        onSubmit={submit}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        {cfg.fields.map((f) => {
          const common = {
            disabled: lockedFields.includes(f.key),
            id: `f-${f.key}`,
            className: 'input',
            value: values[f.key],
            onChange: (e) => set(f.key, e.target.value),
          }
          let control
          if (f.type === 'select') {
            const opts = f.ref
              ? data[f.ref].map((r) => [r.id, r[titleKeyOf(f.ref)]])
              : f.catalog
                ? data[f.catalog].map((r) => [
                    f.catalog === 'categories' ? r.id : r.nombre,
                    r.nombre,
                  ])
                : f.options.map((o) => [o, o])
            control = (
              <select {...common}>
                {(f.ref || f.catalog) && <option value="">Seleccionar…</option>}
                {opts.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            )
          } else if (f.type === 'date') {
            control = (
              <DatePicker
                id={common.id}
                value={values[f.key]}
                onChange={(v) => set(f.key, v)}
              />
            )
          } else if (f.type === 'time') {
            control = (
              <TimePicker
                id={common.id}
                value={values[f.key]}
                onChange={(v) => set(f.key, v)}
              />
            )
          } else if (f.type === 'location') {
            control = (
              <LocationPicker
                lat={values.lat}
                lng={values.lng}
                onChange={(p) => setValues((v) => ({ ...v, ...p }))}
              />
            )
          } else if (f.type === 'pdf') {
            control = (
              <div className="space-y-2">
                <input
                  aria-label="Adjuntar PDF"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="input"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || [])
                    e.target.value = ''
                    setUploading(true)
                    try {
                      const saved = []
                      for (const file of files) saved.push(await savePdf(file))
                      setValues((v) => ({
                        ...v,
                        [f.key]: [...(v[f.key] || []), ...saved],
                      }))
                      setGeoMsg('')
                    } catch (err) {
                      setGeoMsg(err.message)
                    } finally {
                      setUploading(false)
                    }
                  }}
                />
                {(values[f.key] || []).map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line p-2 text-sm"
                  >
                    <button
                      type="button"
                      className="text-accent"
                      onClick={() =>
                        downloadPdf(file).catch((e) => setGeoMsg(e.message))
                      }
                    >
                      {file.nombre}
                    </button>
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() =>
                        set(
                          f.key,
                          values[f.key].filter((x) => x.id !== file.id),
                        )
                      }
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )
          } else if (f.type === 'textarea') {
            control = <textarea {...common} rows={3} />
          } else if (f.type === 'image') {
            control = (
              <div className="flex items-center gap-4">
                <Thumb
                  src={values[f.key]}
                  name={values.nombre || values.titulo || ''}
                  size="size-20"
                  round={false}
                  text="text-lg"
                />
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold hover:bg-soft">
                    <ImagePlus className="size-4" />{' '}
                    {values[f.key] ? 'Cambiar' : 'Subir imagen'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          set(f.key, await fileToDataUrl(file))
                          setGeoMsg('')
                        } catch (err) {
                          setGeoMsg(err.message)
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {values[f.key] && (
                    <button
                      type="button"
                      onClick={() => set(f.key, '')}
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/10 cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            )
          } else if (f.type === 'coord') {
            control = (
              <input
                {...common}
                type="number"
                step="any"
                placeholder="0.000000"
              />
            )
          } else {
            control = (
              <input
                {...common}
                type={f.type === 'money' ? 'number' : f.type || 'text'}
                min={f.type === 'money' || f.type === 'number' ? 0 : undefined}
                placeholder={f.type === 'money' ? '0' : undefined}
              />
            )
          }
          return (
            <div
              key={f.key}
              className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}
            >
              <label
                htmlFor={`f-${f.key}`}
                className="mb-1.5 block text-sm font-medium"
              >
                {f.label}
                {f.required && <span className="text-accent"> *</span>}
              </label>
              {control}
              {errors[f.key] && (
                <p className="mt-1 text-xs text-red-500">{errors[f.key]}</p>
              )}
            </div>
          )
        })}
        {geoMsg && (
          <p role="alert" className="sm:col-span-2 text-sm text-red-500">
            {geoMsg}
          </p>
        )}
        {hasCoords && (
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={locate}
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline cursor-pointer"
            >
              <LocateFixed className="size-4" /> Usar mi ubicación actual
            </button>
            {geoMsg && <p className="mt-1 text-xs text-muted">{geoMsg}</p>}
          </div>
        )}
      </form>
    </Modal>
  )
}
