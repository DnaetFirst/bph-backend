import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { derivarPin } from '../utils/crypto.js';
import { ReporteService } from '../services/reporteService.js';
import {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  areaSchema,
  validar,
} from '../utils/schemas.js';

const router = Router();

router.use(authenticate);
router.use(authorize('administrador', 'supervisor'));

// --- USUARIOS ---

router.get('/usuarios', async (req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nombre: true, rol: true, activo: true, creadoEn: true, bloqueadoHasta: true },
    });
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
});

router.post('/usuarios', validar(crearUsuarioSchema), async (req, res, next) => {
  try {
    const { nombre, rol } = req.body;
    const existente = await prisma.usuario.findUnique({ where: { nombre } });

    if (existente) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }

    const pinPorDefecto = '000000';
    const hashPin = await derivarPin(pinPorDefecto);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        rol,
        hashPin,
        requiereCambioPin: true,
      },
      select: { id: true, nombre: true, rol: true, activo: true },
    });

    res.status(201).json(usuario);
  } catch (error) {
    next(error);
  }
});

router.put('/usuarios/:id', validar(actualizarUsuarioSchema), async (req, res, next) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.update({
      where: { id: Number(id) },
      data: req.body,
      select: { id: true, nombre: true, rol: true, activo: true },
    });

    res.json(usuario);
  } catch (error) {
    next(error);
  }
});

router.put('/usuarios/:id/reset-pin', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pinPorDefecto = '000000';
    const hashPin = await derivarPin(pinPorDefecto);

    await prisma.usuario.update({
      where: { id: Number(id) },
      data: {
        hashPin,
        requiereCambioPin: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });

    res.json({ ok: true, mensaje: 'PIN restablecido a 000000' });
  } catch (error) {
    next(error);
  }
});

// --- ÁREAS ---

router.get('/areas', async (req, res, next) => {
  try {
    const areas = await prisma.area.findMany({ orderBy: { nombre: 'asc' } });
    res.json(areas);
  } catch (error) {
    next(error);
  }
});

router.post('/areas', validar(areaSchema), async (req, res, next) => {
  try {
    const existente = await prisma.area.findUnique({ where: { nombre: req.body.nombre } });
    if (existente) {
      return res.status(400).json({ error: 'El área ya existe' });
    }
    const area = await prisma.area.create({ data: req.body });
    res.status(201).json(area);
  } catch (error) {
    next(error);
  }
});

router.put('/areas/:id', validar(areaSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const area = await prisma.area.update({
      where: { id: Number(id) },
      data: req.body,
    });
    res.json(area);
  } catch (error) {
    next(error);
  }
});

// --- REPORTES ---

router.get('/reporte/csv', async (req, res, next) => {
  try {
    const reporteService = new ReporteService(prisma);
    const csv = await reporteService.exportarHistorialCSV({
      areaId: req.query.areaId ? Number(req.query.areaId) : undefined,
      estado: req.query.estado || undefined,
      trabajador: req.query.trabajador || undefined,
    });

    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="reporte-bph-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.end(csv);
  } catch (error) {
    console.error('Error generando reporte CSV:', error);
    next(error);
  }
});

// --- BITÁCORA ---

router.get('/bitacora', async (req, res, next) => {
  try {
    const pagina = Math.max(1, Number(req.query.pagina) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(req.query.porPagina) || 20));
    const search = req.query.q?.trim() || '';

    const where = {};
    if (search) {
      where.OR = [
        { accion: { contains: search, mode: 'insensitive' } },
        { usuario: { nombre: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [eventos, total] = await Promise.all([
      prisma.bitacora.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: {
          usuario: {
            select: { nombre: true, rol: true },
          },
        },
      }),
      prisma.bitacora.count({ where }),
    ]);

    const eventosFormateados = eventos.map((e) => ({
      id: e.id,
      accion: e.accion,
      usuario: e.usuario?.nombre || '—',
      rol: e.usuario?.rol || '—',
      ip: e.ip || '—',
      detalles: e.detalles || '',
      fecha: e.creadoEn,
    }));

    res.set('Cache-Control', 'no-store');
    res.json({ eventos: eventosFormateados, total, pagina, porPagina });
  } catch (error) {
    next(error);
  }
});

export default router;
