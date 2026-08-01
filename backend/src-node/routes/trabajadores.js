import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate } from '../middlewares/authenticate.js';
import { TrabajadorService } from '../services/trabajadorService.js';
import { registrarBitacora } from '../utils/bitacora.js';

const router = Router();
const service = new TrabajadorService(prisma);

const crearTrabajadorSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  areaId: z.number().int().positive(),
});

const actualizarTrabajadorSchema = z.object({
  nombre: z.string().trim().min(2).max(100).optional(),
  areaId: z.number().int().positive().optional(),
  activo: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const soloActivos = req.query.activos !== 'false';
    const trabajadores = await service.obtenerTodos(soloActivos);
    res.set('Cache-Control', 'no-store');
    res.json({ trabajadores });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const trabajador = await service.obtenerPorId(id);
    if (!trabajador) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ trabajador });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = crearTrabajadorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const trabajador = await service.crear(parsed.data);
    await registrarBitacora({
      accion: 'Crear trabajador',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `Trabajador: ${trabajador.nombre}, Área ID: ${trabajador.areaId}`,
    });
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ trabajador });
  } catch (error) {
    if (error.message.includes('ya existe')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('no existe')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const parsed = actualizarTrabajadorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const trabajador = await service.actualizar(id, parsed.data);
    await registrarBitacora({
      accion: 'Editar trabajador',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `ID: ${trabajador.id}, Nombre: ${trabajador.nombre}`,
    });
    res.set('Cache-Control', 'no-store');
    res.json({ trabajador });
  } catch (error) {
    if (error.message.includes('no existe')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('ya existe')) {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

router.patch('/:id/activar', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const trabajador = await service.activar(id);
    await registrarBitacora({
      accion: 'Activar trabajador',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `ID: ${trabajador.id}, Nombre: ${trabajador.nombre}`,
    });
    res.set('Cache-Control', 'no-store');
    res.json({ trabajador });
  } catch (error) {
    if (error.message.includes('no existe')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.patch('/:id/desactivar', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const trabajador = await service.desactivar(id);
    await registrarBitacora({
      accion: 'Desactivar trabajador',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `ID: ${trabajador.id}, Nombre: ${trabajador.nombre}`,
    });
    res.set('Cache-Control', 'no-store');
    res.json({ trabajador });
  } catch (error) {
    if (error.message.includes('no existe')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    await service.eliminar(id);
    await registrarBitacora({
      accion: 'Eliminar trabajador',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `ID: ${id}`,
    });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true });
  } catch (error) {
    if (error.message.includes('no existe')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('evaluaciones relacionadas') || error.message.includes('desactivado')) {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
