import { Router } from 'express';
import { z } from 'zod';
import XLSX from 'xlsx';
import { fail } from './catalogos.js';
import { crearBaja, editarBaja, anularBaja, filtrosBajas, resumenBajas, esGestor } from './bajasService.js';
export function operacionesBajas(db) {
  const router = Router();
  const run = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const idValido = id => { if (!z.string().uuid().safeParse(id).success) fail('Identificador inválido', 400); return id; };
  router.get('/responsables', run(async (req, res) => {
    if (!esGestor(req.usuario)) fail('No autorizado', 403);
    const rows = await db.usuario.findMany({ where: { BajaProducto_creador: { some: {} } }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });
    res.json(rows);
  }));
  router.get('/', run(async (req, res) => {
    const f = filtrosBajas(req.query, req.usuario);
    const [items, total] = await db.$transaction([
      db.bajaProducto.findMany({ where: f.where, orderBy: [{ fechaOperativa: 'desc' }, { creadoEn: 'desc' }, { id: 'desc' }], skip: (f.pagina - 1) * f.porPagina, take: f.porPagina }),
      db.bajaProducto.count({ where: f.where }),
    ], { isolationLevel: 'RepeatableRead' });
    res.json({ items, total, pagina: f.pagina, porPagina: f.porPagina });
  }));
  router.get('/resumen', run(async (req, res) => res.json(await resumenBajas(db, filtrosBajas(req.query, req.usuario).where))));
  router.get('/imprimir', run(async (req, res) => {
    if (!esGestor(req.usuario)) fail('Solo supervisor y administrador pueden imprimir', 403);
    const f = filtrosBajas(req.query, req.usuario);
    const items = await db.bajaProducto.findMany({ where: f.where, orderBy: [{ fechaOperativa: 'asc' }, { creadoEn: 'asc' }, { id: 'asc' }], take: 1001 });
    if (items.length > 1000) fail('Para imprimir, reduce el filtro a 1.000 registros o menos');
    res.json({ items });
  }));
  router.get('/exportar', run(async (req, res) => {
    if (!esGestor(req.usuario)) fail('Solo supervisor y administrador pueden exportar', 403);
    const f = filtrosBajas(req.query, req.usuario);
    const items = await db.bajaProducto.findMany({ where: f.where, orderBy: [{ fechaOperativa: 'asc' }, { creadoEn: 'asc' }, { id: 'asc' }], take: 10001 });
    if (items.length > 10000) fail('La exportación supera 10.000 registros. Reduce el rango de fechas');
    const rows = items.map(r => ({ Identificador: r.id, 'Fecha de baja': r.fechaOperativa.toISOString().slice(0, 10), 'Registrado (Bolivia)': new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', dateStyle: 'short', timeStyle: 'medium' }).format(r.creadoEn), Categoría: r.snapshot.categoria, Tipo: r.snapshot.tipo, Producto: r.snapshot.producto, Presentación: r.snapshot.presentacion, Proveedor: r.snapshot.proveedor, Cantidad: Number(r.cantidad), Unidad: r.snapshot.unidad, Motivo: r.snapshot.motivo, Explicación: r.explicacion || '', Observaciones: r.observaciones || '', Responsable: r.snapshot.responsable, Estado: r.estado, 'Motivo retroactivo': r.motivoRetroactivo || '', 'Motivo anulación': r.motivoAnulacion || '' }));
    if (f.formato === 'csv') {
      const columns = ['Identificador', 'Fecha de baja', 'Registrado (Bolivia)', 'Categoría', 'Tipo', 'Producto', 'Presentación', 'Proveedor', 'Cantidad', 'Unidad', 'Motivo', 'Explicación', 'Observaciones', 'Responsable', 'Estado', 'Motivo retroactivo', 'Motivo anulación'];
      const cell = value => { let text = String(value ?? ''); if (/^[\s]*[=+@-]/u.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
      res.type('text/csv').attachment('bajas-ceprod.csv').send('\uFEFF' + [columns.map(cell).join(','), ...rows.map(r => columns.map(c => cell(r[c])).join(','))].join('\r\n'));
    } else {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Array.from({ length: 17 }, () => ({ wch: 24 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Bajas');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['CEPROD - Bajas'], ['Generado UTC', new Date().toISOString()], ['Registros', rows.length], ['Filtros', JSON.stringify(req.query)], ['Nota', 'Las anuladas se muestran si corresponden al filtro; no sumarlas como bajas efectivas.']]), 'Filtros');
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('bajas-ceprod.xlsx').send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }
  }));
  router.get('/:id/eventos', run(async (req, res) => {
    if (!esGestor(req.usuario)) fail('Solo supervisor y administrador pueden consultar auditoría', 403);
    const id = idValido(req.params.id);
    const pagina = Number(req.query.pagina || 1);
    if (!Number.isSafeInteger(pagina) || pagina < 1) fail('Página inválida', 400);
    const where = { entidad: 'bajas', entidadId: id };
    const [items, total] = await db.$transaction([db.eventoAuditoriaBajas.findMany({ where, orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }], take: 20, skip: (pagina - 1) * 20 }), db.eventoAuditoriaBajas.count({ where })]);
    res.json({ items, total, pagina });
  }));
  router.get('/:id', run(async (req, res) => {
    const row = await db.bajaProducto.findFirst({ where: { id: idValido(req.params.id), ...(!esGestor(req.usuario) ? { creadoPorId: req.usuario.id } : {}) } });
    if (!row) fail('Baja no encontrada', 404);
    res.json(row);
  }));
  router.post('/', run(async (req, res) => res.status(201).json(await crearBaja(db, req.body, req.usuario))));
  router.patch('/:id', run(async (req, res) => res.json(await editarBaja(db, idValido(req.params.id), req.body, req.usuario))));
  router.post('/:id/anular', run(async (req, res) => res.json(await anularBaja(db, idValido(req.params.id), req.body, req.usuario))));
  return router;
}
