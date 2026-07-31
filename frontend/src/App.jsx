import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Info, X, User, LogOut, Shield } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { useUiStore } from './store/uiStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EvaluacionForm from './pages/EvaluacionForm';
import Trabajadores from './pages/Trabajadores';

const Navbar = () => {
  const { usuario, logout } = useAuthStore();
  const location = useLocation();

  if (!usuario) return null;

  const navItems = [
    { to: '/', label: 'Dashboard', icon: null },
    { to: '/evaluar', label: 'Evaluar', icon: null },
    { to: '/trabajadores', label: 'Trabajadores', icon: null },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <img src="/nexocorp-logo.svg" alt="Nexocorp" className="navbar-brand" />
      </div>
      <div className="navbar-nav">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={location.pathname === item.to ? 'active' : ''}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="navbar-user">
        <div className="dropdown">
          <button type="button" className="dropdown-toggle">
            <User size={18} />
            <span>{usuario.nombre}</span>
            <Shield size={14} style={{ color: 'hsl(var(--color-primary))' }} title={`Rol: ${usuario.rol}`} />
          </button>
          <div className="dropdown-menu">
            <button onClick={() => logout()}>
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const ProtectedRoute = ({ usuario, children }) => {
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
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
    success: {
      backgroundColor: 'hsla(var(--color-success), 0.18)',
      border: '1px solid hsla(var(--color-success), 0.42)',
      icono: CheckCircle2,
      titulo: 'Operación completada',
      iconColor: 'hsl(var(--color-success))',
    },
    error: {
      backgroundColor: 'hsla(var(--color-danger), 0.16)',
      border: '1px solid hsla(var(--color-danger), 0.4)',
      icono: AlertCircle,
      titulo: 'No se pudo completar',
      iconColor: 'hsl(var(--color-danger))',
    },
    info: {
      backgroundColor: 'hsla(var(--color-primary), 0.16)',
      border: '1px solid hsla(var(--color-primary), 0.38)',
      icono: Info,
      titulo: 'Información',
      iconColor: 'hsl(var(--color-primary))',
    },
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
            <button onClick={() => quitarToast(toast.id)} className="toast-close" aria-label="Cerrar notificación">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

const AppRoutes = () => {
  const { usuario, verificarSesion, cargando } = useAuthStore();

  useEffect(() => {
    verificarSesion();
  }, [verificarSesion]);

  if (cargando) {
    return <div className="loading-state">Cargando sistema...</div>;
  }

  return (
    <>
      <Navbar />
      <SessionMessage />
      <Toasts />
      <main className="layout-container animate-fade-in">
        <Routes>
          <Route path="/login" element={!usuario ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/" element={<ProtectedRoute usuario={usuario}><Dashboard /></ProtectedRoute>} />
          <Route path="/evaluar" element={<ProtectedRoute usuario={usuario}><EvaluacionForm /></ProtectedRoute>} />
          <Route path="/trabajadores" element={<ProtectedRoute usuario={usuario}><Trabajadores /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to={usuario ? '/' : '/login'} replace />} />
        </Routes>
      </main>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
