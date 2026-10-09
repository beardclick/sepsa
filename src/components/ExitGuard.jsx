import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { isStandalone } from '../nav'
import { Button, Modal } from './ui'

// En la app instalada, el botón "atrás" no recorre pantallas: pregunta si se desea salir.
// Truco estándar: se deja una entrada "guardia" antes de la de la app; al volver a ella se muestra el aviso
// y se regresa a la entrada de la app. Al confirmar se baja a la guardia; el siguiente "atrás" cierra la app.
export default function ExitGuard() {
  const [ask, setAsk] = useState(false)
  const [hint, setHint] = useState(false)
  const exiting = useRef(false)

  useEffect(() => {
    if (!isStandalone()) return
    history.replaceState({ ...history.state, sepsaGuard: true }, '')
    history.pushState({ ...history.state, sepsaGuard: false }, '')

    const onPop = (e) => {
      if (exiting.current || !e.state?.sepsaGuard) return
      history.go(1) // volver a la entrada de la app
      setAsk(true)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const leave = () => {
    exiting.current = true
    setAsk(false)
    history.go(-1)
    window.close()
    setHint(true)
    // Si la app sigue abierta (el sistema no permite cerrarla por código), se restaura la protección
    setTimeout(() => {
      if (exiting.current) { history.go(1); exiting.current = false }
      setHint(false)
    }, 4000)
  }

  return (
    <>
      {ask && (
        <Modal
          size="max-w-sm"
          title="¿Salir de la aplicación?"
          subtitle="Se cerrará SEPSA CRM."
          onClose={() => setAsk(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAsk(false)}>Quedarme</Button>
              <Button onClick={leave}><LogOut className="size-4" /> Salir</Button>
            </>
          }
        >
          <p className="text-sm text-muted">Tus datos quedan guardados en este dispositivo.</p>
        </Modal>
      )}
      {hint && (
        <div className="anim-pop fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-sm rounded-xl border border-line bg-card px-4 py-3 text-center text-sm font-semibold shadow-2xl">
          Presiona “atrás” otra vez para salir
        </div>
      )}
    </>
  )
}
