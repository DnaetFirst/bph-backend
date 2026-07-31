import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function ErrorState({ error = 'Ocurrió un error inesperado', onRetry }) {
  const mensaje = typeof error === 'string'
    ? error
    : error?.message || 'Ocurrió un error inesperado';

  return (
    <div className="error-state">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <AlertTriangle size={40} style={{ color: 'hsl(var(--color-danger))' }} />
      </div>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', color: 'hsl(var(--color-danger))' }}>
        No se pudo cargar la información
      </h3>
      {mensaje && <p style={{ fontSize: '0.85rem', marginBottom: onRetry ? '1.25rem' : 0, color: 'hsl(var(--color-text-secondary))' }}>{mensaje}</p>}
      {onRetry && (
        <button className="btn btn-outline" onClick={onRetry}>
          <RefreshCw size={16} />
          Reintentar
        </button>
      )}
    </div>
  );
}
