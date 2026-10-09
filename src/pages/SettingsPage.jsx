import { useEffect, useRef, useState } from 'react'
import {
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Database,
  Smartphone,
} from 'lucide-react'
import { exportAttachments, importAttachments } from '../files'
import { RESOURCES } from '../config'
import { useStore } from '../store'
import { Button, Card, Modal } from '../components/ui'

export default function SettingsPage() {
  const { data, reset, clear, replaceAll, can } = useStore()
  const [confirm, setConfirm] = useState(null)
  const [msg, setMsg] = useState('')
  const file = useRef(null)
  const [installEvt, setInstallEvt] = useState(null)
  const standalone =
    typeof matchMedia === 'function' &&
    (matchMedia('(display-mode: standalone)').matches || navigator.standalone)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const h = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  const total = Object.values(data).reduce(
    (s, a) => s + (Array.isArray(a) ? a.length : 0),
    0,
  )

  const exportJson = async () => {
    try {
      const visible = Object.fromEntries(
        Object.entries(data).filter(([key]) =>
          can(
            {
              categories: 'equipment',
              serviceTypes: 'contracts',
              roles: 'users',
              users: 'users',
              reportSettings: 'reports',
            }[key] || key,
          ),
        ),
      )
      const backup = {
        ...visible,
        attachments: await exportAttachments(visible.contracts || []),
      }
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: 'application/json',
        }),
      )
      Object.assign(document.createElement('a'), {
        href: url,
        download: `sepsa-crm-${new Date().toISOString().slice(0, 10)}.json`,
      }).click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMsg('Respaldo descargado con los PDF adjuntos.')
    } catch (e) {
      setMsg(e.message)
    }
  }

  const importJson = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const obj = JSON.parse(await f.text())
      if (
        !obj ||
        typeof obj !== 'object' ||
        Array.isArray(obj) ||
        !Object.keys(RESOURCES).every((key) => Array.isArray(obj[key]))
      )
        throw new Error()
      await importAttachments(obj.attachments)
      replaceAll(obj)
      setMsg('Datos importados correctamente.')
    } catch {
      setMsg('El archivo no es válido.')
    }
    e.target.value = ''
  }

  const items = [
    {
      icon: Download,
      title: 'Exportar respaldo',
      text: 'Descarga los registros autorizados y sus PDF adjuntos en un archivo JSON.',
      action: (
        <Button variant="ghost" onClick={exportJson}>
          Exportar
        </Button>
      ),
    },
    {
      icon: Upload,
      title: 'Importar respaldo',
      text: 'Reemplaza los datos actuales con un archivo exportado.',
      action: (
        <Button variant="ghost" onClick={() => file.current.click()}>
          Importar
        </Button>
      ),
    },
    {
      icon: RotateCcw,
      title: 'Restaurar datos de ejemplo',
      text: 'Vuelve a cargar los datos de demostración.',
      action: (
        <Button variant="ghost" onClick={() => setConfirm('reset')}>
          Restaurar
        </Button>
      ),
    },
    {
      icon: Trash2,
      title: 'Borrar todo',
      text: 'Elimina todos los registros guardados en este navegador.',
      action: (
        <Button variant="danger" onClick={() => setConfirm('clear')}>
          Borrar
        </Button>
      ),
    },
  ].filter(
    (item) =>
      item.icon === Download ||
      (item.icon === Upload
        ? can('settings', 'update')
        : can('settings', 'delete')),
  )

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Smartphone className="size-6" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold">Instalar como app</h2>
          <p className="text-sm text-muted">
            {standalone
              ? 'Ya estás usando la app instalada.'
              : isIOS
                ? 'En iPhone: abre esta página en Safari, toca Compartir y elige "Añadir a pantalla de inicio".'
                : installEvt
                  ? 'Instálala en este dispositivo para abrirla como una app, a pantalla completa.'
                  : 'En Android (Chrome): menú ⋮ → "Instalar app" o "Añadir a pantalla de inicio". Requiere abrirla por HTTPS.'}
          </p>
        </div>
        {installEvt && !standalone && (
          <Button
            onClick={async () => {
              installEvt.prompt()
              await installEvt.userChoice
              setInstallEvt(null)
            }}
          >
            Instalar
          </Button>
        )}
      </Card>

      <Card className="flex items-center gap-4 p-5">
        <div className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
          <Database className="size-6" />
        </div>
        <div>
          <h2 className="font-bold">Almacenamiento local</h2>
          <p className="text-sm text-muted">
            {total} registros guardados en este navegador. Los PDF se guardan en
            IndexedDB. No se envían a ningún servidor.
          </p>
        </div>
      </Card>

      <Card className="divide-y divide-line">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <it.icon className="mt-0.5 size-5 text-muted" />
              <div>
                <div className="font-semibold">{it.title}</div>
                <div className="text-sm text-muted">{it.text}</div>
              </div>
            </div>
            <div className="sm:shrink-0">{it.action}</div>
          </div>
        ))}
      </Card>
      {msg && <p className="text-sm font-medium">{msg}</p>}
      <input
        ref={file}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={importJson}
      />

      {confirm && (
        <Modal
          size="max-w-md"
          title={
            confirm === 'reset'
              ? 'Restaurar datos de ejemplo'
              : 'Borrar todos los datos'
          }
          subtitle="Se reemplazarán los registros actuales."
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  confirm === 'reset' ? reset() : clear()
                  setConfirm(null)
                }}
              >
                Confirmar
              </Button>
            </>
          }
        >
          <p className="text-sm">
            ¿Deseas continuar? Te recomendamos exportar un respaldo antes.
          </p>
        </Modal>
      )}
    </div>
  )
}
