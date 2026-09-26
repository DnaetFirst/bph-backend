import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrosEvaluaciones, paginacion } from '../src-node/utils/evaluacionFilters.js';
import { resumenEvaluaciones } from '../src-node/utils/resumenEvaluaciones.js';
import { EvaluacionService } from '../src-node/services/evaluacionService.js';
import { calcularProgreso, clasificar } from '../../frontend/src/utils/evaluacion.js';

test('rango inclusivo conserva ambas fechas, estado y evaluador en listado y exportación', () => {
  const where = filtrosEvaluaciones({ fechaDesde: '2026-08-01', fechaHasta: '2026-08-10', estado: 'ANULADA', evaluadorId: '3' });
  assert.equal(where.fecha.gte.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(where.fecha.lte.toISOString(), '2026-08-10T23:59:59.999Z');
  assert.equal(where.estado, 'ANULADA');
  assert.equal(where.evaluadorId, 3);
  assert.deepEqual(filtrosEvaluaciones({ estado: '' }), {});
});

test('filtros inválidos producen errores 400, no errores de base de datos', () => {
  for (const query of [{ areaId: 'x' }, { evaluadorId: '-1' }, { fechaDesde: '2026-02-30' },
    { fechaDesde: '2026-08-10', fechaHasta: '2026-08-01' }, { estado: 'inventado' }, { fechaDesde: ['2026-01-01'] }]) {
    assert.throws(() => filtrosEvaluaciones(query), { status: 400 });
  }
  assert.throws(() => paginacion({ pagina: 1.5 }), { status: 400 });
  assert.deepEqual(paginacion({ porPagina: 500 }), { pagina: 1, porPagina: 100 });
});

test('búsqueda se aplica al servidor en trabajador, evaluador y clasificación', () => {
  assert.equal(filtrosEvaluaciones({ q: ' Ana ' }).OR[0].trabajador.nombre.contains, 'Ana');
  assert.equal(filtrosEvaluaciones({ q: 'Ana' }).OR.length, 3);
});

const ev = (id, extra = {}) => ({ id: String(id), fecha: new Date('2026-08-10'), creadoEn: new Date(1000 + id),
  trabajadorId: id, trabajador: { nombre: 'Mismo nombre' }, estado: 'ACTIVA', generalPorcentaje: 100,
  higienePorcentaje: 100, uniformePorcentaje: null, clasificacion: 'Excelente', ...extra });

test('indicadores contemplan más de una página y excluyen N/A de los promedios', () => {
  const items = Array.from({ length: 25 }, (_, i) => ev(i));
  items[0].uniformePorcentaje = 80;
  items[1].generalPorcentaje = null;
  const result = resumenEvaluaciones(items);
  assert.equal(result.totalItems, 25);
  assert.equal(result.promedioUniforme, 80);
  assert.equal(result.promedioGeneral, 100);
  assert.equal(result.topTrabajadores.length, 5);
  assert.equal(new Set(result.topTrabajadores.map(t => t.id)).size, 5);
  assert.equal(result.tendencia.at(-1).id, '24');
});

test('sin datos no se presenta un falso 0% y anuladas no alteran indicadores activos', () => {
  const result = resumenEvaluaciones([ev(1, { estado: 'ANULADA' })]);
  assert.equal(result.totalItems, 0);
  assert.equal(result.promedioGeneral, null);
  assert.equal(result.cumplimientoColorPorcentaje, null);
});

test('color solo considera registros con resultado registrado y color aplicable', () => {
  const result = resumenEvaluaciones([
    ev(1, { colorEsperado: 'Rojo', cumplimientoColor: 'Cumple' }),
    ev(2, { colorEsperado: 'Rojo', cumplimientoColor: 'No cumple' }),
    ev(3, { colorEsperado: 'Rojo', cumplimientoColor: null }),
    ev(4, { cumplimientoColor: 'Cumple' }),
  ]);
  assert.equal(result.cumplimientoColorPorcentaje, 50);
});

test('vista previa coincide con servidor para N/A, ceros y clasificación', () => {
  const parametros = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, categoria: i < 4 ? 'higiene' : 'uniforme' }));
  const service = new EvaluacionService({});
  for (const resultados of [
    ['Cumple', 'Cumple', 'Cumple', 'No cumple', 'No aplica', 'No aplica', 'No aplica', 'No aplica'],
    Array(8).fill('No aplica'), Array(8).fill('No cumple'), Array(8).fill('Cumple'),
  ]) {
    const detalles = resultados.map((resultado, i) => ({ parametroId: i + 1, resultado }));
    const server = service.calcularPorcentajes(detalles, parametros);
    const preview = calcularProgreso(parametros, Object.fromEntries(detalles.map(d => [d.parametroId, d.resultado])));
    assert.equal(preview.porcentaje, server.generalPorcentaje);
    assert.equal(clasificar(preview.porcentaje), server.clasificacion ?? 'N/A');
  }
  assert.equal(clasificar(74), 'Deficiente');
  assert.equal(clasificar(75), 'Aceptable');
  assert.equal(clasificar(90), 'Excelente');
});

test('rechaza formularios parciales y parámetros repetidos; respeta exclusiones de área', () => {
  const service = new EvaluacionService({});
  const parametros = [{ id: 1, categoria: 'higiene' }, { id: 2, categoria: 'uniforme' }];
  assert.throws(() => service.validarDetalles([{ parametroId: 1 }], parametros, 'PH'), { status: 400 });
  assert.throws(() => service.validarDetalles([{ parametroId: 1 }, { parametroId: 1 }], parametros, 'Producción'), { status: 400 });
  assert.doesNotThrow(() => service.validarDetalles([{ parametroId: 1 }], parametros, 'Producción'));
  assert.doesNotThrow(() => service.validarDetalles([{ parametroId: 1 }, { parametroId: 2 }], parametros, 'PH'));
});

function database() {
  let rows = [];
  let locked = false;
  const tx = {
    $executeRawUnsafe: async () => { locked = true; },
    area: { findUnique: async () => ({ nombre: 'PH', activo: true }) },
    trabajador: { findUnique: async () => ({ activo: true }) },
    evaluacion: {
      findFirst: async () => rows.at(-1) || null,
      findUnique: async ({ where }) => rows.find(r => r.id === where.id),
      findMany: async () => [...rows],
      create: async ({ data }) => {
        assert.equal(locked, true, 'se debe bloquear antes de leer/escribir la cadena');
        const row = { ...data, id: `id-${rows.length + 1}`, estado: 'ACTIVA' };
        rows.push(row); return row;
      },
      update: async ({ where, data }) => {
        const row = rows.find(r => r.id === where.id); Object.assign(row, data); return row;
      },
      delete: async ({ where }) => { assert.equal(locked, true); rows = rows.filter(r => r.id !== where.id); },
    },
  };
  const db = { ...tx, $transaction: async callback => {
    const saved = structuredClone(rows);
    try { return await callback(tx); } catch (err) { rows = saved; throw err; } finally { locked = false; }
  } };
  return { db, tx };
}

test('crear y eliminar preservan cadena completa dentro de transacciones', async () => {
  const { db } = database();
  const service = new EvaluacionService(db);
  const args = { datos: { fecha: new Date('2026-08-10'), trabajadorId: 1, areaId: 1 },
    detalles: [{ parametroId: 1, resultado: 'Cumple' }], parametros: [{ id: 1, categoria: 'higiene' }], evaluadorId: 1, creadoPorId: 1 };
  await service.crear(args); await service.crear(args); await service.crear(args);
  assert.equal((await service.verificarIntegridadCompleta()).ok, true);
  await service.eliminar('id-2');
  const result = await service.verificarIntegridadCompleta();
  assert.equal(result.ok, true); assert.equal(result.totalVerificado, 2);
});

test('un fallo al generar el hash revierte la creación', async () => {
  const { db, tx } = database();
  tx.evaluacion.update = async () => { throw new Error('Fallo simulado'); };
  const service = new EvaluacionService(db);
  await assert.rejects(service.crear({ datos: { fecha: new Date(), trabajadorId: 1, areaId: 1 },
    detalles: [{ parametroId: 1, resultado: 'Cumple' }], parametros: [{ id: 1, categoria: 'higiene' }], evaluadorId: 1, creadoPorId: 1 }), /Fallo simulado/);
  assert.equal((await service.verificarIntegridadCompleta()).totalVerificado, 0);
});
