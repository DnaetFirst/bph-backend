import * as XLSX from 'xlsx';
import { colorEsperadoParaArea, estadoColorEvaluacion } from '../utils/colorUniforme.js';

export const ordenExcel = [{ fecha: 'asc' }, { creadoEn: 'asc' }, { id: 'asc' }];
export function generarExcel(evaluaciones) {
  const ordenadas = [...evaluaciones].sort((a, b) => new Date(a.fecha) - new Date(b.fecha)
    || new Date(a.creadoEn) - new Date(b.creadoEn) || String(a.id).localeCompare(String(b.id)));
  const datos = ordenadas.map(ev => {
    const fecha = new Date(ev.fecha);
    const aplica = Boolean(colorEsperadoParaArea(ev.area?.nombre, ev.fecha));
    return {
      Fecha: (Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86400000,
      Trabajador: ev.trabajador?.nombre || 'Sin trabajador',
      'Área': ev.area?.nombre || '', Estado: ev.estado,
      Clasificación: ev.clasificacion || 'Sin clasificar',
      'Indicador BPH': ev.generalPorcentaje == null ? 'N/A' : `${ev.generalPorcentaje}%`,
      'Higiene': ev.higienePorcentaje == null ? 'N/A' : `${ev.higienePorcentaje}%`,
      'Uniforme / color': ev.uniformePorcentaje == null ? 'N/A' : `${ev.uniformePorcentaje}%`,
      'Color esperado': aplica ? (ev.colorEsperado || colorEsperadoParaArea(ev.area?.nombre, ev.fecha)) : 'No aplica',
      'Color observado': aplica ? (ev.colorObservado || 'Sin registrar') : 'No aplica',
      'Cumplimiento de color': estadoColorEvaluacion(ev),
      Evaluador: ev.evaluador?.nombre || 'Sin evaluador', 'Observación': ev.observaciones || '',
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datos, { header: ['Fecha', 'Trabajador', 'Área', 'Estado', 'Clasificación', 'Indicador BPH', 'Higiene', 'Uniforme / color', 'Color esperado', 'Color observado', 'Cumplimiento de color', 'Evaluador', 'Observación'] });
  for (let i = 0; i < datos.length; i++) ws[`A${i + 2}`].z = 'dd/mm/yyyy';
  ws['!cols'] = [14, 30, 26, 14, 18, 16, 14, 20, 20, 20, 24, 30, 50].map(wch => ({ wch }));
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
  XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
