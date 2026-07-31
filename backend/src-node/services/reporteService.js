// ============================================================================
// reporteService — exportación de historial a CSV.
//
// NOTA sobre Excel: el reporte CSV se genera en el backend para
// compatibilidad con Excel en Windows (BOM UTF-8). Para .xlsx con
// formato real (colores, múltiples hojas), el frontend ya exporta
// directamente con SheetJS (xlsx) a partir de los datos de la API.
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
