import app from './app.js';
import { config } from './config.js';
import { prisma } from './prisma.js';

const server = app.listen(config.port, () => {
  console.log(`Backend Node escuchando en http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`Recibido ${signal}. Cerrando servidor...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
