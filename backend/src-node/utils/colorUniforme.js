// Dates represent calendar days stored at UTC midnight, not capture timestamps.
export function colorEsperadoParaArea(nombre, fecha) {
  const area = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (!area || ['produccion', 'calidad e inocuidad'].includes(area)) return null;
  const dia = new Date(fecha).getUTCDay();
  return { 1: 'Rojo', 2: 'Amarillo', 3: 'Verde', 4: 'Rojo', 5: 'Amarillo' }[dia] || null;
}

export function estadoColorEvaluacion(ev) {
  if (!colorEsperadoParaArea(ev.area?.nombre, ev.fecha)) return 'No aplica';
  return ev.cumplimientoColor || 'Sin registrar';
}

export function resolverColor(nombre, fecha, observado) {
  const colorEsperado = colorEsperadoParaArea(nombre, fecha);
  if (!colorEsperado) return { colorEsperado: null, colorObservado: null, cumplimientoColor: null };
  if (!['Rojo', 'Amarillo', 'Verde'].includes(observado)) {
    throw Object.assign(new Error('Selecciona el color observado del uniforme'), { status: 400 });
  }
  return { colorEsperado, colorObservado: observado, cumplimientoColor: observado === colorEsperado ? 'Cumple' : 'No cumple' };
}
