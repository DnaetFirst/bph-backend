import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, validar } from '../src-node/modules/bajas/catalogos.js';
test('catálogos normalizan nombres sin fusionar acentos', () => {
  assert.equal(normalizar('  CORTE   Fino '), 'corte fino');
  assert.notEqual(normalizar('papa'), normalizar('papá'));
});
test('catálogos rechazan campos de privilegios y precisiones inválidas', () => {
  assert.throws(() => validar('unidades', { nombre: 'Kg', abreviatura: 'kg', decimales: 4 }, true), { status: 400 });
  assert.throws(() => validar('unidades', { nombre: 'Kg', abreviatura: 'kg', decimales: 2, activo: false }, true), { status: 400 });
  assert.throws(() => validar('productos', { nombre: 'Corte', categoriaId: 1, tipoId: null }, true), { status: 422 });
  assert.throws(() => validar('motivos', { nombre: 'Otro', explicacionObligatoria: true, todasCategorias: false, categoriaIds: [] }, true), { status: 422 });
});
