import { useState } from 'react'
import { useStore } from '../store'
import {
  REPORT_SECTIONS,
  makeReport,
  reportDate,
  downloadReport,
} from '../reports'
import { fdate } from '../config'
import { Card, Button, Modal } from '../components/ui'
import { DatePicker } from '../components/DateTimePicker'
export default function ReportsPage() {
  const { data, can, add, update, remove, reportPreferences } = useStore()
  const available = Object.keys(REPORT_SECTIONS).filter((k) => can(k))
  const [fecha, setFecha] = useState(reportDate()),
    [sections, setSections] = useState(
      data.reportSettings.sections.filter((k) => available.includes(k)),
    ),
    [comments, setComments] = useState(''),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(''),
    [creating, setCreating] = useState(false),
    [pending, setPending] = useState(null)
  const report = data.reports.find((r) => r.id === selected)
  const openCreator = (existing) => {
    setFecha(existing?.fecha || reportDate())
    setSections(
      (existing
        ? existing.sections.map((s) => s.key)
        : data.reportSettings.sections
      ).filter((k) => available.includes(k)),
    )
    setComments(existing?.comentarios || '')
    setError('')
    setPending(null)
    setCreating(true)
  }
  const closeCreator = () => {
    setCreating(false)
    setPending(null)
    setError('')
  }
  const commit = (draft) => {
    const existing = data.reports.find((r) => r.fecha === draft.fecha)
    const result = existing
      ? update('reports', existing.id, draft)
      : add('reports', draft)
    if (!result) return setError('No tienes permiso para guardar este informe.')
    setSelected(existing?.id || result)
    setCreating(false)
    setPending(null)
    setError('Informe guardado correctamente.')
  }
  const generate = () => {
    if (!sections.length) return setError('Selecciona al menos una sección.')
    const existing = data.reports.find((r) => r.fecha === fecha)
    if (existing && !can('reports', 'update'))
      return setError(
        `Ya existe un informe del ${fdate(fecha)}. Necesitas permiso de edición para actualizarlo.`,
      )
    if (!existing && !can('reports', 'create'))
      return setError('No tienes permiso para crear un informe nuevo.')
    const draft = makeReport(data, fecha, sections, comments)
    if (existing) {
      setPending(draft)
      setError('')
    } else commit(draft)
  }
  const download = (r) =>
    downloadReport({
      ...r,
      sections: r.sections.filter((s) => can(s.key)),
    }).catch((e) => setError(e.message))
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Se genera un informe por día, en horario de Panamá, mientras la
        aplicación está abierta. Actualízalo al cierre de la jornada para
        incluir las últimas novedades.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Informes diarios</h2>
        {(can('reports', 'create') || can('reports', 'update')) && (
          <Button onClick={() => openCreator()}>Generar informe</Button>
        )}
      </div>
      {creating && (
        <Modal
          title={
            pending ? 'Informe previamente generado' : 'Preparar informe diario'
          }
          onClose={closeCreator}
          footer={
            pending ? (
              <>
                <Button variant="ghost" onClick={() => setPending(null)}>
                  Volver
                </Button>
                <Button onClick={() => commit(pending)}>
                  Actualizar informe existente
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={closeCreator}>
                  Cancelar
                </Button>
                <Button onClick={generate}>Generar informe</Button>
              </>
            )
          }
        >
          {pending ? (
            <div role="alert" className="space-y-3">
              <p className="font-semibold">
                Ya existe un informe del {fdate(pending.fecha)}.
              </p>
              <p className="text-sm text-muted">
                Al continuar se reemplazarán sus datos y comentarios con esta
                nueva selección. El informe anterior se conservará si cancelas.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm">
                  Fecha
                  <DatePicker
                    value={fecha}
                    max={reportDate()}
                    onChange={(v) => {
                      if (v) setFecha(v)
                    }}
                  />
                </label>
                <div>
                  <p className="mb-2 text-sm font-semibold">Datos a incluir</p>
                  <div className="grid gap-2">
                    {available.map((k) => (
                      <label
                        key={k}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={sections.includes(k)}
                          onChange={(e) =>
                            setSections(
                              e.target.checked
                                ? [...sections, k]
                                : sections.filter((x) => x !== k),
                            )
                          }
                        />
                        {REPORT_SECTIONS[k]}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="text-sm sm:col-span-2">
                  Comentarios
                  <textarea
                    className="input mt-2"
                    rows={4}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Novedades, observaciones y seguimiento de la jornada…"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {can('reports', 'update') && (
                  <Button
                    variant="ghost"
                    disabled={!sections.length}
                    onClick={() => {
                      reportPreferences({ sections, comentarios: comments })
                      setError('Preferencias diarias guardadas.')
                    }}
                  >
                    Usar esta selección diariamente
                  </Button>
                )}
                {can('reports', 'update') && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={data.reportSettings.enabled}
                      onChange={(e) =>
                        reportPreferences({ enabled: e.target.checked })
                      }
                    />
                    Generación diaria automática
                  </label>
                )}
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-accent">
              {error}
            </p>
          )}
        </Modal>
      )}
      {error && !creating && (
        <p role="status" className="text-sm text-accent">
          {error}
        </p>
      )}
      <Card className="p-5">
        <h2 className="mb-3 text-lg font-bold">Historial de informes</h2>
        <div className="space-y-3">
          {!data.reports.length && (
            <p className="text-sm text-muted">Sin informes.</p>
          )}
          {[...data.reports]
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
              >
                <div className="mr-auto">
                  <p className="font-semibold">Informe {fdate(r.fecha)}</p>
                  <p className="text-xs text-muted">
                    {r.sections
                      .filter((s) => can(s.key))
                      .map((s) => s.title)
                      .join(' · ')}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setSelected(r.id)}>
                  Ver
                </Button>
                <Button onClick={() => download(r)}>Descargar PDF</Button>
                {can('reports', 'update') && (
                  <Button variant="ghost" onClick={() => openCreator(r)}>
                    Actualizar
                  </Button>
                )}
                {can('reports', 'delete') && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar el informe del ${fdate(r.fecha)}?`,
                        )
                      )
                        remove('reports', r.id)
                    }}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            ))}
        </div>
      </Card>
      {report && (
        <Card className="p-5">
          <h2 className="mb-4 font-bold">Informe {fdate(report.fecha)}</h2>
          {report.sections
            .filter((s) => can(s.key))
            .map((s) => (
              <details
                key={s.key}
                className="mb-3 rounded-xl border border-line p-3"
              >
                <summary className="cursor-pointer font-semibold">
                  {s.title} · {s.rows.length} registros
                </summary>
                {s.rows.map((r, i) => (
                  <p key={i} className="mt-3 border-t border-line pt-2 text-sm">
                    {Object.entries(r)
                      .map(([k, v]) => `${k}: ${v || '—'}`)
                      .join(' · ')}
                  </p>
                ))}
              </details>
            ))}
          <p className="whitespace-pre-wrap text-sm">
            {report.comentarios || 'Sin comentarios.'}
          </p>
          {can('reports', 'update') && (
            <Button
              className="mt-4"
              variant="ghost"
              onClick={() => openCreator(report)}
            >
              Editar informe
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}
