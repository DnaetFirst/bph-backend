import { Router } from '../utils/router.js';
import { AuthService, ErrorAuth } from '../services/authService.js';
import { authenticate } from '../middlewares/authenticate.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { loginSchema, cambiarPinSchema, validar } from '../validators/schemas.js';

const router = new Router();

router.post(
  '/login',
  rateLimit({ kvBinding: 'RATE_LIMIT', limite: 5, ventanaSegundos: 300 }),
  validar(loginSchema),
  async (req, res) => {
    const authService = new AuthService(req.prisma, req.env);

    try {
      const { token, usuario } = await authService.login(req.body.nombre, req.body.pin);

      const isSecureContext = req.secure || req.headers['x-forwarded-proto'] === 'https';

      res.cookie('token', token, {
        httpOnly: true,
        secure: isSecureContext,
        sameSite: 'none',
        maxAge: parseInt(req.env.JWT_EXPIRATION_SECONDS || '28800', 10) * 1000,
      });

      // Devolver token en la respuesta como fallback para problemas de cookies entre subdominios
      res.json({ usuario, token });
    } catch (err) {
      if (err instanceof ErrorAuth) {
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }
  }
);

router.get('/me', authenticate, async (req, res) => {
  res.json({ usuario: req.usuario });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.post('/cambiar-pin', authenticate, validar(cambiarPinSchema), async (req, res) => {
  const authService = new AuthService(req.prisma, req.env);
  try {
    await authService.cambiarPin(req.usuario.id, req.body.pinActual, req.body.pinNuevo);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof ErrorAuth) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
});

export default router;
