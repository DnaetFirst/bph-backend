// ============================================================================
// authorize — exige que req.usuario.rol esté entre los roles permitidos.
// Usar SIEMPRE después de authenticate().
// ============================================================================

export function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tenés permiso para esta acción' });
    }
    next();
  };
}
