export default function KpiCard({ icon: Icon, titulo, valor, subtitulo, color = 'hsl(var(--color-primary))', className = '' }) {
  return (
    <div className={`section-card ${className}`} style={{ padding: '1.25rem', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))', fontWeight: 600 }}>{titulo}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'hsla(var(--color-primary), 0.12)', color }}>
          <Icon size={18} />
        </div>
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, lineHeight: 1.1, color: 'hsl(var(--color-text-primary))' }}>{valor}</div>
      {subtitulo && <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))', marginTop: '0.25rem' }}>{subtitulo}</div>}
    </div>
  );
}
