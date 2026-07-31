import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { AuthService } from '../services/authService.js';

export async function authenticate(req, res, next) {
  let token = req.cookies?.token;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const authService = new AuthService(prisma, config);
    const payload = await authService.verificarToken(token);
    req.usuario = payload;
    next();
  } catch (error) {
    res.status(error.status || 401).json({ error: error.message || 'No autenticado' });
  }
}
