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
    } catch (err) {
      // El error global ya se guarda en useAuthStore, así que se mostrará arriba
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '400px', margin: '15vh auto', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Iniciar Sesión</h2>
      <p style={{ color: 'hsl(var(--color-text-secondary))', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Ingresa tus credenciales para continuar
      </p>
      
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
