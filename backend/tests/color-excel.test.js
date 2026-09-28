import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { colorEsperadoParaArea, resolverColor } from '../src-node/utils/colorUniforme.js';
import { colorEsperadoParaArea as colorFrontend } from '../../frontend/src/utils/colorUniforme.js';
import { calcularProgreso } from '../../frontend/src/utils/evaluacion.js';
import { EvaluacionService } from '../src-node/services/evaluacionService.js';
import { generarExcel, ordenExcel } from '../src-node/services/exportacionExcel.js';
import { resumenEvaluaciones } from '../src-node/utils/resumenEvaluaciones.js';

test('regla de lunes a viernes excepto las dos áreas excluidas, igual en cliente y servidor', () => {
  for (const area of ['PH', 'Almacén', 'Área nueva']) {
    for (const [i, esperado] of ['Rojo', 'Amarillo', 'Verde', 'Rojo', 'Amarillo', null, null].entries()) {
      const fecha = new Date(Date.UTC(2026, 8, 28 + i));
      assert.equal(colorEsperadoParaArea(area, fecha), esperado);
      assert.equal(colorFrontend(area, fecha), esperado);
    }
  }
  assert.equal(resolverColor('Producción', '2026-09-28', 'Verde').cumplimientoColor, null);
  for (const area of ['Producción', ' PRODUCCION ', 'Calidad e inocuidad']) {
    assert.equal(colorEsperadoParaArea(area, '2026-09-28'), null);
    assert.equal(colorFrontend(area, '2026-09-28'), null);
  }
  assert.equal(resolverColor('PH', '2026-09-26').cumplimientoColor, null);
  assert.throws(() => resolverColor('Área nueva', '2026-09-28', ''), { status: 400 });
});

test('color pesa un criterio y No aplica no altera el denominador', () => {
  const params = Array.from({ length: 7 }, (_, i) => ({ id: i, categoria: 'higiene' }));
  for (const resultado of ['Cumple', 'No cumple', 'No aplica']) {
    for (const color of ['Cumple', 'No cumple', null]) {
      const detalles = params.map(p => ({ parametroId: p.id, resultado }));
      const server = new EvaluacionService({}).calcularPorcentajes(detalles, params, color);
      assert.equal(calcularProgreso(params, Object.fromEntries(params.map(p => [p.id, resultado])), color).porcentaje, server.generalPorcentaje);
      if (resultado === 'Cumple' && color === 'No cumple') assert.equal(server.generalPorcentaje, 88);
    }
  }
});

test('dashboard excluye colores antiguos de otras áreas y fines de semana', () => {
  const base = { estado: 'ACTIVA', fecha: '2026-09-28', colorEsperado: 'Rojo', cumplimientoColor: 'Cumple' };
  const result = resumenEvaluaciones([
    { ...base, area: { nombre: 'Producción' } },
    { ...base, fecha: '2026-09-26', area: { nombre: 'Producción' } },
    { ...base, cumplimientoColor: 'No cumple', area: { nombre: 'PH' } },
  ]);
  assert.equal(result.cumplimientoColorPorcentaje, 0);
});

test('Excel ordena fechas reales ascendentemente y conserva solo las columnas originales', () => {
  assert.deepEqual(ordenExcel, [{ fecha: 'asc' }, { creadoEn: 'asc' }, { id: 'asc' }]);
  const fechas = ['2026-09-28', '2026-09-26', '2026-09-27', '2025-12-31'];
  const filas = fechas.map((fecha, i) => ({ id: String(i), creadoEn: new Date(i), fecha, area: { nombre: 'Producción' },
    generalPorcentaje: 88, uniformePorcentaje: 0, colorObservado: 'Verde', cumplimientoColor: 'No cumple' }));
  const wb = XLSX.read(generarExcel(filas), { type: 'buffer', cellDates: true });
  const ws = wb.Sheets.Evaluaciones;
  const datos = XLSX.utils.sheet_to_json(ws);
  assert.deepEqual(datos.map(d => d.Fecha.toISOString().slice(0, 10)), [...fechas].sort());
  assert.equal(datos.at(-1)['Indicador BPH'], '88%');
  assert.deepEqual(Object.keys(datos[0]), ['Fecha', 'Trabajador', 'Área', 'Clasificación', 'Indicador BPH', 'Evaluador', 'Observación']);
  assert.equal(ws.A2.t, 'd');
  assert.ok(XLSX.read(generarExcel([]), { type: 'buffer' }).Sheets.Evaluaciones.A1);
});
