// ============================================================================
// worker.js — entrypoint compatible con Cloudflare Workers usando un router
// propio y sin depender de Express ni de httpServerHandler.
// ============================================================================

import { crearApp } from './app.js';
import { RespaldoService } from './services/respaldoService.js';
import { crearPrisma } from './utils/prismaClient.js';

export default {
  async fetch(request, env, ctx) {
    const app = crearApp();
    return app.handleRequest(request, env);
  },

  /**
   * Cron Trigger — se dispara según wrangler.toml [triggers] crons.
   * Corre el respaldo automático sin pasar por HTTP (no necesita CRON_TOKEN
   * acá porque el propio Cron Trigger ya está protegido por Cloudflare:
   * nadie externo puede invocar `scheduled()` directamente).
   */
  async scheduled(event, env, ctx) {
    const prisma = crearPrisma(env);
    const respaldoService = new RespaldoService(prisma, env);
    ctx.waitUntil(
      respaldoService.generarYSubir().catch((err) => {
        console.error('Error generando el respaldo automático:', err);
      })
    );
  },
};
