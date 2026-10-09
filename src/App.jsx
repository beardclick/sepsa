import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { StoreProvider, useStore } from './store'
import { RESOURCES } from './config'
import Layout from './components/Layout'
import ExitGuard from './components/ExitGuard'
import Dashboard from './pages/Dashboard'
import ResourcePage from './pages/ResourcePage'
import CalendarPage from './pages/CalendarPage'
import CatalogPage from './pages/CatalogPage'
import ReportsPage from './pages/ReportsPage'
import AccessPage from './pages/AccessPage'
import AgentPortal from './pages/AgentPortal'
import LoginPage from './pages/LoginPage'
import { moduleForPath, homeFor } from './access'
import DetailPage from './pages/DetailPage'
import SettingsPage from './pages/SettingsPage'

function AccessGate({ children }) {
  const { user, role, can, logout } = useStore()
  const { pathname } = useLocation()
  if (!user) return <LoginPage />
  const module = moduleForPath(pathname)
  if (module && !can(module)) {
    const home = homeFor(role?.permissions)
    return home ? (
      <Navigate to={home} replace />
    ) : (
      <div className="p-8">
        Tu rol no tiene módulos habilitados. Contacta al administrador.
        <button className="mt-3 block underline" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    )
  }
  return children
}
export default function App() {
  return (
    <StoreProvider>
      <ExitGuard />
      <HashRouter>
        <Routes>
          <Route
            element={
              <AccessGate>
                <Layout />
              </AccessGate>
            }
          >
            <Route index element={<Dashboard />} />
            {Object.entries(RESOURCES).map(([key, r]) => (
              <Route key={key} path={r.path}>
                <Route
                  index
                  element={<ResourcePage key={key} resKey={key} />}
                />
                <Route
                  path=":id"
                  element={<DetailPage key={key} resKey={key} />}
                />
              </Route>
            ))}
            <Route path="calendario" element={<CalendarPage />} />
            <Route
              path="equipos/categorias"
              element={<CatalogPage collection="categories" />}
            />
            <Route
              path="contratos/servicios"
              element={<CatalogPage collection="serviceTypes" />}
            />
            <Route path="informes" element={<ReportsPage />} />
            <Route path="usuarios" element={<AccessPage />} />
            <Route path="portal-agente" element={<AgentPortal />} />
            <Route path="ajustes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
