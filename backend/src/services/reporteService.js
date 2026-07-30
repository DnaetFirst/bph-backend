// ============================================================================
// reporteService — exportación de historial a CSV.
//
// NOTA sobre Excel: el plan original proponía "exceljs" para generar .xlsx.
// exceljs depende de streams y buffers de Node de forma bastante completa;
// bajo nodejs_compat puede funcionar, pero no está garantizado ni es el
// camino recomendado por Cloudflare para Workers. Para no arriesgar esa
// pieza, este esqueleto genera CSV (que Excel abre sin problema) desde el
// Worker. Si más adelante necesitás un .xlsx con formato real (colores,
// múltiples hojas, etc.), lo más simple es generarlo en el FRONTEND con
// SheetJS (xlsx) a partir de los datos que ya te devuelve la API — ahí no
// hay ninguna limitación de runtime porque corre en el navegador.
// ============================================================================

function escaparCelda(valor) {
  const texto = String(valor ?? '');
  if (/[",\n;]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export class ReporteService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async exportarHistorialCSV(filtros = {}) {
    const evaluaciones = await this.prisma.evaluacion.findMany({
      where: {
        areaId: filtros.areaId || undefined,
        estado: filtros.estado || undefined,
        trabajador: filtros.trabajador
          ? { nombre: { contains: filtros.trabajador, mode: 'insensitive' } }
          : undefined,
      },
      include: { area: true, evaluador: true, trabajador: true },
      orderBy: { fecha: 'desc' },
    });

    const encabezados = [
      'Fecha', 'Trabajador', 'Área', 'Evaluador', 'Higiene %', 'Uniforme %',
      'General %', 'Clasificación', 'Estado', 'Anulado por', 'Motivo anulación',
    ];

    const filas = evaluaciones.map((e) => [
      e.fecha.toISOString().slice(0, 10),
      e.trabajador?.nombre ?? '',
      e.area.nombre,
      e.evaluador.nombre,
      e.higienePorcentaje ?? '',
      e.uniformePorcentaje ?? '',
      e.generalPorcentaje ?? '',
      e.clasificacion ?? '',
      e.estado,
      e.anuladoPorLegado ?? '',
      e.motivoAnulacion ?? '',
    ]);

    const csv = [encabezados, ...filas]
      .map((fila) => fila.map(escaparCelda).join(','))
      .join('\n');

    // BOM UTF-8 para que Excel en Windows detecte tildes correctamente
    return '\uFEFF' + csv;
  }
}
