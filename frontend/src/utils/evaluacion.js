export function calcularProgreso(params, respuestas) {
  const respondidos = params.filter(p => ['Cumple', 'No cumple', 'No aplica'].includes(respuestas[p.id]));
  const aplicables = respondidos.filter(p => respuestas[p.id] !== 'No aplica');
  const cumple = aplicables.filter(p => respuestas[p.id] === 'Cumple').length;
  return { cumple, total: aplicables.length, respondidos: respondidos.length,
    porcentaje: aplicables.length ? Math.round(100 * cumple / aplicables.length) : null };
}

export function clasificar(porcentaje) {
  if (porcentaje == null) return 'N/A';
  return porcentaje >= 90 ? 'Excelente' : porcentaje >= 75 ? 'Aceptable' : 'Deficiente';
}
