import { z } from 'zod';

export const loginSchema = z.object({
  nombre: z.string().min(2).max(100),
  pin: z.string().min(6).max(20),
});

export const cambiarPinSchema = z.object({
  pinActual: z.string().min(6).max(20),
  pinNuevo: z.string().min(6).max(20),
});

export const forgotPinSchema = z.object({
  email: z.string().email(),
});

export const resetPinSchema = z.object({
  token: z.string().min(1),
  pinNuevo: z.string().min(6).max(20),
});

export const resetearPinAdminSchema = z.object({
  pinNuevo: z.string().min(6).max(20).optional(),
});

export const detalleSchema = z.object({
  parametroId: z.number().int().positive(),
  resultado: z.enum(['Cumple', 'No cumple', 'No aplica']),
});

export const crearEvaluacionSchema = z.object({
  fecha: z.coerce.date(),
  trabajadorId: z.number().int().positive(),
  areaId: z.number().int().positive(),
  evaluadorId: z.number().int().positive(),
  colorEsperado: z.string().optional(),
  colorObservado: z.string().optional(),
  cumplimientoColor: z.string().optional(),
  observaciones: z.string().max(500).optional(),
  detalles: z.array(detalleSchema).min(1),
});

export const anularEvaluacionSchema = z.object({
  motivo: z.string().min(3).max(300),
});

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(2).max(100),
  email: z.string().email(),
  rol: z.enum(['evaluador', 'supervisor', 'administrador']),
  pin: z.string().min(6).optional(),
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  rol: z.enum(['evaluador', 'supervisor', 'administrador']).optional(),
  activo: z.boolean().optional(),
});

export const areaSchema = z.object({
  nombre: z.string().min(2).max(100),
});

/** Middleware genérico: valida req.body contra un schema de Zod. */
export function validar(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body);
    if (!resultado.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: resultado.error.flatten() });
    }
    req.body = resultado.data;
    next();
  };
}
