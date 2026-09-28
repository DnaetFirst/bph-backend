export function calcularProgreso(params, respuestas, cumplimientoColor = null) {
  const respondidos = params.filter(p => ['Cumple', 'No cumple', 'No aplica'].includes(respuestas[p.id]));
  const aplicables = respondidos.filter(p => respuestas[p.id] !== 'No aplica');
  const colorRespondido = ['Cumple', 'No cumple'].includes(cumplimientoColor) ? 1 : 0;
  const total = aplicables.length + colorRespondido;
  const cumple = aplicables.filter(p => respuestas[p.id] === 'Cumple').length + (cumplimientoColor === 'Cumple' ? 1 : 0);
  return { cumple, total, respondidos: respondidos.length + colorRespondido,
    porcentaje: total ? Math.round(100 * cumple / total) : null };
}

export function clasificar(porcentaje) {
  if (porcentaje == null) return 'N/A';
  return porcentaje >= 90 ? 'Excelente' : porcentaje >= 75 ? 'Aceptable' : 'Deficiente';
}
