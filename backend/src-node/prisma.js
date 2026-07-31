import { PrismaClient } from '../generated/node-client/index.js';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__bphPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__bphPrisma = prisma;
}
