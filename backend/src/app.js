// ============================================================================
// app.js — construcción de la app Express-like sobre el router custom.
//
// IMPORTANTE sobre "env" en Workers: acá NO recibimos env como parámetro de
// función. Usamos `import { env } from 'cloudflare:workers'`, que es el
// mecanismo oficial para acceder a los bindings (Hyperdrive, KV, R2,
// secretos) desde código que corre con el modelo httpServerHandler/Express
// nativo. Cloudflare garantiza que ese import quede correctamente asociado
// a cada request en curso, aunque el archivo se importe una sola vez.
// ============================================================================

import { env } from 'cloudflare:workers';

import authRoutes from './routes/auth.js';
import evaluacionRoutes from './routes/evaluaciones.js';
import trabajadoresRoutes from './routes/trabajadores.js';
import respaldoRoutes from './routes/respaldos.js';
import adminRoutes from './routes/admin.js';
import { crearPrisma } from './utils/prismaClient.js';
import { App } from './utils/router.js';

function parseBodyMiddleware(req, res, next) {
  const method = req.method?.toUpperCase() || '';
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    req.body = {};
    return next();
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded')) {
    req.body = {};
    return next();
  }

  return (async () => {
    try {
      const body = await req.request.text();
      if (!body) {
        req.body = {};
        return next();
      }

      if (contentType.includes('application/json')) {
        req.body = JSON.parse(body);
      } else {
        const params = new URLSearchParams(body);
        req.body = Object.fromEntries(params.entries());
      }
      next();
    } catch (error) {
      next(error);
    }
  })();
}

export function crearApp() {
  const app = new App();

  app.use(parseBodyMiddleware);

  const allowedOrigins = env.FRONTEND_URL
    ? env.FRONTEND_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  const isAllowedOrigin = (origin) => {
    if (!origin) return false;

    const normalizedOrigin = origin.trim().toLowerCase();
    const hasCloudflareOrigin = normalizedOrigin.endsWith('.workers.dev') || normalizedOrigin.endsWith('.pages.dev');
    const hasLocalOrigin = normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1');

    // Para credenciales, necesitamos verificar específicamente el origen
    if (hasCloudflareOrigin || hasLocalOrigin) {
      return true;
    }

    return allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      const normalizedAllowed = allowed.trim().toLowerCase();
      return normalizedOrigin === normalizedAllowed || normalizedOrigin.startsWith(normalizedAllowed);
    });
  };

  // CORS + Prisma setup
  app.use(async (req, res, next) => {
    const origin = req.headers.origin || '';
    const allowOrigin = isAllowedOrigin(origin) ? origin : (allowedOrigins[0] || '*');
    res.headers ||= new Headers();
    res.headers.set('access-control-allow-origin', allowOrigin);
    res.headers.set('access-control-allow-credentials', 'true');
    res.headers.set('access-control-allow-headers', 'content-type, authorization, x-cron-token');
    res.headers.set('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    req.env = env;
    const skipPrismaPaths = ['/', '/api/v1/health'];
    if (!skipPrismaPaths.includes(req.path)) {
      req.prisma = crearPrisma(env);
    }
    next();
  });

  // Rutas de salud (públicas, sin Prisma)
  app.get('/api/v1/health', (req, res) => res.json({ ok: true }));
  app.get('/', (req, res) => res.json({ ok: true, service: 'bph-backend' }));

  // Ruta pública para listar parámetros activos (el formulario los necesita sin autenticación)
  app.get('/api/v1/parametros', async (req, res) => {
    const parametros = await req.prisma.parametro.findMany({
      where: { activo: true },
      orderBy: [{ categoria: 'asc' }, { orden: 'asc' }],
    });
    res.json(parametros);
  });

  // Ruta pública para listar áreas — cualquier usuario autenticado que llena
  // el formulario de evaluación (evaluador, supervisor o administrador)
  // necesita esta lista, no solo el administrador. La gestión de ALTA/BAJA de
  // áreas sigue restringida a administradores en /api/v1/admin/areas.
  app.get('/api/v1/areas', async (req, res) => {
    const areas = await req.prisma.area.findMany({ orderBy: { nombre: 'asc' } });
    res.json(areas);
  });

  // Rutas protegidas
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/evaluaciones', evaluacionRoutes);
  app.use('/api/v1/trabajadores', trabajadoresRoutes);
  app.use('/api/v1/respaldos', respaldoRoutes);
  app.use('/api/v1/admin', adminRoutes);

  // Error handler global (4 argumentos — activado por el router custom corregido)
  app.use((err, req, res, next) => {
    console.error('[Error handler]', err);
    const status = err?.status || 500;
    const mensaje = status === 500 ? 'Error interno del servidor' : (err?.message || 'Error interno');
    res.status(status).json({ error: mensaje });
  });

  return app;
}
