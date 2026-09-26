const media = (items, key) => {
  const values = items.map(item => item[key]).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
};

export function resumenEvaluaciones(items) {
  const activas = items.filter(item => item.estado === 'ACTIVA');
  const grupos = new Map();
  for (const ev of activas) {
    if (!Number.isFinite(ev.generalPorcentaje)) continue;
    const id = ev.trabajadorId;
    if (!grupos.has(id)) grupos.set(id, { id, label: ev.trabajador?.nombre || 'Sin trabajador', values: [] });
    grupos.get(id).values.push(ev.generalPorcentaje);
  }
  const conColor = activas.filter(ev => ev.colorEsperado && ['Cumple', 'No cumple'].includes(ev.cumplimientoColor));
  return {
    totalItems: activas.length,
    promedioGeneral: media(activas, 'generalPorcentaje'),
    promedioHigiene: media(activas, 'higienePorcentaje'),
    promedioUniforme: media(activas, 'uniformePorcentaje'),
    tieneUniforme: activas.some(ev => Number.isFinite(ev.uniformePorcentaje)),
    excelentes: activas.filter(ev => ev.clasificacion === 'Excelente').length,
    aceptables: activas.filter(ev => ev.clasificacion === 'Aceptable').length,
    deficientes: activas.filter(ev => ev.clasificacion === 'Deficiente').length,
    cumplimientoColorPorcentaje: conColor.length ? Math.round(100 * conColor.filter(ev => ev.cumplimientoColor === 'Cumple').length / conColor.length) : null,
    topTrabajadores: [...grupos.values()].map(({ id, label, values }) => ({
      id, label, value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    })).sort((a, b) => b.value - a.value || a.id - b.id).slice(0, 5),
    tendencia: [...activas].filter(ev => Number.isFinite(ev.generalPorcentaje))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || new Date(a.creadoEn) - new Date(b.creadoEn) || a.id.localeCompare(b.id))
      .slice(-6).map(ev => {
        const fecha = new Date(ev.fecha);
        const label = fecha.toLocaleDateString('es-BO', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' });
        return { id: ev.id, label, value: ev.generalPorcentaje };
      }),
  };
}
