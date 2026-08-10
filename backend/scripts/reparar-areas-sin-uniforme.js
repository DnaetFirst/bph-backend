import { prisma } from '../src-node/prisma.js';
import { areaExcluyeUniforme } from '../src-node/utils/areaRules.js';
import { contenidoEvaluacionParaHash, sha256Hex } from '../src-node/utils/crypto.js';

function calcularDesdeHigiene(detalles) {
  const aplicables = detalles.filter((detalle) =>
    detalle.parametro?.categoria === 'higiene' && detalle.resultado !== 'No aplica'
  );
  const cumple = aplicables.filter((detalle) => detalle.resultado === 'Cumple').length;
  const generalPorcentaje = aplicables.length
    ? Math.round((cumple / aplicables.length) * 100)
    : null;

  let clasificacion = null;
  if (generalPorcentaje !== null) {
    if (generalPorcentaje >= 90) clasificacion = 'Excelente';
    else if (generalPorcentaje >= 75) clasificacion = 'Aceptable';
    else clasificacion = 'Deficiente';
  }
  return { higienePorcentaje: generalPorcentaje, generalPorcentaje, clasificacion };
}

async function reparar() {
  const areas = await prisma.area.findMany({ select: { id: true, nombre: true } });
  const areaIds = areas.filter((area) => areaExcluyeUniforme(area.nombre)).map((area) => area.id);
  if (areaIds.length === 0) {
    console.log('[reparación uniforme] No se encontraron áreas objetivo.');
    return;
  }

  const cantidadCambios = await prisma.$transaction(async (tx) => {
    // Evita que una evaluación nueva se inserte mientras se reconstruye la cadena.
    await tx.$executeRawUnsafe('LOCK TABLE "Evaluacion" IN EXCLUSIVE MODE');
    const evaluaciones = await tx.evaluacion.findMany({
      where: { areaId: { in: areaIds } },
      include: { detalles: { include: { parametro: true } } },
      orderBy: { creadoEn: 'asc' },
    });
    const cambios = evaluaciones.map((evaluacion) => ({
      evaluacion,
      porcentajes: calcularDesdeHigiene(evaluacion.detalles),
      tieneDetalleUniforme: evaluacion.detalles.some((detalle) => detalle.parametro?.categoria === 'uniforme'),
    })).filter(({ evaluacion, porcentajes, tieneDetalleUniforme }) =>
      tieneDetalleUniforme ||
      evaluacion.colorEsperado !== null ||
      evaluacion.colorObservado !== null ||
      evaluacion.cumplimientoColor !== null ||
      evaluacion.uniformePorcentaje !== null ||
      evaluacion.higienePorcentaje !== porcentajes.higienePorcentaje ||
      evaluacion.generalPorcentaje !== porcentajes.generalPorcentaje ||
      evaluacion.clasificacion !== porcentajes.clasificacion
    );
    if (cambios.length === 0) return 0;

    for (const { evaluacion, porcentajes } of cambios) {
      await tx.detalleEvaluacion.deleteMany({
        where: { evaluacionId: evaluacion.id, parametro: { categoria: 'uniforme' } },
      });
      await tx.evaluacion.update({
        where: { id: evaluacion.id },
        data: {
          ...porcentajes,
          uniformePorcentaje: null,
          colorEsperado: null,
          colorObservado: null,
          cumplimientoColor: null,
        },
      });
    }

    const cadena = await tx.evaluacion.findMany({ orderBy: { creadoEn: 'asc' } });
    let hashAnterior = null;
    for (const evaluacion of cadena) {
      const hashIntegridad = await sha256Hex(
        contenidoEvaluacionParaHash({ ...evaluacion, hashAnterior })
      );
      await tx.evaluacion.update({
        where: { id: evaluacion.id },
        data: { hashAnterior, hashIntegridad },
      });
      hashAnterior = hashIntegridad;
    }
    return cambios.length;
  }, { maxWait: 10_000, timeout: 120_000 });

  if (cantidadCambios === 0) {
    console.log('[reparación uniforme] Los datos históricos ya están corregidos.');
    return;
  }
  console.log(`[reparación uniforme] ${cantidadCambios} evaluaciones corregidas y cadena recalculada.`);
}

try {
  await reparar();
} finally {
  await prisma.$disconnect();
}
