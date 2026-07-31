import { useState } from 'react';
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
      // El error global ya se guarda en useAuthStore
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', margin: '12vh auto', padding: '2.25rem' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: '1rem', marginBottom: '1.6rem' }}>
        <img src="/LogoNexocorp.png" alt="Nexocorp" style={{ height: '52px', width: 'auto' }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.55rem', marginBottom: '0.35rem', color: 'hsl(var(--color-text-primary))' }}>Iniciar sesión</h2>
          <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.92rem' }}>
            Accede al sistema de control BPH con tu cuenta corporativa.
          </p>
        </div>
      </div>

      {(error || localError) && (
        <ErrorState error={error || localError} />
      )}

      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleSubmit}>
        <div>
          <label className="label">Usuario</label>
          <input
            className="input-field"
            type="text"
            placeholder="Ej. EVA MORALES"
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
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={cargando}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: '0.25rem' }}
          disabled={cargando}
          type="submit"
        >
          {cargando ? 'Comprobando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
