import { resolverColor } from '../utils/colorUniforme.js';
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

  validarDetalles(detalles, parametros, nombreArea) {
    const aplicables = parametros.filter(p =>
      !(areaExcluyeUniforme(nombreArea) && p.categoria === 'uniforme') && !parametroExcluidoEnArea(p, nombreArea));
    const ids = new Set(detalles.map(d => d.parametroId));
    if (ids.size !== detalles.length || !aplicables.length || aplicables.some(p => !ids.has(p.id))) {
      throw Object.assign(new Error('Responde todos los parámetros aplicables sin duplicados'), { status: 400 });
    }
  }

  calcularPorcentajes(detalles, parametros, cumplimientoColor = null) {
    const porCategoria = { higiene: { total: 0, cumple: 0 }, uniforme: { total: 0, cumple: 0 } };

    for (const d of detalles) {
      const parametro = parametros.find((p) => p.id === d.parametroId);
      if (!parametro || !porCategoria[parametro.categoria] || d.resultado === 'No aplica') continue;
      const cat = porCategoria[parametro.categoria];
      cat.total += 1;
      if (d.resultado === 'Cumple') cat.cumple += 1;
    }

    if (['Cumple', 'No cumple'].includes(cumplimientoColor)) {
      porCategoria.uniforme.total += 1;
      if (cumplimientoColor === 'Cumple') porCategoria.uniforme.cumple += 1;
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
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      select: { hashIntegridad: true },
    });
    return ultima?.hashIntegridad || null;
  }

  async crear(args) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('LOCK TABLE "Evaluacion" IN EXCLUSIVE MODE');
      return new EvaluacionService(tx).crearDentroTransaccion(args);
    }, { maxWait: 10_000, timeout: 120_000 });
  }

  async crearDentroTransaccion({ datos, detalles, parametros, evaluadorId, creadoPorId }) {
    const area = await this.prisma.area.findUnique({
      where: { id: datos.areaId },
      select: { nombre: true, activo: true },
    });
    if (!area || !area.activo) {
      const error = new Error('Área no encontrada');
      error.status = 404;
      throw error;
    }

    const trabajador = await this.prisma.trabajador.findUnique({ where: { id: datos.trabajadorId } });
    if (!trabajador?.activo) throw Object.assign(new Error('Trabajador inactivo o inexistente'), { status: 400 });
    this.validarDetalles(detalles, parametros, area.nombre);

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

    const color = resolverColor(area.nombre, datos.fecha, datos.colorObservado);
    const { higienePorcentaje, uniformePorcentaje, generalPorcentaje, clasificacion } =
      this.calcularPorcentajes(detallesAplicables, parametros, color.cumplimientoColor);

    const ultima = await this.prisma.evaluacion.findFirst({
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      select: { hashIntegridad: true, creadoEn: true },
    });
    const hashAnterior = ultima?.hashIntegridad || null;
    const creadoEn = new Date(Math.max(Date.now(), ultima ? new Date(ultima.creadoEn).getTime() + 1 : 0));

    const evaluacion = await this.prisma.evaluacion.create({
      data: {
        fecha: datos.fecha,
        creadoEn,
        trabajadorId: datos.trabajadorId,
        areaId: datos.areaId,
        evaluadorId,
        creadoPorId,
        higienePorcentaje,
        uniformePorcentaje,
        generalPorcentaje,
        clasificacion,
        ...color,
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

      this.validarDetalles(detalles, parametros, existente.area.nombre);
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

      const color = resolverColor(existente.area.nombre, existente.fecha, datos.colorObservado);
      const porcentajes = this.calcularPorcentajes(detallesAplicables, parametros, color.cumplimientoColor);
      await tx.detalleEvaluacion.deleteMany({ where: { evaluacionId: id } });
      const actualizada = await tx.evaluacion.update({
        where: { id },
        data: {
          ...porcentajes,
          ...color,
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

      const cadena = await tx.evaluacion.findMany({ orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }] });
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

  async eliminar(id) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('LOCK TABLE "Evaluacion" IN EXCLUSIVE MODE');
      const existente = await tx.evaluacion.findUnique({ where: { id } });
      if (!existente) throw Object.assign(new Error('Evaluación no encontrada'), { status: 404 });
      await tx.evaluacion.delete({ where: { id } });
      const cadena = await tx.evaluacion.findMany({ orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }] });
      let hashAnterior = null;
      for (const ev of cadena) {
        const hashIntegridad = await sha256Hex(contenidoEvaluacionParaHash({ ...ev, hashAnterior }));
        await tx.evaluacion.update({ where: { id: ev.id }, data: { hashAnterior, hashIntegridad } });
        hashAnterior = hashIntegridad;
      }
      return true;
    }, { maxWait: 10_000, timeout: 120_000 });
  }

  /** Recalcula toda la cadena y compara contra lo almacenado — para el panel de integridad. */
  async verificarIntegridadCompleta() {
    const evaluaciones = await this.prisma.evaluacion.findMany({ orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }] });
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
