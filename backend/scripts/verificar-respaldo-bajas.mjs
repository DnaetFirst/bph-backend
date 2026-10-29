import 'dotenv/config';
import { PrismaClient } from '../generated/node-client/index.js';
const source = new PrismaClient();
const restored = new PrismaClient({ datasources: { db: { url: 'postgresql://bph_test@127.0.0.1:55439/bph_restore_test' } } });
try {
  const counts = async db => Object.fromEntries(await Promise.all(['usuario','trabajador','area','evaluacion','detalleEvaluacion','bitacora'].map(async model => [model, await db[model].count()])));
  const [antes, despues] = await Promise.all([counts(source), counts(restored)]);
  const ceroBajas = await restored.bajaProducto.count();
  console.log(JSON.stringify({ origenSoloLectura: antes, restauradoYMigrado: despues, coinciden: JSON.stringify(antes) === JSON.stringify(despues), bajas: ceroBajas }));
  if (JSON.stringify(antes) !== JSON.stringify(despues) || ceroBajas !== 0) process.exitCode = 1;
} finally { await source.$disconnect(); await restored.$disconnect(); }
