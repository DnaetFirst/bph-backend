// ============================================================================
// authenticate — verifica el JWT de la cookie y adjunta req.usuario.
// Se instancia el AuthService acá mismo (necesita req.env para el
// JWT_SECRET) — no depende de que la ruta ya haya creado uno.
// ============================================================================

import { AuthService } from '../services/authService.js';

export async function authenticate(req, res, next) {
  // Primero intentar obtener token de cookie
  let token = req.cookies?.token;
  
  // Si no hay cookie, intentar obtener del header Authorization (fallback para localStorage)
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const authService = new AuthService(req.prisma, req.env);
    const payload = await authService.verificarToken(token);
    req.usuario = payload; // { id, nombre, rol, iat, exp }
    next();
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
}
