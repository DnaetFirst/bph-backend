import { Router } from '../utils/router.js';
import { EvaluacionService } from '../services/evaluacionService.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { crearEvaluacionSchema, anularEvaluacionSchema, validar } from '../validators/schemas.js';
import * as XLSX from 'xlsx';

const router = new Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  const { areaId, estado, trabajadorId, pagina = 1, porPagina = 20 } = req.query;
  const where = {
    areaId: areaId ? Number(areaId) : undefined,
    estado: estado || undefined,
    trabajadorId: trabajadorId ? Number(trabajadorId) : undefined,
  };

  const [items, total] = await Promise.all([
    req.prisma.evaluacion.findMany({
      where,
      include: { 
        area: true, 
        evaluador: true, 
        trabajador: true,
        detalles: { include: { parametro: true } } 
      },
      orderBy: { fecha: 'desc' },
      skip: (Number(pagina) - 1) * Number(porPagina),
      take: Number(porPagina),
    }),
    req.prisma.evaluacion.count({ where }),
  ]);

  res.json({ items, total, pagina: Number(pagina), porPagina: Number(porPagina) });
});

router.post('/', validar(crearEvaluacionSchema), async (req, res) => {
  const evaluacionService = new EvaluacionService(req.prisma);

  const parametros = await req.prisma.parametro.findMany({ where: { activo: true } });

  const evaluacion = await evaluacionService.crear({
    datos: req.body,
    detalles: req.body.detalles,
    parametros,
    evaluadorId: req.body.evaluadorId,
    creadoPorId: req.usuario.id,
  });

  res.status(201).json(evaluacion);
});

// IMPORTANTE: /integridad/verificar debe ir ANTES de /:id/anular para que el
// param :id no capture "integridad" como valor — el router evalúa en orden.
router.get(
  '/integridad/verificar',
  authorize('administrador'),
  async (req, res) => {
    const evaluacionService = new EvaluacionService(req.prisma);
    const resultado = await evaluacionService.verificarIntegridadCompleta();
    res.json(resultado);
  }
);

router.post(
  '/:id/anular',
  authorize('supervisor', 'administrador'),
  validar(anularEvaluacionSchema),
  async (req, res) => {
    const evaluacionService = new EvaluacionService(req.prisma);

    // Verificar que la evaluación existe antes de anular
    const existente = await req.prisma.evaluacion.findUnique({ where: { id: req.params.id } });
    if (!existente) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }
    if (existente.estado === 'ANULADA') {
      return res.status(400).json({ error: 'La evaluación ya está anulada' });
    }

    const evaluacion = await evaluacionService.anular(req.params.id, {
      motivo: req.body.motivo,
      usuarioId: req.usuario.id,
    });

    res.json(evaluacion);
  }
);

// Exportar evaluaciones a Excel
router.get('/exportar', authorize('supervisor', 'administrador'), async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, trabajadorId, areaId, clasificacion } = req.query;
    
    const where = {
      estado: 'ACTIVA',
      ...(fechaDesde && { fecha: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fecha: { lte: new Date(fechaHasta) } }),
      ...(trabajadorId && { trabajadorId: Number(trabajadorId) }),
      ...(areaId && { areaId: Number(areaId) }),
      ...(clasificacion && { clasificacion }),
    };

    const evaluaciones = await req.prisma.evaluacion.findMany({
      where,
      include: {
        trabajador: true,
        area: true,
        evaluador: true,
      },
      orderBy: { fecha: 'desc' },
    });

    // Formatear datos para Excel
    const datos = evaluaciones.map((ev) => ({
      Fecha: new Date(ev.fecha).toLocaleDateString('es-ES'),
      Trabajador: ev.trabajador?.nombre || 'Sin trabajador',
      Clasificación: ev.clasificacion || 'Sin clasificar',
      'Indicador BPH': `${ev.generalPorcentaje || 0}%`,
      Evaluador: ev.evaluador?.nombre || 'Sin evaluador',
    }));

    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    
    // Agregar autofilter (solo si hay datos; con array vacío no existe '!ref')
    if (ws['!ref']) {
      ws['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref'])) };
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones');
    
    // Generar buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Enviar respuesta
    const fechaHoy = new Date().toISOString().slice(0, 10);
    res.headers.set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.headers.set('content-disposition', `attachment; filename="evaluaciones_bph_${fechaHoy}.xlsx"`);
    return res.end(excelBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
