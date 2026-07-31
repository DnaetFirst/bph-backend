import { Router } from 'express';
import * as XLSX from 'xlsx';
import { prisma } from '../prisma.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { EvaluacionService } from '../services/evaluacionService.js';
import { crearEvaluacionSchema, anularEvaluacionSchema } from '../utils/schemas.js';

const router = Router();
const service = new EvaluacionService(prisma);

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const {
      areaId,
      estado,
      trabajadorId,
      evaluadorId,
      clasificacion,
      fechaDesde,
      fechaHasta,
      pagina = 1,
      porPagina = 20,
    } = req.query;

    const fechaFiltro = {};
    if (fechaDesde) fechaFiltro.gte = new Date(`${fechaDesde}T00:00:00.000Z`);
    if (fechaHasta) fechaFiltro.lte = new Date(`${fechaHasta}T23:59:59.999Z`);

    const where = {
      areaId: areaId ? Number(areaId) : undefined,
      estado: estado || undefined,
      trabajadorId: trabajadorId ? Number(trabajadorId) : undefined,
      evaluadorId: evaluadorId ? Number(evaluadorId) : undefined,
      clasificacion: clasificacion || undefined,
      fecha: Object.keys(fechaFiltro).length ? fechaFiltro : undefined,
    };

    const paginaNumero = Math.max(1, Number(pagina) || 1);
    const porPaginaNumero = Math.min(100, Math.max(1, Number(porPagina) || 20));

    const [items, total] = await Promise.all([
      prisma.evaluacion.findMany({
        where,
        select: {
          id: true,
          fecha: true,
          trabajadorId: true,
          areaId: true,
          evaluadorId: true,
          higienePorcentaje: true,
          uniformePorcentaje: true,
          generalPorcentaje: true,
          clasificacion: true,
          estado: true,
          colorEsperado: true,
          colorObservado: true,
          cumplimientoColor: true,
          observaciones: true,
          trabajador: { select: { id: true, nombre: true } },
          area: { select: { id: true, nombre: true } },
          evaluador: { select: { id: true, nombre: true } },
        },
        orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
        skip: (paginaNumero - 1) * porPaginaNumero,
        take: porPaginaNumero,
      }),
      prisma.evaluacion.count({ where }),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({ items, total, pagina: paginaNumero, porPagina: porPaginaNumero });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = crearEvaluacionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const parametros = await prisma.parametro.findMany({ where: { activo: true } });
    const evaluacion = await service.crear({
      datos: parsed.data,
      detalles: parsed.data.detalles,
      parametros,
      evaluadorId: parsed.data.evaluadorId,
      creadoPorId: req.usuario.id,
    });

    res.set('Cache-Control', 'no-store');
    res.status(201).json(evaluacion);
  } catch (error) {
    next(error);
  }
});

// IMPORTANTE: /integridad/verificar debe ir ANTES de /:id/anular para que el
// param :id no capture "integridad" como valor — Express evalúa rutas en orden.
router.get('/integridad/verificar', authorize('administrador'), async (req, res, next) => {
  try {
    const resultado = await service.verificarIntegridadCompleta();
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/anular', async (req, res, next) => {
  try {
    const parsed = anularEvaluacionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    if (!['supervisor', 'administrador'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const existente = await prisma.evaluacion.findUnique({ where: { id: req.params.id } });
    if (!existente) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }
    if (existente.estado === 'ANULADA') {
      return res.status(400).json({ error: 'La evaluación ya está anulada' });
    }

    const evaluacion = await service.anular(req.params.id, {
      motivo: parsed.data.motivo,
      usuarioId: req.usuario.id,
    });

    res.set('Cache-Control', 'no-store');
    res.json(evaluacion);
  } catch (error) {
    next(error);
  }
});

router.get('/exportar', async (req, res, next) => {
  try {
    if (!['supervisor', 'administrador'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { fechaDesde, fechaHasta, trabajadorId, areaId, clasificacion } = req.query;
    const where = {
      estado: 'ACTIVA',
      ...(fechaDesde && { fecha: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fecha: { lte: new Date(fechaHasta) } }),
      ...(trabajadorId && { trabajadorId: Number(trabajadorId) }),
      ...(areaId && { areaId: Number(areaId) }),
      ...(clasificacion && { clasificacion }),
    };

    const evaluaciones = await prisma.evaluacion.findMany({
      where,
      include: {
        trabajador: true,
        area: true,
        evaluador: true,
      },
      orderBy: { fecha: 'desc' },
    });

    const datos = evaluaciones.map((ev) => ({
      Fecha: new Date(ev.fecha).toLocaleDateString('es-ES'),
      Trabajador: ev.trabajador?.nombre || 'Sin trabajador',
      Clasificación: ev.clasificacion || 'Sin clasificar',
      'Indicador BPH': `${ev.generalPorcentaje || 0}%`,
      Evaluador: ev.evaluador?.nombre || 'Sin evaluador',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    if (ws['!ref']) {
      ws['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref'])) };
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fechaHoy = new Date().toISOString().slice(0, 10);

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="evaluaciones_bph_${fechaHoy}.xlsx"`);
    res.end(excelBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;
