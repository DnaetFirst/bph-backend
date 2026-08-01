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
  resetearPinAdminSchema,
  validar,
} from '../utils/schemas.js';
import { registrarBitacora } from '../utils/bitacora.js';

const router = Router();

router.use(authenticate);
router.use(authorize('administrador', 'supervisor'));

// --- USUARIOS ---

router.get('/usuarios', async (req, res, next) => {
  try {
       const usuarios = await prisma.usuario.findMany({
         select: { id: true, nombre: true, email: true, rol: true, activo: true, creadoEn: true, bloqueadoHasta: true },
       });
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
});

router.post('/usuarios', validar(crearUsuarioSchema), async (req, res, next) => {
  try {
    const { nombre, email, rol } = req.body;
    const existente = await prisma.usuario.findUnique({ where: { nombre } });

    if (existente) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }

    const existenteEmail = await prisma.usuario.findUnique({ where: { email } });

    if (existenteEmail) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const pinPorDefecto = '000000';
    const hashPin = await derivarPin(pinPorDefecto);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        rol,
        hashPin,
        requiereCambioPin: true,
      },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });

    await registrarBitacora({
      accion: 'Creación de usuario',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `Usuario creado: ${nombre} (${rol}), email: ${email}`,
    });

    res.status(201).json(usuario);
  } catch (error) {
    next(error);
  }
});

router.put('/usuarios/:id', validar(actualizarUsuarioSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, activo } = req.body;

    const usuarioAntes = await prisma.usuario.findUnique({
      where: { id: Number(id) },
      select: { nombre: true, email: true, rol: true, activo: true },
    });

    let bitacoraDetalles = '';

    if (nombre && nombre !== usuarioAntes.nombre) {
      bitacoraDetalles += `Nombre: ${usuarioAntes.nombre} → ${nombre}. `;
    }
    if (email && email !== usuarioAntes.email) {
      bitacoraDetalles += `Email: ${usuarioAntes.email} → ${email}. `;
    }
    if (rol && rol !== usuarioAntes.rol) {
      bitacoraDetalles += `Rol: ${usuarioAntes.rol} → ${rol}. `;
    }
    if (activo !== undefined && activo !== usuarioAntes.activo) {
      bitacoraDetalles += `Estado: ${usuarioAntes.activo ? 'Activo' : 'Inactivo'} → ${activo ? 'Activo' : 'Inactivo'}. `;
    }

    const usuario = await prisma.usuario.update({
      where: { id: Number(id) },
      data: req.body,
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });

    if (bitacoraDetalles) {
      await registrarBitacora({
        accion: 'Actualización de usuario',
        usuarioId: req.usuario.id,
        ip: req.ip,
        detalles: `Usuario ID ${id} (${usuario.nombre}): ${bitacoraDetalles} `.trim(),
      });
    }

    res.json(usuario);
  } catch (error) {
    next(error);
  }
});

router.put('/usuarios/:id/reset-pin', validar(resetearPinAdminSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { pinNuevo } = req.body;
    const pinAUsar = pinNuevo || '000000';
    const hashPin = await derivarPin(pinAUsar);

    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(id) },
      select: { nombre: true },
    });

    await prisma.usuario.update({
      where: { id: Number(id) },
      data: {
        hashPin,
        requiereCambioPin: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });

    await registrarBitacora({
      accion: pinNuevo ? 'Modificación de PIN' : 'Restablecimiento de PIN',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `PIN ${pinNuevo ? 'modificado' : 'restablecido'} para usuario ID ${id} (${usuario?.nombre || 'desconocido'})`,
    });

    res.json({ ok: true, mensaje: `PIN ${pinNuevo ? 'actualizado' : 'restablecido a 000000'}` });
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
