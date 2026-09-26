function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

export function filtrosEvaluaciones(query = {}) {
  const where = {};
  for (const key of ['areaId', 'trabajadorId', 'evaluadorId']) {
    if (query[key] === undefined || query[key] === '') continue;
    const value = Number(query[key]);
    if (!Number.isSafeInteger(value) || value < 1) invalid(`${key} inválido`);
    where[key] = value;
  }
  for (const [key, values] of Object.entries({
    estado: ['ACTIVA', 'ANULADA'],
    clasificacion: ['Excelente', 'Aceptable', 'Deficiente'],
  })) {
    if (!query[key]) continue;
    if (!values.includes(query[key])) invalid(`${key} inválido`);
    where[key] = query[key];
  }
  const fecha = {};
  for (const [key, op, time] of [
    ['fechaDesde', 'gte', '00:00:00.000'],
    ['fechaHasta', 'lte', '23:59:59.999'],
  ]) {
    if (!query[key]) continue;
    const value = query[key];
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('Fecha inválida');
    const date = new Date(`${value}T${time}Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid('Fecha inválida');
    fecha[op] = date;
  }
  if (fecha.gte && fecha.lte && fecha.gte > fecha.lte) invalid('La fecha desde debe ser anterior a la fecha hasta');
  if (Object.keys(fecha).length) where.fecha = fecha;
  if (query.q) {
    if (typeof query.q !== 'string' || query.q.length > 100) invalid('Búsqueda inválida');
    where.OR = [
      { trabajador: { nombre: { contains: query.q.trim(), mode: 'insensitive' } } },
      { evaluador: { nombre: { contains: query.q.trim(), mode: 'insensitive' } } },
      { clasificacion: { contains: query.q.trim(), mode: 'insensitive' } },
    ];
  }
  return where;
}

export function paginacion(query = {}) {
  const pagina = Number(query.pagina ?? 1);
  const porPagina = Number(query.porPagina ?? 20);
  if (!Number.isSafeInteger(pagina) || pagina < 1 || !Number.isSafeInteger(porPagina) || porPagina < 1) invalid('Paginación inválida');
  return { pagina, porPagina: Math.min(100, porPagina) };
}
