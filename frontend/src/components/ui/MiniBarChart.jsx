export default function MiniBarChart({ data = [], percentage = false, color = 'hsl(var(--color-primary))' }) {
  const max = percentage ? 100 : Math.max(...data.map((item) => item.value), 1);

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {data.map((item) => (
        <div key={item.id ?? item.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(70px, 110px) minmax(0, 1fr) 46px', gap: 'var(--space-3)', alignItems: 'center' }}>
          <div title={item.label} style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </div>
          <div style={{ height: 10, background: 'hsla(var(--color-secondary), 0.12)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(0, Math.min(100, (item.value / max) * 100))}%`, height: '100%', background: color, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, textAlign: 'right' }}>{item.value}{percentage ? '%' : ''}</div>
        </div>
      ))}
    </div>
  );
}
