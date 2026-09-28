import * as XLSX from 'xlsx';

export const ordenExcel = [{ fecha: 'asc' }, { creadoEn: 'asc' }, { id: 'asc' }];
export function generarExcel(evaluaciones) {
  const ordenadas = [...evaluaciones].sort((a, b) => new Date(a.fecha) - new Date(b.fecha)
    || new Date(a.creadoEn) - new Date(b.creadoEn) || String(a.id).localeCompare(String(b.id)));
  const datos = ordenadas.map(ev => {
    const fecha = new Date(ev.fecha);
    return {
      Fecha: (Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86400000,
      Trabajador: ev.trabajador?.nombre || 'Sin trabajador',
      'Área': ev.area?.nombre || '', Estado: ev.estado,
      Clasificación: ev.clasificacion || 'Sin clasificar',
      'Indicador BPH': ev.generalPorcentaje == null ? 'N/A' : `${ev.generalPorcentaje}%`,
      Evaluador: ev.evaluador?.nombre || 'Sin evaluador', 'Observación': ev.observaciones || '',
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datos, { header: ['Fecha', 'Trabajador', 'Área', 'Estado', 'Clasificación', 'Indicador BPH', 'Evaluador', 'Observación'] });
  for (let i = 0; i < datos.length; i++) ws[`A${i + 2}`].z = 'dd/mm/yyyy';
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
  XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
