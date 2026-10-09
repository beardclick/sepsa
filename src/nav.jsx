import { forwardRef, useCallback } from 'react'
import { Link as RLink, NavLink as RNavLink, useNavigate as useRNavigate } from 'react-router-dom'

// ¿Está corriendo como app instalada (PWA)? (sessionStorage permite forzarlo para pruebas)
export const isStandalone = () => {
  try { if (sessionStorage.getItem('sepsa-force-standalone') === '1') return true } catch {}
  return (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true
}

// En la app instalada la navegación interna reemplaza la entrada del historial (no la apila),
// así el botón "atrás" del teléfono no recorre pantallas: sale de la app (con aviso, ver ExitGuard).
export const Link = forwardRef((props, ref) => <RLink ref={ref} replace={isStandalone()} {...props} />)
export const NavLink = forwardRef((props, ref) => <RNavLink ref={ref} replace={isStandalone()} {...props} />)

export function useNavigate() {
  const nav = useRNavigate()
  return useCallback((to, opts = {}) => nav(to, { replace: isStandalone(), ...opts }), [nav])
}
