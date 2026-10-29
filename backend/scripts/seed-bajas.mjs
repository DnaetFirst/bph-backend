import 'dotenv/config';
import { PrismaClient } from '../generated/node-client/index.js';
import { sembrarCatalogos } from '../src-node/modules/bajas/seed.js';
if (!process.argv.includes('--confirmar-catalogos')) throw new Error('Usa --confirmar-catalogos para inicializar únicamente catálogos en DATABASE_URL. No crea bajas.');
const db = new PrismaClient();
try { await sembrarCatalogos(db); console.log('Catálogos inicializados; registros de bajas sin cambios.'); }
finally { await db.$disconnect(); }
