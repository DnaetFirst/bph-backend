export default function ProgressRow({ label, value, color = 'linear-gradient(90deg, hsla(221, 83%, 53%, 0.75), hsla(217, 91%, 60%, 0.95))' }) {
  const safeValue = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--color-text-primary))' }}>{safeValue}%</span>
      </div>
      <div style={{ height: 10, background: 'hsla(var(--color-secondary), 0.12)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${safeValue}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}
