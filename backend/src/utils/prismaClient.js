 import { PrismaClient } from '@prisma/client';
 import { PrismaPg } from '@prisma/adapter-pg';
 import { Pool } from 'pg';
 
// Cache a nivel de módulo: el Worker reutiliza el mismo isolate entre
// múltiples requests. Guardamos acá el PrismaClient ya creado para NO
// abrir una conexión nueva a Postgres en cada request.
let prismaInstance = null;

 export function crearPrisma(env) {
  if (prismaInstance) {
    return prismaInstance;
  }

   const hyperdrive = env?.HYPERDRIVE;
   if (hyperdrive?.connectionString) {
     const pool = new Pool({ connectionString: hyperdrive.connectionString });
     const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
    prismaInstance = new PrismaClient({ adapter });
     return prismaInstance;
   }
 
   if (env && typeof env === 'object') {
     for (const value of Object.values(env)) {
       if (value && typeof value === 'object' && typeof value.connectionString === 'string' && value.connectionString.trim()) {
         const pool = new Pool({ connectionString: value.connectionString });
         const adapter = new PrismaPg(pool);
        return new PrismaClient({ adapter });
        prismaInstance = new PrismaClient({ adapter });
        return prismaInstance;
       }
     }
   }
 
   let databaseUrl = null;
   try {
     databaseUrl = process.env?.DATABASE_URL;
   } catch {}
 
   if (databaseUrl) {
    return new PrismaClient();
    prismaInstance = new PrismaClient();
    return prismaInstance;
   }
 
   throw new Error('...');
 }