const AREAS_SIN_UNIFORME = new Set(['produccion', 'calidad e inocuidad']);

export function normalizarNombreArea(nombre = '') {
  return String(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function areaExcluyeUniforme(nombreArea) {
  return AREAS_SIN_UNIFORME.has(normalizarNombreArea(nombreArea));
}

export function parametroExcluidoEnArea(parametro, nombreArea) {
  if (!parametro?.excluyeAreasJson) return false;
  try {
    const areasExcluidas = JSON.parse(parametro.excluyeAreasJson);
    if (!Array.isArray(areasExcluidas)) return false;
    const areaNormalizada = normalizarNombreArea(nombreArea);
    return areasExcluidas.some((area) => normalizarNombreArea(area) === areaNormalizada);
  } catch {
    return false;
  }
}
