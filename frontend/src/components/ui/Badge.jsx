export default function Badge({ variant = 'neutral', icon: Icon, children, className = '' }) {
  const classes = `badge badge-${variant} ${className}`.trim();

  return (
    <span className={classes}>
      {Icon && <Icon size={13} />}
      {children}
    </span>
  );
}
