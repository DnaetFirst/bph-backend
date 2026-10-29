import { PrismaClient } from '../generated/node-client/index.js';
import { derivarPin } from '../src-node/utils/crypto.js';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || !url.pathname.endsWith('_test')) throw new Error('Solo base local de pruebas');
const db = new PrismaClient();
try {
  const hashPin = await derivarPin('12345678');
  await db.usuario.upsert({ where: { nombre: 'DEMO BAJAS' }, create: { nombre: 'DEMO BAJAS', email: 'demo-bajas@example.test', rol: 'administrador', hashPin }, update: { hashPin, activo: true } });
  console.log('Usuario sintético DEMO BAJAS listo solo en base de pruebas.');
} finally { await db.$disconnect(); }
