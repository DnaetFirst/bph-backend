// ============================================================================
// evaluacionService — guarda evaluaciones, calcula porcentajes y mantiene
// el hash encadenado de integridad (mismo esquema que la versión localStorage,
// recalculado desde el servidor en vez del navegador).
// ============================================================================

import { sha256Hex, contenidoEvaluacionParaHash } from '../utils/crypto.js';
import { areaExcluyeUniforme, parametroExcluidoEnArea } from '../utils/areaRules.js';

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
    const area = await this.prisma.area.findUnique({
      where: { id: datos.areaId },
      select: { nombre: true },
    });
    if (!area) {
      const error = new Error('Área no encontrada');
      error.status = 404;
      throw error;
    }

    const sinUniforme = areaExcluyeUniforme(area.nombre);
    const parametrosPorId = new Map(parametros.map((parametro) => [parametro.id, parametro]));
    const detallesAplicables = detalles.filter((detalle) => {
      const parametro = parametrosPorId.get(detalle.parametroId);
      if (!parametro) return false;
      if (sinUniforme && parametro.categoria === 'uniforme') return false;
      return !parametroExcluidoEnArea(parametro, area.nombre);
    });

    if (detallesAplicables.length === 0) {
      const error = new Error('La evaluación debe incluir al menos un parámetro aplicable al área');
      error.status = 400;
      throw error;
    }

    const { higienePorcentaje, uniformePorcentaje, generalPorcentaje, clasificacion } =
      this.calcularPorcentajes(detallesAplicables, parametros);

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
        colorEsperado: sinUniforme ? null : (datos.colorEsperado || null),
        colorObservado: sinUniforme ? null : (datos.colorObservado || null),
        cumplimientoColor: sinUniforme ? null : (datos.cumplimientoColor || null),
        observaciones: datos.observaciones || null,
        hashAnterior,
        detalles: {
          create: detallesAplicables.map((d) => ({
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

  async editar(id, { datos, detalles, parametros, usuarioId, ip }) {
    return this.prisma.$transaction(async (tx) => {
      // Impide inserciones concurrentes mientras se reconstruye la cadena.
      await tx.$executeRawUnsafe('LOCK TABLE "Evaluacion" IN EXCLUSIVE MODE');

      const existente = await tx.evaluacion.findUnique({
        where: { id },
        include: { area: { select: { nombre: true } } },
      });
      if (!existente) {
        const error = new Error('Evaluación no encontrada');
        error.status = 404;
        throw error;
      }
      if (existente.estado === 'ANULADA') {
        const error = new Error('No se puede editar una evaluación anulada');
        error.status = 400;
        throw error;
      }

      const sinUniforme = areaExcluyeUniforme(existente.area.nombre);
      const parametrosPorId = new Map(parametros.map((parametro) => [parametro.id, parametro]));
      const detallesAplicables = detalles.filter((detalle) => {
        const parametro = parametrosPorId.get(detalle.parametroId);
        if (!parametro) return false;
        if (sinUniforme && parametro.categoria === 'uniforme') return false;
        return !parametroExcluidoEnArea(parametro, existente.area.nombre);
      });
      if (detallesAplicables.length === 0) {
        const error = new Error('La evaluación debe incluir al menos un parámetro aplicable al área');
        error.status = 400;
        throw error;
      }

      const porcentajes = this.calcularPorcentajes(detallesAplicables, parametros);
      await tx.detalleEvaluacion.deleteMany({ where: { evaluacionId: id } });
      const actualizada = await tx.evaluacion.update({
        where: { id },
        data: {
          ...porcentajes,
          colorEsperado: sinUniforme ? null : (datos.colorEsperado || null),
          colorObservado: sinUniforme ? null : (datos.colorObservado || null),
          cumplimientoColor: sinUniforme ? null : (datos.cumplimientoColor || null),
          observaciones: datos.observaciones || null,
          detalles: {
            create: detallesAplicables.map((detalle) => ({
              parametroId: detalle.parametroId,
              resultado: detalle.resultado,
            })),
          },
        },
        include: {
          detalles: true,
          trabajador: { select: { id: true, nombre: true } },
          area: { select: { id: true, nombre: true } },
          evaluador: { select: { id: true, nombre: true } },
        },
      });

      const cadena = await tx.evaluacion.findMany({ orderBy: { creadoEn: 'asc' } });
      const indiceEditado = cadena.findIndex((evaluacion) => evaluacion.id === id);
      let hashAnterior = indiceEditado > 0 ? cadena[indiceEditado - 1].hashIntegridad : null;
      let hashEditado = null;
      for (const evaluacion of cadena.slice(indiceEditado)) {
        const hashIntegridad = await sha256Hex(
          contenidoEvaluacionParaHash({ ...evaluacion, hashAnterior })
        );
        await tx.evaluacion.update({
          where: { id: evaluacion.id },
          data: { hashAnterior, hashIntegridad },
        });
        if (evaluacion.id === id) hashEditado = hashIntegridad;
        hashAnterior = hashIntegridad;
      }

      await tx.bitacora.create({
        data: {
          accion: 'Editar evaluación',
          usuarioId,
          ip: ip || null,
          detalles: `Evaluación ID: ${actualizada.id}. General: ${existente.generalPorcentaje ?? 'N/A'}% → ${actualizada.generalPorcentaje ?? 'N/A'}%`,
        },
      });

      return { evaluacion: { ...actualizada, hashIntegridad: hashEditado } };
    }, { maxWait: 10_000, timeout: 120_000 });
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

  async eliminar(id, { usuarioId }) {
    const evaluacionAEliminar = await this.prisma.evaluacion.findUnique({
      where: { id },
      select: { creadoEn: true }
    });

    if (!evaluacionAEliminar) return null;

    // Eliminar físicamente
    await this.prisma.evaluacion.delete({
      where: { id }
    });

    // Recalcular la cadena criptográfica desde este punto en adelante
    const evaluacionesAfectadas = await this.prisma.evaluacion.findMany({
      where: { creadoEn: { gt: evaluacionAEliminar.creadoEn } },
      orderBy: { creadoEn: 'asc' }
    });

    // Encontrar el último hash íntegro antes de los afectados
    const ultimaIntegra = await this.prisma.evaluacion.findFirst({
      where: { creadoEn: { lt: evaluacionAEliminar.creadoEn } },
      orderBy: { creadoEn: 'desc' },
      select: { hashIntegridad: true }
    });

    let hashAnterior = ultimaIntegra ? ultimaIntegra.hashIntegridad : null;

    for (const ev of evaluacionesAfectadas) {
      const nuevoHashIntegridad = await sha256Hex(contenidoEvaluacionParaHash({ ...ev, hashAnterior }));
      
      await this.prisma.evaluacion.update({
        where: { id: ev.id },
        data: {
          hashAnterior,
          hashIntegridad: nuevoHashIntegridad
        }
      });
      
      hashAnterior = nuevoHashIntegridad;
    }

    return true;
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
