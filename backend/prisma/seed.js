// ============================================================================
// Seed inicial — correr con: node prisma/seed.js
// Usa la conexión directa de Supabase (variable DATABASE_URL del .env local),
// NO usa Hyperdrive (este script corre en tu máquina, no en el Worker).
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { derivarPin } from '../src-node/utils/crypto.js';
import crypto from 'crypto';
import 'dotenv/config';

if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto;
}

const prisma = new PrismaClient();

const AREAS = ['Carnicos', 'Comidas MAP', 'F.F.V.V.', 'Panificacion', 'Produccion', 'Calidad e inocuidad'];

// Trabajadores iniciales del HTML original con sus áreas correctas
const TRABAJADORES = [
  { nombre: 'DEYSI POZO ILLANES', area: 'Cárnicos' },
  { nombre: 'MAYDA PINTO CUBA', area: 'Comidas MAP' },
  { nombre: 'FERNANDO TARQUI', area: 'F.F.V.V.' },
  { nombre: 'DEYNA AYALA', area: 'Panificación' },
  { nombre: 'MARITSA PEREZ', area: 'Cárnicos' },
  { nombre: 'LAURA FRANCO', area: 'Comidas MAP' },
  { nombre: 'YULIANA MANSILLA', area: 'F.F.V.V.' },
  { nombre: 'CRISTHIAN VASQUEZ', area: 'Panificación' },
  { nombre: 'EVA MORALES', area: 'Cárnicos' },
  { nombre: 'HUGO RIVERA', area: 'Comidas MAP' },
  { nombre: 'ERIKA LANDA', area: 'F.F.V.V.' },
  { nombre: 'EDUARDO GUTIERREZ', area: 'Panificación' },
  { nombre: 'YONY QUINTEROS', area: 'Cárnicos' },
  { nombre: 'SANTIAGO BATISTA', area: 'Comidas MAP' },
  { nombre: 'YESICA QUENTASI', area: 'F.F.V.V.' },
  { nombre: 'FRANCISCO', area: 'Panificación' },
  { nombre: 'NATALIA SORIA', area: 'Cárnicos' },
  { nombre: 'J. CARLOS SUPAYABE', area: 'Comidas MAP' },
  { nombre: 'VALERIA ESPINOZA', area: 'F.F.V.V.' },
  { nombre: 'CÉSAR STROEBEL', area: 'Panificación' },
  { nombre: 'MARISOL PINTO', area: 'Cárnicos' },
];

// Los 10 parámetros vigentes tras eliminar los ítems 3,5,6,7 de Uniforme
const PARAMETROS = [
  // Higiene (7)
  { categoria: 'higiene', texto: 'Manos limpias y lavado correcto', orden: 1 },
  { categoria: 'higiene', texto: 'Uñas cortas, limpias, sin esmalte', orden: 2 },
  { categoria: 'higiene', texto: 'Sin joyas ni accesorios en manos/muñecas', orden: 3 },
  { categoria: 'higiene', texto: 'Cabello recogido y cubierto', orden: 4 },
  { categoria: 'higiene', texto: 'Sin heridas expuestas o cubiertas correctamente', orden: 5 },
  { categoria: 'higiene', texto: 'No come, bebe ni fuma en el área', orden: 6 },
  { categoria: 'higiene', texto: 'Higiene personal general adecuada', orden: 7 },
  // Uniforme (3) — ítems que permanecen tras la eliminación
  { categoria: 'uniforme', texto: 'Uniforme completo, limpio y en buen estado', orden: 1 },
  { categoria: 'uniforme', texto: 'Cofia o gorro correctamente colocado', orden: 2 },
  { categoria: 'uniforme', texto: 'Calzado cerrado, limpio y exclusivo del área', orden: 3 },
];

async function main() {
  console.log('Borrando evaluaciones existentes...');
  await prisma.evaluacion.deleteMany({});
  
  console.log('Borrando trabajadores existentes...');
  await prisma.trabajador.deleteMany({});

  console.log('Borrando áreas existentes...');
  await prisma.area.deleteMany({});

  console.log('Sembrando áreas...');
  for (const nombre of AREAS) {
    await prisma.area.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  console.log('Sembrando parámetros...');
  for (const p of PARAMETROS) {
    const existente = await prisma.parametro.findFirst({
      where: { categoria: p.categoria, texto: p.texto },
    });
    if (!existente) {
      await prisma.parametro.create({ data: p });
    }
  }

  console.log('Sembrando trabajadores...');
  for (const t of TRABAJADORES) {
    const area = await prisma.area.findUnique({ where: { nombre: t.area } });
    if (area) {
      await prisma.trabajador.upsert({
        where: { nombre: t.nombre },
        update: {},
        create: {
          nombre: t.nombre,
          areaId: area.id,
        },
      });
    }
  }

  console.log('Creando usuario administrador inicial...');
  const pinInicial = process.env.SEED_ADMIN_PIN || '000000';
  const hashPin = await derivarPin(pinInicial);

  await prisma.usuario.upsert({
    where: { nombre: 'EVA MORALES' },
    update: {
      email: 'eva.morales@nexocorp.com',
    },
    create: {
      nombre: 'EVA MORALES',
      email: 'eva.morales@nexocorp.com',
      rol: 'administrador',
      hashPin,
      requiereCambioPin: true,
    },
  });

  await prisma.usuario.upsert({
    where: { nombre: 'LEANDRO VALDEZ' },
    update: { email: 'leandro.valdez@nexocorp.com' },
    create: {
      nombre: 'LEANDRO VALDEZ',
      email: 'leandro.valdez@nexocorp.com',
      rol: 'supervisor',
      hashPin: await derivarPin('123456'),
      requiereCambioPin: false,
    },
  });

  await prisma.usuario.upsert({
    where: { nombre: 'CARLOS MENDOZA' },
    update: { email: 'carlos.mendoza@nexocorp.com' },
    create: {
      nombre: 'CARLOS MENDOZA',
      email: 'carlos.mendoza@nexocorp.com',
      rol: 'evaluador',
      hashPin: await derivarPin('123456'),
      requiereCambioPin: false,
    },
  });

  console.log(`Listo. PIN inicial del admin: ${pinInicial} (cambiar en el primer login).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
