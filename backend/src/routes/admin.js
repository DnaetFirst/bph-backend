import { Router } from '../utils/router.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { derivarPin } from '../utils/crypto.js';
import { ReporteService } from '../services/reporteService.js';
import { crearUsuarioSchema, actualizarUsuarioSchema, areaSchema, validar } from '../validators/schemas.js';

const router = new Router();

// Todo este enrutador requiere que el usuario sea administrador
router.use(authenticate);
router.use(authorize('administrador'));

// --- USUARIOS ---

router.get('/usuarios', async (req, res) => {
  const usuarios = await req.prisma.usuario.findMany({
    select: { id: true, nombre: true, rol: true, activo: true, creadoEn: true, bloqueadoHasta: true }
  });
  res.json(usuarios);
});

router.post('/usuarios', validar(crearUsuarioSchema), async (req, res) => {
  const { nombre, rol } = req.body;
  const existente = await req.prisma.usuario.findUnique({ where: { nombre } });

  if (existente) {
    return res.status(400).json({ error: 'El nombre de usuario ya existe' });
  }

  const pinPorDefecto = '000000';
  const hashPin = await derivarPin(pinPorDefecto);

  const usuario = await req.prisma.usuario.create({
    data: {
      nombre,
      rol,
      hashPin,
      requiereCambioPin: true,
    },
    select: { id: true, nombre: true, rol: true, activo: true }
  });

  res.status(201).json(usuario);
});

router.put('/usuarios/:id', validar(actualizarUsuarioSchema), async (req, res) => {
  const { id } = req.params;

  const usuario = await req.prisma.usuario.update({
    where: { id: Number(id) },
    data: req.body,
    select: { id: true, nombre: true, rol: true, activo: true }
  });

  res.json(usuario);
});

router.put('/usuarios/:id/reset-pin', async (req, res) => {
  const { id } = req.params;
  const pinPorDefecto = '000000';
  const hashPin = await derivarPin(pinPorDefecto);

  await req.prisma.usuario.update({
    where: { id: Number(id) },
    data: {
      hashPin,
      requiereCambioPin: true,
      intentosFallidos: 0,
      bloqueadoHasta: null
    }
  });

  res.json({ ok: true, mensaje: 'PIN restablecido a 000000' });
});

// --- ÁREAS ---

router.get('/areas', async (req, res) => {
  const areas = await req.prisma.area.findMany({ orderBy: { nombre: 'asc' } });
  res.json(areas);
});

router.post('/areas', validar(areaSchema), async (req, res) => {
  const existente = await req.prisma.area.findUnique({ where: { nombre: req.body.nombre } });
  if (existente) {
    return res.status(400).json({ error: 'El área ya existe' });
  }
  const area = await req.prisma.area.create({ data: req.body });
  res.status(201).json(area);
});

router.put('/areas/:id', validar(areaSchema), async (req, res) => {
  const { id } = req.params;
  const area = await req.prisma.area.update({
    where: { id: Number(id) },
    data: req.body
  });
  res.json(area);
});

// --- REPORTES ---

router.get('/reporte/csv', async (req, res) => {
  try {
    const reporteService = new ReporteService(req.prisma);
    const csv = await reporteService.exportarHistorialCSV({
      areaId: req.query.areaId ? Number(req.query.areaId) : undefined,
      estado: req.query.estado || undefined,
      trabajador: req.query.trabajador || undefined,
    });

    res.headers ||= new Headers();
    res.headers.set('content-type', 'text/csv; charset=utf-8');
    res.headers.set('content-disposition', `attachment; filename="reporte-bph-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.end(csv);
  } catch (err) {
    console.error('Error generando reporte CSV:', err);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

export default router;
