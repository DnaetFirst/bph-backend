// ============================================================================
// authService — bcryptjs (PIN) + jose (JWT, hecho para runtimes de edge).
// ============================================================================

import { verificarPin, derivarPin } from '../utils/crypto.js';
import { SignJWT, jwtVerify } from 'jose';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 5;

export class AuthService {
  constructor(prisma, env) {
    this.prisma = prisma;
    this.env = env;
    const rawSecret = env.JWT_SECRET && env.JWT_SECRET.trim() ? env.JWT_SECRET : 'dev-fallback-secret-change-me';
    this.secreto = new TextEncoder().encode(rawSecret);
  }

  async login(nombre, pin) {
    const usuario = await this.prisma.usuario.findUnique({ where: { nombre } });

    if (!usuario || !usuario.activo) {
      throw new ErrorAuth('Usuario no encontrado o inactivo', 401);
    }

    if (usuario.bloqueadoHasta && new Date() < usuario.bloqueadoHasta) {
      throw new ErrorAuth('Cuenta bloqueada temporalmente. Intentá de nuevo más tarde.', 423);
    }

    const valido = await verificarPin(pin, usuario.hashPin);

    if (!valido) {
      const intentos = usuario.intentosFallidos + 1;
      const data = { intentosFallidos: intentos };
      if (intentos >= MAX_INTENTOS) {
        data.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000);
        data.intentosFallidos = 0;
      }
      await this.prisma.usuario.update({ where: { id: usuario.id }, data });
      throw new ErrorAuth('PIN incorrecto', 401);
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });

    const expSeg = parseInt(this.env.JWT_EXPIRATION_SECONDS || '28800', 10);
    const token = await new SignJWT({
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${expSeg}s`)
      .sign(this.secreto);

    return {
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        requiereCambioPin: usuario.requiereCambioPin,
      },
    };
  }

  async verificarToken(token) {
    try {
      const { payload } = await jwtVerify(token, this.secreto);
      return payload;
    } catch {
      throw new ErrorAuth('Sesión inválida o expirada', 401);
    }
  }

  async cambiarPin(usuarioId, pinActual, pinNuevo) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new ErrorAuth('Usuario no encontrado', 404);

    const valido = await verificarPin(pinActual, usuario.hashPin);
    if (!valido) throw new ErrorAuth('El PIN actual no coincide', 401);

    const hashNuevo = await derivarPin(pinNuevo);
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { hashPin: hashNuevo, requiereCambioPin: false },
    });
  }
}

export class ErrorAuth extends Error {
  constructor(mensaje, status = 401) {
    super(mensaje);
    this.status = status;
  }
}
