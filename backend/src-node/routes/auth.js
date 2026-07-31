import { Router } from 'express';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { AuthService, ErrorAuth } from '../services/authService.js';
import { authenticate } from '../middlewares/authenticate.js';
import { loginSchema, cambiarPinSchema } from '../utils/schemas.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const authService = new AuthService(prisma, config);
    const resultado = await authService.login(parsed.data.nombre, parsed.data.pin);
    res.json(resultado);
  } catch (error) {
    if (error instanceof ErrorAuth) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ usuario: req.usuario });
});

router.post('/logout', async (req, res) => {
  res.json({ ok: true });
});

router.post('/cambiar-pin', authenticate, async (req, res, next) => {
  try {
    const parsed = cambiarPinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const authService = new AuthService(prisma, config);
    await authService.cambiarPin(req.usuario.id, parsed.data.pinActual, parsed.data.pinNuevo);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof ErrorAuth) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
