import { Router } from 'express';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { AuthService, ErrorAuth } from '../services/authService.js';
import { authenticate } from '../middlewares/authenticate.js';
import { derivarPin } from '../utils/crypto.js';
import { loginSchema, cambiarPinSchema, recuperarPinSchema } from '../utils/schemas.js';
import { registrarBitacora } from '../utils/bitacora.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const authService = new AuthService(prisma, config);
    const resultado = await authService.login(parsed.data.nombre, parsed.data.pin);

    await registrarBitacora({
      accion: 'Login exitoso',
      usuarioId: resultado.usuario.id,
      ip: req.ip,
      detalles: `Usuario: ${resultado.usuario.nombre}, Rol: ${resultado.usuario.rol}`,
    });

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

router.post('/recuperar-pin', async (req, res, next) => {
  try {
    const parsed = recuperarPinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const { nombre, pinNuevo } = parsed.data;
    const usuario = await prisma.usuario.findUnique({
      where: { nombre },
      select: { id: true, nombre: true, rol: true, activo: true },
    });

    if (!usuario || !usuario.activo) {
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });
    }

    if (usuario.rol === 'administrador') {
      return res.status(403).json({ error: 'Los administradores deben contactar a otro administrador para restablecer el PIN' });
    }

    const hashPin = await derivarPin(pinNuevo);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        hashPin,
        requiereCambioPin: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });

    await registrarBitacora({
      accion: 'Recuperación de PIN',
      usuarioId: usuario.id,
      ip: req.ip,
      detalles: `PIN restablecido por recuperación auto-servicio`,
    });

    res.json({ ok: true, mensaje: 'PIN restablecido. Inicia sesión con el nuevo PIN.' });
  } catch (error) {
    next(error);
  }
});

export default router;
