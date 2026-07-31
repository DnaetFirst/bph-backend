import crypto from 'node:crypto';
import { verificarPin, derivarPin } from '../utils/crypto.js';

export class ErrorAuth extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

export class AuthService {
  constructor(prisma, config) {
    this.prisma = prisma;
    this.config = config;
  }

  base64UrlEncode(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  base64UrlDecode(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + padding, 'base64').toString('utf8');
  }

  async crearToken(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + this.config.jwtExpirationSeconds,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    return `${data}.${signature}`;
  }

  async verificarToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new ErrorAuth('Sesión inválida o expirada', 401);
    }

    const [encodedHeader, encodedPayload, receivedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    if (receivedSignature !== expectedSignature) {
      throw new ErrorAuth('Sesión inválida o expirada', 401);
    }

    let payload;
    try {
      payload = JSON.parse(this.base64UrlDecode(encodedPayload));
    } catch {
      throw new ErrorAuth('Sesión inválida o expirada', 401);
    }

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      throw new ErrorAuth('Sesión inválida o expirada', 401);
    }

    return payload;
  }

  async login(nombre, pin) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { nombre },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        hashPin: true,
        requiereCambioPin: true,
        intentosFallidos: true,
        bloqueadoHasta: true,
      },
    });

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
      if (intentos >= this.config.loginMaxIntentos) {
        data.bloqueadoHasta = new Date(Date.now() + this.config.loginBloqueoSegundos * 1000);
        data.intentosFallidos = 0;
      }

      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data,
      });

      throw new ErrorAuth('PIN incorrecto', 401);
    }

    if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: 0, bloqueadoHasta: null },
      });
    }

    const token = await this.crearToken({
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
    });

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
