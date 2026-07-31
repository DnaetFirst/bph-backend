export default function ProgressRing({ porcentaje, color = 'primary' }) {
  const radius = 40;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * Math.min(100, Math.max(0, porcentaje))) / 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <svg width="90" height="90" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="45" cy="45" r={radius}
          fill="none"
          stroke="hsla(var(--color-table-border), 0.3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="45" cy="45" r={radius}
          fill="none"
          stroke={`hsl(var(--color-${color}))`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--color-text-primary))' }}>{porcentaje}%</span>
    </div>
  );
}
