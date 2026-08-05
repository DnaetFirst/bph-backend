// Bolivia está en UTC-4 (no tiene horario de verano)
const BOLIVIA_OFFSET_MS = -4 * 60 * 60 * 1000;

/**
 * Retorna la fecha actual en zona horaria de Bolivia (UTC-4) como string YYYY-MM-DD.
 */
export const getLocalISODate = () => {
  const now = new Date(Date.now() + BOLIVIA_OFFSET_MS);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Dado un string de fecha YYYY-MM-DD, retorna el día de la semana
 * interpretado en hora boliviana (UTC-4).
 * 0 = Domingo, 1 = Lunes, ..., 6 = Sábado.
 */
export const getDiaSemanaBolivia = (fechaStr) => {
  // Parseamos la fecha a mediodía UTC-4 (= 16:00 UTC) para evitar
  // desfases en el cálculo del día.
  const utc = new Date(`${fechaStr}T16:00:00.000Z`);
  return utc.getUTCDay();
};

export const normalizarNombre = (str) =>
  str.replace(/[^\u0000-\u007F]/g, '').toLowerCase();
