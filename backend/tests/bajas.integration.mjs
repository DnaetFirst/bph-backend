// Ejecutar exclusivamente en una base local aislada previamente migrada.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PrismaClient } from '../generated/node-client/index.js';
import { guardar, cambiarEstado } from '../src-node/modules/bajas/catalogos.js';
import { sembrarCatalogos } from '../src-node/modules/bajas/seed.js';
import { crearRouterBajas } from '../src-node/modules/bajas/routes.js';
import { AuthService } from '../src-node/services/authService.js';
const url = new URL(process.env.BAJAS_TEST_DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || !url.pathname.endsWith('_test')) throw new Error('BAJAS_TEST_DATABASE_URL debe señalar una base local terminada en _test');
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
const tag = `${Date.now()}`;
test('Bajas: integración PostgreSQL y API con datos aislados', async t => {
  let server;
  try {
    const usuarios = {};
    for (const rol of ['administrador', 'supervisor', 'evaluador']) usuarios[rol] = await db.usuario.create({ data: { nombre: `${rol}-${tag}`, email: `${rol}-${tag}@example.test`, rol, hashPin: 'test-only' } });
    const actor = usuarios.administrador.id;
    await sembrarCatalogos(db);
    const unidad = await db.unidadMedida.findFirst({ where: { nombre: 'Unidades' } });
    const baseCat = { nombre: `Categoría ${tag}`, orden: 0, etiquetaTipo: 'Tipo', requiereTipo: false, requiereProveedor: false };
    let cat, prod;
    await t.test('semillas repetibles: cero bajas y no restauran opciones modificadas', async () => {
      const antes = await db.productoBaja.count();
      const bajasAntes = await db.bajaProducto.count();
      const motivo = await db.motivoBaja.findUnique({ where: { clave: 'otro' } });
      if (motivo.activo) await cambiarEstado(db, 'motivos', motivo.id, { version: motivo.version, motivo: 'Verificar semilla' }, actor, false);
      await sembrarCatalogos(db);
      assert.equal(await db.productoBaja.count(), antes);
      assert.equal((await db.motivoBaja.findUnique({ where: { id: motivo.id } })).activo, false);
      assert.equal(await db.bajaProducto.count(), bajasAntes);
    });
    await t.test('producto y presentación inicial se crean atómicamente con auditoría', async () => {
      cat = await guardar(db, 'categorias', baseCat, actor);
      prod = await guardar(db, 'productos', { nombre: `Producto ${tag}`, categoriaId: cat.id, tipoId: null, presentacion: { nombre: 'Unidad', unidadId: unidad.id } }, actor);
      assert.equal(await db.presentacionProducto.count({ where: { productoId: prod.id, predeterminada: true } }), 1);
      assert.equal(await db.eventoAuditoriaBajas.count({ where: { entidad: 'productos', entidadId: String(prod.id) } }), 1);
    });
    await t.test('renombrar una opción inicial no la duplica al repetir semillas', async () => {
      const semilla = await db.motivoBaja.findFirst({ where: { semilla: { not: null }, nombre: 'Error de producción' } });
      if (!semilla) return;
      const count = await db.motivoBaja.count();
      await guardar(db, 'motivos', { nombre: `Error de producción ${tag}`, explicacionObligatoria: false, todasCategorias: true, categoriaIds: [], version: semilla.version, motivoCambio: 'Ajustar nombre inicial' }, actor, semilla.id);
      await sembrarCatalogos(db);
      assert.equal(await db.motivoBaja.count(), count);
      assert.equal((await db.motivoBaja.findUnique({ where: { id: semilla.id } })).nombre, `Error de producción ${tag}`);
    });
    await t.test('auditoría fallida revierte el catálogo creado', async () => {
      await assert.rejects(guardar(db, 'categorias', { ...baseCat, nombre: `Rollback ${tag}` }, 2147483647));
      assert.equal(await db.categoriaProducto.count({ where: { nombre: `Rollback ${tag}` } }), 0);
    });
    await t.test('duplicados simultáneos: una sola alta', async () => {
      const results = await Promise.allSettled([guardar(db, 'categorias', { ...baseCat, nombre: `Duplicado ${tag}` }, actor), guardar(db, 'categorias', { ...baseCat, nombre: `Duplicado ${tag}` }, actor)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    });
    await t.test('dos ediciones con la misma versión no sobrescriben datos', async () => {
      const payload = { ...baseCat, version: cat.version, motivoCambio: 'Cambio concurrente' };
      const results = await Promise.allSettled([guardar(db, 'categorias', { ...payload, orden: 2 }, actor, cat.id), guardar(db, 'categorias', { ...payload, orden: 3 }, actor, cat.id)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
      cat = await db.categoriaProducto.findUnique({ where: { id: cat.id } });
    });
    await t.test('desactivar/restaurar conserva identidades e historial', async () => {
      const off = await cambiarEstado(db, 'categorias', cat.id, { version: cat.version, motivo: 'Pausa temporal' }, actor, false);
      await assert.rejects(guardar(db, 'productos', { nombre: 'No permitido', categoriaId: cat.id, tipoId: null, presentacion: { nombre: 'Unidad', unidadId: unidad.id } }, actor), { status: 422 });
      assert.equal((await db.productoBaja.findUnique({ where: { id: prod.id } })).activo, true);
      cat = await cambiarEstado(db, 'categorias', cat.id, { version: off.version, motivo: 'Reabrir categoría' }, actor, true);
      assert.equal(await db.eventoAuditoriaBajas.count({ where: { entidad: 'categorias', entidadId: String(cat.id) } }), 4);
    });
    await t.test('unidad dependiente no se desactiva; última presentación no se elimina', async () => {
      await assert.rejects(cambiarEstado(db, 'unidades', unidad.id, { version: unidad.version, motivo: 'No debe pasar' }, actor, false), { status: 422 });
      const p = await db.presentacionProducto.findFirst({ where: { productoId: prod.id } });
      await assert.rejects(cambiarEstado(db, 'presentaciones', p.id, { version: p.version, motivo: 'No debe pasar' }, actor, false), { status: 422 });
    });
    await t.test('nueva predeterminada sustituye la anterior con auditoría', async () => {
      const nueva = await guardar(db, 'presentaciones', { nombre: 'Otra presentación', productoId: prod.id, unidadId: unidad.id, predeterminada: true }, actor);
      assert.equal(await db.presentacionProducto.count({ where: { productoId: prod.id, predeterminada: true } }), 1);
      assert.equal((await db.presentacionProducto.findUnique({ where: { id: nueva.id } })).predeterminada, true);
    });
    await t.test('auditoría no admite UPDATE ni DELETE', async () => {
      const ev = await db.eventoAuditoriaBajas.findFirst();
      await assert.rejects(db.eventoAuditoriaBajas.update({ where: { id: ev.id }, data: { motivo: 'alterado' } }));
      await assert.rejects(db.eventoAuditoriaBajas.delete({ where: { id: ev.id } }));
    });
    const auth = new AuthService(db, { jwtSecret: 'secret-test-only-long-enough', jwtExpirationSeconds: 3600 });
    const tokens = {};
    for (const [rol, u] of Object.entries(usuarios)) tokens[rol] = await auth.crearToken({ id: u.id, rol });
    const app = express(); app.use(express.json());
    app.use('/bajas', crearRouterBajas(db, async (req, res, next) => {
      try { req.usuario = await auth.verificarSesion(req.headers.authorization?.replace('Bearer ', '') || ''); next(); }
      catch { res.status(401).json({ error: 'No autenticado' }); }
    }, () => true));
    app.use((e, req, res, next) => res.status(e.status || (e.code === 'P2002' ? 409 : 500)).json({ error: e.message }));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/bajas`;
    const request = (path, rol, method = 'GET', body) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(rol ? { Authorization: `Bearer ${tokens[rol]}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    await t.test('API exige sesión y acceso explícito al módulo', async () => {
      assert.equal((await request('/catalogos/productos')).status, 401);
      assert.equal((await request('/catalogos/productos', 'supervisor')).status, 403);
      assert.equal((await request('/catalogos/productos', 'administrador')).status, 200);
      for (const rol of ['supervisor', 'evaluador']) assert.equal((await request(`/accesos/${usuarios[rol].id}`, 'administrador', 'PUT', { activo: true, version: 0, motivo: 'Autorizar prueba' })).status, 200);
    });
    await t.test('registrador no administra ni ve inactivos; supervisor no concede acceso', async () => {
      assert.equal((await request('/catalogos/categorias', 'evaluador', 'POST', baseCat)).status, 403);
      assert.equal((await request('/catalogos/productos?estado=inactivos', 'evaluador')).status, 403);
      assert.equal((await request('/accesos', 'supervisor')).status, 403);
      assert.equal((await request('/catalogos/productos', 'supervisor')).status, 200);
    });
    await t.test('revocación inmediata y usuario inactivo invalidan acceso', async () => {
      await request(`/accesos/${usuarios.evaluador.id}`, 'administrador', 'PUT', { activo: false, version: 1, motivo: 'Retirar prueba' });
      assert.equal((await request('/catalogos/productos', 'evaluador')).status, 403);
      await db.usuario.update({ where: { id: usuarios.supervisor.id }, data: { activo: false } });
      assert.equal((await request('/catalogos/productos', 'supervisor')).status, 401);
    });
    await t.test('paginación y filtros rechazan parámetros manipulados', async () => {
      assert.equal((await request('/catalogos/productos?porPagina=101', 'administrador')).status, 400);
      const data = await (await request('/catalogos/productos?porPagina=2', 'administrador')).json();
      assert.equal(data.items.length, 2); assert.ok(data.total > 2);
      assert.equal((await request('/catalogos/inventado', 'administrador')).status, 404);
    });
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await db.$disconnect(); }
});
