import { prisma } from '../prisma.js';

export async function registrarBitacora({ accion, usuarioId, ip, detalles }) {
  try {
    await prisma.bitacora.create({
      data: {
        accion,
        usuarioId: Number(usuarioId),
        ip,
        detalles,
      },
    });
  } catch (error) {
    console.error('[bitacora] Error registrando evento:', error);
  }
}

export async function registrarBitacoraAuth({ accion, usuarioId, ip, detalles }) {
  if (!usuarioId) return;
  await registrarBitacora({ accion, usuarioId, ip, detalles });
}
