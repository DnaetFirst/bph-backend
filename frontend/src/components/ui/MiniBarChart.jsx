export default function MiniBarChart({ data = [], color = 'hsl(var(--color-primary))' }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {data.map((item) => (
        <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 46px', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </div>
          <div style={{ height: 10, background: 'hsla(var(--color-secondary), 0.12)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(item.value / max) * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, textAlign: 'right' }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
