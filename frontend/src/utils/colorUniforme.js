// Dates represent calendar days stored at UTC midnight, not capture timestamps.
export function colorEsperadoParaArea(nombre, fecha) {
  const area = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (!['produccion', 'calidad e inocuidad'].includes(area)) return null;
  const dia = new Date(fecha).getUTCDay();
  return { 1: 'Rojo', 2: 'Amarillo', 3: 'Verde', 4: 'Rojo', 5: 'Amarillo' }[dia] || null;
}

export function estadoColorEvaluacion(ev) {
  if (!colorEsperadoParaArea(ev.area?.nombre, ev.fecha)) return 'No aplica';
  return ev.cumplimientoColor || 'Sin registrar';
}
