import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { useUiStore } from './store/uiStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EvaluacionForm from './pages/EvaluacionForm';
import Trabajadores from './pages/Trabajadores';

const Navbar = () => {
  const { usuario, logout } = useAuthStore();
  
  if (!usuario) return null;
  
  return (
    <nav style={{ padding: '1rem 2rem', background: 'hsla(var(--color-surface), 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid hsla(var(--color-secondary), 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h2 style={{ fontSize: '1.2rem', color: 'hsl(var(--color-primary))' }}>Control BPH</h2>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'hsl(var(--color-text))' }}>Dashboard</Link>
        <Link to="/evaluar" style={{ textDecoration: 'none', color: 'hsl(var(--color-text))' }}>Evaluar</Link>
        <Link to="/trabajadores" style={{ textDecoration: 'none', color: 'hsl(var(--color-text))' }}>Trabajadores</Link>
        <span>👤 {usuario.nombre}</span>
        <button className="btn btn-outline" onClick={logout}>Salir</button>
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
    <div style={{ maxWidth: '420px', margin: '1rem auto 0', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'hsla(var(--color-warning), 0.12)', color: 'hsl(var(--color-text-primary))', border: '1px solid hsla(var(--color-warning), 0.3)' }}>
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
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', display: 'grid', gap: '0.75rem', zIndex: 9999, width: 'min(380px, calc(100vw - 2rem))' }}>
      {toasts.map((toast) => {
        const estilo = estilosPorTipo[toast.tipo] || estilosPorTipo.info;
        const Icono = estilo.icono;

        return (
          <div key={toast.id} style={{ padding: '1rem 1rem 0.95rem', borderRadius: 'var(--radius-lg)', color: 'hsl(var(--color-text-primary))', boxShadow: '0 14px 30px rgba(0, 0, 0, 0.28)', backdropFilter: 'blur(12px)', ...estilo }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.9rem', alignItems: 'start' }}>
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'start', flex: 1 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', backgroundColor: 'hsla(0, 0%, 100%, 0.08)', flexShrink: 0 }}>
                  <Icono size={18} style={{ color: estilo.iconColor }} />
                </div>
                <div style={{ display: 'grid', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.94rem', fontWeight: 700, letterSpacing: '0.01em' }}>{toast.titulo || estilo.titulo}</span>
                  <span style={{ fontSize: '0.9rem', lineHeight: 1.45, color: 'hsl(var(--color-text-primary))' }}>{toast.mensaje}</span>
                </div>
              </div>
              <button onClick={() => quitarToast(toast.id)} style={{ background: 'transparent', border: 'none', color: 'hsl(var(--color-text-secondary))', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0.1 }} aria-label="Cerrar notificación">
                <X size={16} />
              </button>
            </div>
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
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20vh' }}>Cargando sistema...</div>;
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
