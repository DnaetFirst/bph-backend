import { Loader2 } from 'lucide-react';

export default function LoadingState({ mensaje = 'Cargando...' }) {
  return (
    <div className="loading-state">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <Loader2 size={32} style={{ color: 'hsl(var(--color-primary))', animation: 'spin 1s linear infinite' }} />
      </div>
      <p style={{ color: 'hsl(var(--color-text-secondary))' }}>{mensaje}</p>
    </div>
  );
}
