import { Router } from 'express';
import * as XLSX from 'xlsx';
import { prisma } from '../prisma.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { EvaluacionService } from '../services/evaluacionService.js';
import { crearEvaluacionSchema, editarEvaluacionSchema, anularEvaluacionSchema } from '../utils/schemas.js';
import { registrarBitacora } from '../utils/bitacora.js';

import { filtrosEvaluaciones, paginacion } from '../utils/evaluacionFilters.js';
import { resumenEvaluaciones } from '../utils/resumenEvaluaciones.js';

const router = Router();
const service = new EvaluacionService(prisma);

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const where = filtrosEvaluaciones(req.query);
    const { pagina: paginaNumero, porPagina: porPaginaNumero } = paginacion(req.query);

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

router.get('/resumen', async (req, res, next) => {
  try {
    const where = filtrosEvaluaciones(req.query);
    const [items, evaluadores] = await Promise.all([
      prisma.evaluacion.findMany({
        where,
        select: {
          id: true, fecha: true, creadoEn: true, trabajadorId: true,
          estado: true, higienePorcentaje: true, uniformePorcentaje: true,
          generalPorcentaje: true, clasificacion: true, colorEsperado: true,
          cumplimientoColor: true, trabajador: { select: { nombre: true } },
        },
      }),
      prisma.usuario.findMany({
        where: { evaluacionesRealizadas: { some: {} } },
        select: { id: true, nombre: true }, orderBy: { nombre: 'asc' },
      }),
    ]);
    res.json({ resumen: resumenEvaluaciones(items), evaluadores });
  } catch (error) { next(error); }
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
      evaluadorId: req.usuario.id,
      creadoPorId: req.usuario.id,
    });

    res.set('Cache-Control', 'no-store');
    res.status(201).json(evaluacion);
    await registrarBitacora({
      accion: 'Crear evaluación',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `Trabajador: ${evaluacion.trabajador?.nombre || ''}, General: ${evaluacion.generalPorcentaje || 0}%`,
    });
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

router.get('/:id([0-9a-fA-F-]{36})', authorize('administrador', 'supervisor'), async (req, res, next) => {
  try {
    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: req.params.id },
      include: {
        detalles: { select: { parametroId: true, resultado: true } },
        trabajador: { select: { id: true, nombre: true } },
        area: { select: { id: true, nombre: true } },
        evaluador: { select: { id: true, nombre: true } },
      },
    });
    if (!evaluacion) return res.status(404).json({ error: 'Evaluación no encontrada' });
    res.set('Cache-Control', 'no-store');
    res.json(evaluacion);
  } catch (error) {
    next(error);
  }
});

router.put('/:id([0-9a-fA-F-]{36})', authorize('administrador', 'supervisor'), async (req, res, next) => {
  try {
    const parsed = editarEvaluacionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const parametros = await prisma.parametro.findMany({ where: { activo: true } });
    const { evaluacion } = await service.editar(req.params.id, {
      datos: parsed.data,
      detalles: parsed.data.detalles,
      parametros,
      usuarioId: req.usuario.id,
      ip: req.ip,
    });
    res.set('Cache-Control', 'no-store');
    res.json(evaluacion);
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
    await registrarBitacora({
      accion: 'Anular evaluación',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `Anulada evaluación ID: ${req.params.id}. Motivo: ${parsed.data.motivo}`,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authorize('administrador'), async (req, res, next) => {
  try {
    const existente = await prisma.evaluacion.findUnique({ where: { id: req.params.id } });
    if (!existente) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    await service.eliminar(req.params.id, {
      usuarioId: req.usuario.id,
    });

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, message: 'Evaluación eliminada permanentemente' });
    
    await registrarBitacora({
      accion: 'Eliminar evaluación (Hard Delete)',
      usuarioId: req.usuario.id,
      ip: req.ip,
      detalles: `Eliminada evaluación ID: ${req.params.id} y recálculo de integridad completado.`,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/exportar', authorize('administrador', 'supervisor'), async (req, res, next) => {
  try {
    if (!['supervisor', 'administrador'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const where = filtrosEvaluaciones(req.query);

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
      Fecha: new Date(ev.fecha).toLocaleDateString('es-BO', { timeZone: 'UTC' }),
      Trabajador: ev.trabajador?.nombre || 'Sin trabajador',
      'Área': ev.area?.nombre || '',
      Estado: ev.estado,
      Clasificación: ev.clasificacion || 'Sin clasificar',
      'Indicador BPH': ev.generalPorcentaje == null ? 'N/A' : `${ev.generalPorcentaje}%`,
      Evaluador: ev.evaluador?.nombre || 'Sin evaluador',
      'Observación': ev.observaciones || '',
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
