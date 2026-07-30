// ============================================================================
// evaluacionService — guarda evaluaciones, calcula porcentajes y mantiene
// el hash encadenado de integridad (mismo esquema que la versión localStorage,
// recalculado desde el servidor en vez del navegador).
// ============================================================================

import { sha256Hex, contenidoEvaluacionParaHash } from '../utils/crypto.js';

export class EvaluacionService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  calcularPorcentajes(detalles, parametros) {
    const porCategoria = { higiene: { total: 0, cumple: 0 }, uniforme: { total: 0, cumple: 0 } };

    for (const d of detalles) {
      const parametro = parametros.find((p) => p.id === d.parametroId);
      if (!parametro || d.resultado === 'No aplica') continue;
      const cat = porCategoria[parametro.categoria];
      cat.total += 1;
      if (d.resultado === 'Cumple') cat.cumple += 1;
    }

    const higienePorcentaje = porCategoria.higiene.total
      ? Math.round((porCategoria.higiene.cumple / porCategoria.higiene.total) * 100)
      : null;
    const uniformePorcentaje = porCategoria.uniforme.total
      ? Math.round((porCategoria.uniforme.cumple / porCategoria.uniforme.total) * 100)
      : null;

    const totalGeneral = porCategoria.higiene.total + porCategoria.uniforme.total;
    const cumpleGeneral = porCategoria.higiene.cumple + porCategoria.uniforme.cumple;
    const generalPorcentaje = totalGeneral ? Math.round((cumpleGeneral / totalGeneral) * 100) : null;

    let clasificacion = null;
    if (generalPorcentaje !== null) {
      if (generalPorcentaje >= 90) clasificacion = 'Excelente';
      else if (generalPorcentaje >= 75) clasificacion = 'Aceptable';
      else clasificacion = 'Deficiente';
    }

    return { higienePorcentaje, uniformePorcentaje, generalPorcentaje, clasificacion };
  }

  async obtenerUltimoHash() {
    const ultima = await this.prisma.evaluacion.findFirst({
      orderBy: { creadoEn: 'desc' },
      select: { hashIntegridad: true },
    });
    return ultima?.hashIntegridad || null;
  }

  async crear({ datos, detalles, parametros, evaluadorId, creadoPorId }) {
    const { higienePorcentaje, uniformePorcentaje, generalPorcentaje, clasificacion } =
      this.calcularPorcentajes(detalles, parametros);

    const hashAnterior = await this.obtenerUltimoHash();

    const evaluacion = await this.prisma.evaluacion.create({
      data: {
        fecha: datos.fecha,
        trabajadorId: datos.trabajadorId,
        areaId: datos.areaId,
        evaluadorId,
        creadoPorId,
        higienePorcentaje,
        uniformePorcentaje,
        generalPorcentaje,
        clasificacion,
        colorEsperado: datos.colorEsperado || null,
        colorObservado: datos.colorObservado || null,
        cumplimientoColor: datos.cumplimientoColor || null,
        observaciones: datos.observaciones || null,
        hashAnterior,
        detalles: {
          create: detalles.map((d) => ({
            parametroId: d.parametroId,
            resultado: d.resultado,
          })),
        },
      },
      include: { detalles: true },
    });

    const hashIntegridad = await sha256Hex(contenidoEvaluacionParaHash(evaluacion));
    await this.prisma.evaluacion.update({
      where: { id: evaluacion.id },
      data: { hashIntegridad },
    });

    return { ...evaluacion, hashIntegridad };
  }

  async anular(id, { motivo, usuarioId }) {
    return this.prisma.evaluacion.update({
      where: { id },
      data: {
        estado: 'ANULADA',
        anuladoEn: new Date(),
        anuladoPorId: usuarioId,
        motivoAnulacion: motivo,
      },
    });
  }

  /** Recalcula toda la cadena y compara contra lo almacenado — para el panel de integridad. */
  async verificarIntegridadCompleta() {
    const evaluaciones = await this.prisma.evaluacion.findMany({ orderBy: { creadoEn: 'asc' } });
    let anterior = null;
    const problemas = [];

    for (const ev of evaluaciones) {
      if (ev.hashAnterior !== anterior) {
        problemas.push({ id: ev.id, motivo: 'Encadenamiento roto (hashAnterior no coincide)' });
      }
      const hashEsperado = await sha256Hex(contenidoEvaluacionParaHash({ ...ev, hashAnterior: anterior }));
      if (hashEsperado !== ev.hashIntegridad) {
        problemas.push({ id: ev.id, motivo: 'El contenido no coincide con su hash almacenado' });
      }
      anterior = ev.hashIntegridad;
    }

    return { ok: problemas.length === 0, problemas, totalVerificado: evaluaciones.length };
  }
}
