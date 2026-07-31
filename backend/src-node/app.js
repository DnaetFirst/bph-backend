import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { prisma } from './prisma.js';
import { config, getAllowedOrigins } from './config.js';
import authRoutes from './routes/auth.js';
import trabajadoresRoutes from './routes/trabajadores.js';
import evaluacionesRoutes from './routes/evaluaciones.js';
import adminRoutes from './routes/admin.js';

const app = express();
const allowedOrigins = getAllowedOrigins();

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
  exposedHeaders: ['Cache-Control'],
  maxAge: 86400,
}));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'bph-backend-node' });
});

app.get('/api/v1/health', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/areas', async (req, res, next) => {
  try {
    const areas = await prisma.area.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(areas);
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/parametros', async (req, res, next) => {
  try {
    const parametros = await prisma.parametro.findMany({
      where: { activo: true },
      select: { id: true, categoria: true, texto: true, orden: true },
      orderBy: [{ categoria: 'asc' }, { orden: 'asc' }],
    });
    res.json(parametros);
  } catch (error) {
    next(error);
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/trabajadores', trabajadoresRoutes);
app.use('/api/v1/evaluaciones', evaluacionesRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use((error, req, res, next) => {
  console.error('[backend-node]', error);

  if (error?.message?.startsWith('Origen no permitido por CORS:')) {
    return res.status(403).json({ error: error.message });
  }

  if (error?.code === 'P2002') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  }

  if (error?.code === 'P2025') {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }

  return res.status(error.status || 500).json({
    error: error.status ? error.message : 'Error interno del servidor',
  });
});

export default app;
