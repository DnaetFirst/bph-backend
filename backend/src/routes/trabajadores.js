// ============================================================================
// trabajadores — Rutas para gestión de trabajadores
// ============================================================================

import { Router } from '../utils/router.js';
import { authenticate } from '../middlewares/authenticate.js';
import { TrabajadorService } from '../services/trabajadorService.js';

const router = new Router();

// Schema de validación para crear trabajador
const crearTrabajadorSchema = {
  nombre: { type: 'string', required: true, minLength: 2 },
  areaId: { type: 'number', required: true },
};

// Schema de validación para actualizar trabajador
const actualizarTrabajadorSchema = {
  nombre: { type: 'string', required: false, minLength: 2 },
  areaId: { type: 'number', required: false },
  activo: { type: 'boolean', required: false },
};

// Middleware de validación simple
function validarSchema(schema) {
  return (req, res, next) => {
    const errores = [];
    
    for (const [campo, reglas] of Object.entries(schema)) {
      const valor = req.body[campo];
      
      if (reglas.required && valor === undefined) {
        errores.push(`${campo} es requerido`);
        continue;
      }
      
      if (valor !== undefined) {
        if (reglas.type === 'string' && typeof valor !== 'string') {
          errores.push(`${campo} debe ser texto`);
        }
        if (reglas.type === 'number' && typeof valor !== 'number') {
          errores.push(`${campo} debe ser número`);
        }
        if (reglas.type === 'boolean' && typeof valor !== 'boolean') {
          errores.push(`${campo} debe ser booleano`);
        }
        if (reglas.minLength && valor.length < reglas.minLength) {
          errores.push(`${campo} debe tener al menos ${reglas.minLength} caracteres`);
        }
      }
    }
    
    if (errores.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: errores });
    }
    
    next();
  };
}

// Obtener todos los trabajadores
router.get('/', authenticate, async (req, res) => {
  console.log('[DEBUG BACKEND ROUTE GET] GET /trabajadores llamado');
  console.log('[DEBUG BACKEND ROUTE GET] Query params:', req.query);
  try {
    const soloActivos = req.query.activos !== 'false';
    console.log('[DEBUG BACKEND ROUTE GET] soloActivos:', soloActivos);
    const trabajadorService = new TrabajadorService(req.prisma);
    const trabajadores = await trabajadorService.obtenerTodos(soloActivos);
    console.log('[DEBUG BACKEND ROUTE GET] Trabajadores devueltos:', trabajadores.length);
    console.log('[DEBUG BACKEND ROUTE GET] Activos devueltos:', trabajadores.filter(t => t.activo).length);
    console.log('[DEBUG BACKEND ROUTE GET] Inactivos devueltos:', trabajadores.filter(t => !t.activo).length);
    res.json({ trabajadores });
  } catch (err) {
    console.error('[DEBUG BACKEND ROUTE GET] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener trabajadores por área
router.get('/area/:areaId', authenticate, async (req, res) => {
  try {
    const areaId = parseInt(req.params.areaId);
    const soloActivos = req.query.activos !== 'false';
    const trabajadorService = new TrabajadorService(req.prisma);
    const trabajadores = await trabajadorService.obtenerPorArea(areaId, soloActivos);
    res.json({ trabajadores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener un trabajador por ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const trabajadorService = new TrabajadorService(req.prisma);
    const trabajador = await trabajadorService.obtenerPorId(id);
    
    if (!trabajador) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }
    
    res.json({ trabajador });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear un nuevo trabajador
router.post('/', authenticate, validarSchema(crearTrabajadorSchema), async (req, res) => {
  try {
    const trabajadorService = new TrabajadorService(req.prisma);
    const trabajador = await trabajadorService.crear(req.body);
    res.status(201).json({ trabajador });
  } catch (err) {
    if (err.message.includes('ya existe')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message.includes('no existe')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Actualizar un trabajador
router.put('/:id', authenticate, validarSchema(actualizarTrabajadorSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const trabajadorService = new TrabajadorService(req.prisma);
    const trabajador = await trabajadorService.actualizar(id, req.body);
    res.json({ trabajador });
  } catch (err) {
    if (err.message.includes('no existe')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('ya existe')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Desactivar un trabajador
router.patch('/:id/desactivar', authenticate, async (req, res) => {
  console.log('[DEBUG BACKEND ROUTE] PATCH /trabajadores/:id/desactivar llamado, id:', req.params.id);
  try {
    const id = parseInt(req.params.id);
    console.log('[DEBUG BACKEND ROUTE] id parseado:', id);
    const trabajadorService = new TrabajadorService(req.prisma);
    console.log('[DEBUG BACKEND ROUTE] Llamando a trabajadorService.desactivar');
    const trabajador = await trabajadorService.desactivar(id);
    console.log('[DEBUG BACKEND ROUTE] desactivar completado, trabajador:', trabajador);
    res.json({ trabajador });
  } catch (err) {
    console.error('[DEBUG BACKEND ROUTE] Error en desactivar:', err);
    if (err.message.includes('no existe')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Activar un trabajador
router.patch('/:id/activar', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const trabajadorService = new TrabajadorService(req.prisma);
    const trabajador = await trabajadorService.activar(id);
    res.json({ trabajador });
  } catch (err) {
    if (err.message.includes('no existe')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un trabajador
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const trabajadorService = new TrabajadorService(req.prisma);
    await trabajadorService.eliminar(id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message.includes('no existe')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('evaluaciones')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
