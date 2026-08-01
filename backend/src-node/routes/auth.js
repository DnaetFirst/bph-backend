import { Router } from 'express';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { AuthService, ErrorAuth } from '../services/authService.js';
import { authenticate } from '../middlewares/authenticate.js';
import { loginSchema, cambiarPinSchema, forgotPinSchema, resetPinSchema } from '../utils/schemas.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { enviarEmailResetPin } from '../utils/emailService.js';

const router = Router();

const RESET_URL = (token) => {
  const base = config.frontendUrl.split(',')[0].trim();
  return `${base}/reset-pin?token=${token}`;
};

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

router.post('/forgot-pin', async (req, res, next) => {
  try {
    const parsed = forgotPinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const { email } = parsed.data;
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, nombre: true, rol: true, activo: true },
    });

    await registrarBitacora({
      accion: 'Solicitud de recuperación de PIN',
      usuarioId: usuario?.id || 0,
      ip: req.ip,
      detalles: `Email: ${email}, Usuario encontrado: ${!!usuario}`,
    });

    if (!usuario || !usuario.activo) {
      return res.json({ ok: true, mensaje: 'Si el email está registrado, recibirás un enlace de recuperación.' });
    }

    if (usuario.rol === 'administrador') {
      return res.json({ ok: true, mensaje: 'Si el email está registrado, recibirás un enlace de recuperación.' });
    }

    try {
      const authService = new AuthService(prisma, config);
      const token = await authService.crearTokenResetPin(usuario);
      const resetUrl = RESET_URL(token);

      await enviarEmailResetPin(email, usuario.nombre, resetUrl);
    } catch (emailError) {
      console.error('[auth] Error enviando email de recuperación:', emailError.message);
      return res.status(503).json({ error: 'No se pudo enviar el email de recuperación. Contacta al administrador.' });
    }

    res.json({ ok: true, mensaje: 'Si el email está registrado, recibirás un enlace de recuperación.' });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-pin', async (req, res, next) => {
  try {
    const parsed = resetPinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const { token, pinNuevo } = parsed.data;
    const authService = new AuthService(prisma, config);

    const usuario = await authService.restablecerPinConToken(token, pinNuevo);

    await registrarBitacora({
      accion: 'Restablecimiento de PIN completado',
      usuarioId: usuario.id,
      ip: req.ip,
      detalles: 'PIN restablecido vía email con token válido',
    });

    res.json({ ok: true, mensaje: 'PIN restablecido correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    if (error instanceof ErrorAuth) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
