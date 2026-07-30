import { Router } from '../utils/router.js';
import { RespaldoService } from '../services/respaldoService.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = new Router();

/**
 * Dispara el respaldo manualmente. Protegido por CRON_TOKEN (token de servicio),
 * no por sesión — así el Cron Trigger interno puede invocarlo sin login.
 */
router.post('/generar', async (req, res) => {
  const token = req.headers['x-cron-token'];
  if (!token || token !== req.env.CRON_TOKEN) {
    return res.status(403).json({ error: 'Token de servicio inválido' });
  }

  if (!req.env.BACKUP_ENCRYPTION_KEY) {
    return res.status(500).json({ error: 'BACKUP_ENCRYPTION_KEY no configurada en el servidor' });
  }

  if (!req.env.RESPALDOS) {
    return res.status(500).json({ error: 'El bucket R2 RESPALDOS no está configurado' });
  }

  try {
    const respaldoService = new RespaldoService(req.prisma, req.env);
    const nombre = await respaldoService.generarYSubir();
    res.json({ ok: true, archivo: nombre });
  } catch (err) {
    console.error('Error generando respaldo:', err);
    res.status(500).json({ error: 'Error al generar el respaldo: ' + (err.message || 'Error desconocido') });
  }
});

// Estas dos sí requieren sesión de administrador (gestión manual desde la UI)
router.get('/', authenticate, authorize('administrador'), async (req, res) => {
  if (!req.env.RESPALDOS) {
    return res.json([]);
  }
  const respaldoService = new RespaldoService(req.prisma, req.env);
  res.json(await respaldoService.listarRespaldos());
});

router.get('/:nombre/descargar', authenticate, authorize('administrador'), async (req, res) => {
  if (!req.env.RESPALDOS) {
    return res.status(503).json({ error: 'El bucket R2 RESPALDOS no está configurado' });
  }
  try {
    const respaldoService = new RespaldoService(req.prisma, req.env);
    const datos = await respaldoService.descargarYDescifrar(req.params.nombre);
    res.json(datos);
  } catch (err) {
    const status = err.message?.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ error: err.message || 'Error al descargar el respaldo' });
  }
});

export default router;
