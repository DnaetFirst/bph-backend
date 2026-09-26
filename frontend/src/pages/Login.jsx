import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ErrorState from '../components/ui/ErrorState';

export default function Login() {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const { login, cargando, error } = useAuthStore();
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!nombre.trim() || !pin.trim()) {
      setLocalError('Por favor, ingresa tu usuario y PIN.');
      return;
    }

    try {
      await login(nombre, pin);
    } catch {
      // Error global manejado en store
    }
  };

  return (
    <div className="glass-panel auth-panel animate-fade-in">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <img src="/LogoNexocorp.png" alt="Nexocorp" style={{ height: '120px', width: 'auto' }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.55rem', marginBottom: 'var(--space-1)', color: 'hsl(var(--color-text-primary))' }}>Iniciar sesión</h2>
          <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.92rem' }}>
            Accede al sistema de control BPH con tu cuenta corporativa.
          </p>
        </div>
      </div>

      {(error || localError) && (
        <ErrorState error={error || localError} />
      )}

      <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }} onSubmit={handleSubmit}>
        <div>
          <label className="label">Usuario</label>
          <input
            className="input-field"
            type="text"
            placeholder="Ingresa tu usuario..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value.toUpperCase())}
            disabled={cargando}
            autoFocus
          />
        </div>
        <div>
          <label className="label">PIN</label>
          <input
            className="input-field"
            type="password"
            placeholder="Ingresa tu PIN..."
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={cargando}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: 'var(--space-1)' }}
          disabled={cargando}
          type="submit"
        >
          {cargando ? 'Comprobando...' : 'Ingresar'}
        </button>

        <Link
          to="/login/recuperar"
          className="btn btn-ghost btn-small"
          style={{ justifyContent: 'center', marginTop: '-0.25rem' }}
          disabled={cargando}
        >
          ¿Olvidaste tu PIN?
        </Link>
      </form>
    </div>
  );
}
