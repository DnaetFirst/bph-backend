import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

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
      // El componente se desmontará automáticamente cuando cambie 'usuario' en App.jsx 
    } catch {
      // El error global ya se guarda en useAuthStore, así que se mostrará arriba
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', margin: '12vh auto', padding: '2.25rem' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: '1rem', marginBottom: '1.6rem' }}>
        <img src="/nexocorp-logo.svg" alt="Nexocorp" style={{ height: '52px', width: 'auto' }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.55rem', marginBottom: '0.35rem', color: 'hsl(var(--color-text-primary))' }}>Iniciar sesión</h2>
          <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.92rem' }}>
            Accede al sistema de control BPH con tu cuenta corporativa.
          </p>
        </div>
      </div>
      
      {(error || localError) && (
        <div className="animate-fade-in" style={{ 
          backgroundColor: 'hsla(var(--color-danger), 0.1)', 
          border: '1px solid hsla(var(--color-danger), 0.3)',
          color: 'hsl(var(--color-danger))', 
          padding: '0.75rem', 
          borderRadius: 'var(--radius-md)', 
          marginBottom: '1.25rem', 
          fontSize: '0.875rem' 
        }}>
          {error || localError}
        </div>
      )}

      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleSubmit}>
        <div>
          <input 
            className="input-field" 
            type="text" 
            placeholder="Usuario (ej. EVA MORALES)" 
            value={nombre}
            onChange={(e) => setNombre(e.target.value.toUpperCase())}
            disabled={cargando}
            autoFocus
          />
        </div>
        <div>
          <input 
            className="input-field" 
            type="password" 
            placeholder="PIN" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={cargando}
          />
        </div>
        
        <button 
          className="btn btn-primary" 
          style={{ marginTop: '0.5rem', padding: '0.75rem', fontSize: '1rem' }} 
          disabled={cargando}
          type="submit"
        >
          {cargando ? 'Comprobando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
