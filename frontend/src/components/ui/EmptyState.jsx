import { FileText, Plus } from 'lucide-react';

export default function EmptyState({ titulo = 'No hay datos', mensaje = 'Aún no se han registrado registros.', icon: Icon = FileText, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <Icon size={40} style={{ color: 'hsl(var(--color-text-secondary))', opacity: 0.4 }} />
      </div>
      {titulo && <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', color: 'hsl(var(--color-text-primary))' }}>{titulo}</h3>}
      {mensaje && <p style={{ fontSize: '0.85rem', marginBottom: actionLabel ? '1.25rem' : 0 }}>{mensaje}</p>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          <Plus size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
