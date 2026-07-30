import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
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
        <a href="/" style={{ textDecoration: 'none', color: 'hsl(var(--color-text))' }}>Dashboard</a>
        <a href="/evaluar" style={{ textDecoration: 'none', color: 'hsl(var(--color-text))' }}>Evaluar</a>
        <a href="/trabajadores" style={{ textDecoration: 'none', color: 'hsl(var(--color-text))' }}>Trabajadores</a>
        <span>👤 {usuario.nombre}</span>
        <button className="btn btn-outline" onClick={logout}>Salir</button>
      </div>
    </nav>
  );
};

function App() {
  const { usuario, verificarSesion, cargando } = useAuthStore();

  useEffect(() => {
    verificarSesion();
  }, [verificarSesion]);

  if (cargando) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20vh' }}>Cargando sistema...</div>;
  }

  return (
    <BrowserRouter>
      <Navbar />
      <main className="layout-container animate-fade-in">
        <Routes>
          <Route 
            path="/login" 
            element={!usuario ? <Login /> : <Navigate to="/" />} 
          />
          <Route 
            path="/" 
            element={usuario ? <Dashboard /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/evaluar" 
            element={usuario ? <EvaluacionForm /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/trabajadores" 
            element={usuario ? <Trabajadores /> : <Navigate to="/login" />} 
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
