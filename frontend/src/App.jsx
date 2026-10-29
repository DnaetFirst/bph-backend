import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { apiClient } from './api/client';
const CatalogosBajas = lazy(() => import('./modules/bajas/CatalogosBajas'));
const Bajas = lazy(() => import('./modules/bajas/Bajas'));
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import {
  CheckCircle2, AlertCircle, Info, X, User, LogOut, Shield,
  LayoutDashboard, ClipboardList, History, Menu,
} from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { useUiStore } from './store/uiStore';
import Login from './pages/Login';
import ForgotPin from './pages/ForgotPin';
import ResetPin from './pages/ResetPin';
import Inicio from './pages/Inicio';
import Dashboard from './pages/Dashboard';
import EvaluacionForm from './pages/EvaluacionForm';
import Trabajadores from './pages/Trabajadores';
import Bitacora from './pages/Bitacora';
import Usuarios from './pages/Usuarios';
import Accesos from './pages/Accesos';
import AuditoriaBajas from './pages/AuditoriaBajas';
import Secciones from './components/Secciones';

const Navbar = () => {
  const { usuario, logout } = useAuthStore();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [bajas, setBajas] = useState(false);
  useEffect(() => {
    let vigente = true;
    setBajas(false);
    if (usuario) apiClient.get('/bajas/sesion').then(({ data }) => vigente && setBajas(data.acceso)).catch(() => {});
    return () => { vigente = false; };
  }, [usuario, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setDropdownOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = event => { if (event.key === 'Escape') { setDropdownOpen(false); setMenuOpen(false); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  if (!usuario) return null;

  const isAdmin = usuario.rol === 'administrador';
  const isSupervisor = usuario.rol === 'supervisor';
  const canManageTrabajadores = isAdmin || isSupervisor;

  const navItems = [
    { to: '/', label: 'Inicio', icon: LayoutDashboard },
    { to: '/evaluar', label: 'Evaluar', icon: ClipboardList },
    ...(bajas ? [{ to: '/bajas', label: 'Bajas', icon: ClipboardList }] : []),
    { to: '/analytics', label: 'Analytics', icon: LayoutDashboard },
    ...(canManageTrabajadores ? [{ to: '/administracion', label: 'Administración', icon: Shield }, { to: '/auditoria', label: 'Auditoría', icon: History }] : []),
  ];

  return (
    <nav className="navbar" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="navbar-left">
        <img src="/LogoNexocorp.png" alt="Nexocorp" className="navbar-brand" />
        <button
          type="button"
          className="navbar-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menú de navegación"
          aria-expanded={menuOpen}
        >
          <Menu size={22} />
        </button>
      </div>
      <div className={`navbar-nav-panel ${menuOpen ? 'open' : ''}`}>
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={(location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to + '/'))) ? 'active' : ''}
            onClick={() => setMenuOpen(false)}
          >
            {item.icon && <item.icon size={16} style={{ marginRight: 'var(--space-1)' }} />}
            {item.label}
          </Link>
        ))}
      </div>
      <div className="navbar-user">
        <div className="dropdown" ref={dropdownRef}>
          <button
            type="button"
            className="dropdown-toggle"
            onClick={() => setDropdownOpen((o) => !o)}
          >
            <User size={18} />
            <span>{usuario.nombre}</span>
            <Shield size={14} style={{ color: 'hsl(var(--color-primary))' }} title={`Rol: ${usuario.rol}`} />
          </button>
          {dropdownOpen && (
            <div
              className="dropdown-menu"
              style={{ position: 'absolute', right: 0, top: '100%', marginTop: 'var(--space-2)' }}
            >
              <button onClick={() => { setDropdownOpen(false); logout(); }}>
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

const ProtectedRoute = ({ usuario, children }) => {
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
};

const RoleProtectedRoute = ({ usuario, children, allowedRoles }) => {
  if (!usuario) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return children;
};

const SessionMessage = () => {
  const location = useLocation();
  const { sesionExpirada, resetearSesionExpirada } = useAuthStore();

  useEffect(() => {
    if (location.pathname !== '/login' && sesionExpirada) {
      resetearSesionExpirada();
    }
  }, [location.pathname, sesionExpirada, resetearSesionExpirada]);

  if (!sesionExpirada || location.pathname !== '/login') return null;

  return (
    <div className="session-expired-banner">
      Tu sesión expiró o dejó de ser válida. Inicia sesión nuevamente.
    </div>
  );
};

const Toasts = () => {
  const toasts = useUiStore((state) => state.toasts);
  const quitarToast = useUiStore((state) => state.quitarToast);
  if (!toasts.length) return null;

  const estilosPorTipo = {
    success: { backgroundColor: 'hsla(var(--color-success), 0.18)', border: '1px solid hsla(var(--color-success), 0.42)', icono: CheckCircle2, titulo: 'Operación completada', iconColor: 'hsl(var(--color-success))' },
    error:   { backgroundColor: 'hsla(var(--color-danger), 0.16)',   border: '1px solid hsla(var(--color-danger), 0.4)',   icono: AlertCircle,     titulo: 'No se pudo completar',       iconColor: 'hsl(var(--color-danger))' },
    info:    { backgroundColor: 'hsla(var(--color-primary), 0.16)',  border: '1px solid hsla(var(--color-primary), 0.38)',  icono: Info,            titulo: 'Información',               iconColor: 'hsl(var(--color-primary))' },
  };

  return (
    <div className="toasts-container">
      {toasts.map((toast) => {
        const estilo = estilosPorTipo[toast.tipo] || estilosPorTipo.info;
        const Icono = estilo.icono;
        return (
          <div key={toast.id} className="toast" style={{ ...estilo }}>
            <div className="toast-content">
              <div className="toast-icon">
                <Icono size={18} style={{ color: estilo.iconColor }} />
              </div>
              <div className="toast-text">
                <span className="toast-title">{toast.titulo || estilo.titulo}</span>
                <span className="toast-message">{toast.mensaje}</span>
              </div>
            </div>
            <button onClick={() => quitarToast(toast.id)} className="toast-close" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

const AppRoutes = () => {
  const { usuario, verificarSesion, verificandoSesion } = useAuthStore();

  useEffect(() => {
    verificarSesion();
  }, [verificarSesion]);

  if (verificandoSesion) return <div className="loading-state">Cargando sistema...</div>;

  return (
    <>
      <Navbar />
      <SessionMessage />
      <Toasts />
      <main className="layout-container animate-fade-in">
        <Secciones />
        <Routes>
          <Route path="/login" element={!usuario ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/login/recuperar" element={!usuario ? <ForgotPin /> : <Navigate to="/" replace />} />
          <Route path="/reset-pin" element={!usuario ? <ResetPin /> : <Navigate to="/" replace />} />
          <Route path="/" element={<ProtectedRoute usuario={usuario}><Inicio /></ProtectedRoute>} />
          <Route path="/dashboard" element={<RutaAnterior to="/analytics/evaluaciones" />} />
          <Route path="/analytics" element={<ProtectedRoute usuario={usuario}><></></ProtectedRoute>} />
          <Route path="/analytics/evaluaciones" element={<ProtectedRoute usuario={usuario}><Dashboard /></ProtectedRoute>} />
          <Route path="/administracion" element={<RoleProtectedRoute usuario={usuario} allowedRoles={['administrador','supervisor']}><></></RoleProtectedRoute>} />
          <Route path="/administracion/areas" element={<RoleProtectedRoute usuario={usuario} allowedRoles={['administrador']}><Usuarios key="areas" seccion="areas" /></RoleProtectedRoute>} />
          <Route path="/administracion/accesos" element={<RoleProtectedRoute usuario={usuario} allowedRoles={['administrador']}><Accesos /></RoleProtectedRoute>} />
          <Route path="/evaluar" element={<ProtectedRoute usuario={usuario}><EvaluacionForm /></ProtectedRoute>} />
          {['/bajas', '/bajas/nueva', '/bajas/:id', '/bajas/:id/editar', '/analytics/bajas'].map(path => <Route key={path} path={path} element={<ProtectedRoute usuario={usuario}><Suspense fallback={<div className="loading-state">Cargando Bajas…</div>}><Bajas /></Suspense></ProtectedRoute>} />)}
          <Route path="/administracion/catalogos-bajas" element={
            <RoleProtectedRoute usuario={usuario} allowedRoles={['administrador', 'supervisor']}>
              <Suspense fallback={<div className="loading-state">Cargando catálogos…</div>}><CatalogosBajas /></Suspense>
            </RoleProtectedRoute>
          } />
          <Route path="/evaluar/:id/editar" element={
            <RoleProtectedRoute usuario={usuario} allowedRoles={['administrador', 'supervisor']}>
              <EvaluacionForm />
            </RoleProtectedRoute>
          } />
          <Route path="/trabajadores" element={<RutaAnterior to="/administracion/trabajadores" />} />
          <Route path="/administracion/trabajadores" element={
            <RoleProtectedRoute usuario={usuario} allowedRoles={['administrador', 'supervisor']}>
              <Trabajadores />
            </RoleProtectedRoute>
          } />
          <Route path="/bitacora" element={<RutaAnterior to="/auditoria/bph" />} />
          <Route path="/auditoria" element={<RoleProtectedRoute usuario={usuario} allowedRoles={['administrador','supervisor']}><></></RoleProtectedRoute>} />
          <Route path="/auditoria/bajas" element={<RoleProtectedRoute usuario={usuario} allowedRoles={['administrador','supervisor']}><AuditoriaBajas /></RoleProtectedRoute>} />
          <Route path="/auditoria/bph" element={
            <RoleProtectedRoute usuario={usuario} allowedRoles={['administrador', 'supervisor']}>
              <Bitacora />
            </RoleProtectedRoute>
          } />
          <Route path="/usuarios" element={<RutaAnterior to="/administracion/usuarios" />} />
          <Route path="/administracion/usuarios" element={
            <RoleProtectedRoute usuario={usuario} allowedRoles={['administrador']}>
              <Usuarios key="usuarios" />
            </RoleProtectedRoute>
          } />
          <Route path="*" element={<Navigate to={usuario ? '/' : '/login'} replace />} />
        </Routes>
      </main>
    </>
  );
};

function RutaAnterior({to}) { const location = useLocation(); return <Navigate to={to + location.search} replace />; }

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
