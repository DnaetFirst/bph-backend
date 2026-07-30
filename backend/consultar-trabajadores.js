import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const trabajadores = await prisma.trabajador.findMany({
    include: {
      area: true,
    },
    orderBy: {
      nombre: 'asc',
    },
  });

  console.log('=== TRABAJADORES EN BASE DE DATOS ===');
  console.log(`Total: ${trabajadores.length}\n`);

  trabajadores.forEach((t) => {
    console.log(`- ${t.nombre} (${t.area?.nombre || 'Sin área'}) - ${t.activo ? 'ACTIVO' : 'INACTIVO'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
