import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '../../../generated/node-client/index.js';
import { auditar, fail, transaccion } from './catalogos.js';
const id = z.number().int().positive();
const texto = z.string().trim().max(500).default('');
const campos = {
  productoId: id, presentacionId: id, proveedorId: id.nullable().default(null), motivoId: id,
  cantidad: z.string().regex(/^\d{1,11}(?:[.,]\d{1,3})?$/, 'Cantidad inválida: hasta 11 enteros y 3 decimales'),
  fechaOperativa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), observaciones: texto, explicacion: texto, motivoRetroactivo: texto,
};
export const esGestor = u => ['administrador', 'supervisor'].includes(u.rol);
export const hoyBolivia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function fechaValida(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('Fecha inválida', 400);
  return date;
}
export function datosBaja(body, editar = false) {
  const schema = z.object({ ...campos, ...(editar ? { version: id, motivoCambio: z.string().trim().min(3).max(500) } : { claveIdempotencia: z.string().uuid() }) }).strict();
  const p = schema.safeParse(body);
  if (!p.success) fail(p.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; '), 400);
  p.data.cantidad = new Prisma.Decimal(p.data.cantidad.replace(',', '.')).toString();
  if (new Prisma.Decimal(p.data.cantidad).lte(0)) fail('La cantidad debe ser mayor que cero');
  fechaValida(p.data.fechaOperativa);
  return p.data;
}
export function validarFecha(data, usuario, anterior) {
  const hoy = hoyBolivia();
  if (data.fechaOperativa > hoy) fail('No puedes registrar una fecha futura');
  if (!esGestor(usuario) && data.fechaOperativa !== hoy) fail('Solo supervisor y administrador pueden registrar fechas anteriores', 403);
  if (data.fechaOperativa < hoy && (!anterior || anterior.fechaOperativa.toISOString().slice(0, 10) !== data.fechaOperativa) && data.motivoRetroactivo.length < 3) fail('Explica por qué registras una fecha anterior');
}
async function preparar(tx, data, usuario, anterior) {
  validarFecha(data, usuario, anterior);
  const p = await tx.productoBaja.findUnique({ where: { id: data.productoId }, include: { categoria: true, tipo: true } });
  const presentacion = await tx.presentacionProducto.findUnique({ where: { id: data.presentacionId }, include: { unidad: true } });
  const mismoProducto = anterior?.productoId === data.productoId && anterior?.presentacionId === data.presentacionId;
  if (!p || !presentacion || presentacion.productoId !== p.id) fail('El producto y la presentación no corresponden');
  if (!mismoProducto && (!p.activo || !p.categoria.activo || (p.tipo && !p.tipo.activo) || !presentacion.activo || !presentacion.unidad.activo)) fail('El producto, su categoría o presentación ya no están disponibles');
  const snapshot = mismoProducto ? { ...anterior.snapshot } : {
    producto: p.nombre, categoria: p.categoria.nombre, categoriaId: p.categoriaId,
    tipo: p.tipo?.nombre || '', tipoId: p.tipoId, presentacion: presentacion.nombre,
    unidad: presentacion.unidad.nombre, unidadId: presentacion.unidadId, decimales: presentacion.unidad.decimales,
    requiereProveedor: p.categoria.requiereProveedor,
  };
  if (new Prisma.Decimal(data.cantidad).decimalPlaces() > snapshot.decimales) fail(`Esta unidad admite ${snapshot.decimales} decimales`);
  if (snapshot.requiereProveedor && !data.proveedorId) fail('Selecciona un proveedor para esta categoría');
  if (data.proveedorId) {
    const proveedor = await tx.proveedorBaja.findUnique({ where: { id: data.proveedorId }, include: { categorias: true } });
    const conservar = mismoProducto && anterior?.proveedorId === data.proveedorId;
    if (!proveedor || (!conservar && (!proveedor.activo || (!proveedor.todasCategorias && !proveedor.categorias.some(c => c.categoriaId === p.categoriaId))))) fail('Proveedor inactivo o no aplicable a la categoría');
    snapshot.proveedor = conservar ? anterior.snapshot.proveedor : proveedor.nombre;
  } else snapshot.proveedor = '';
  const motivo = await tx.motivoBaja.findUnique({ where: { id: data.motivoId }, include: { categorias: true } });
  const mismoMotivo = mismoProducto && anterior?.motivoId === data.motivoId;
  if (!motivo || (!mismoMotivo && (!motivo.activo || (!motivo.todasCategorias && !motivo.categorias.some(c => c.categoriaId === p.categoriaId))))) fail('Motivo inactivo o no aplicable a la categoría');
  snapshot.motivo = mismoMotivo ? anterior.snapshot.motivo : motivo.nombre;
  snapshot.explicacionObligatoria = mismoMotivo ? anterior.snapshot.explicacionObligatoria : motivo.explicacionObligatoria;
  if (snapshot.explicacionObligatoria && data.explicacion.length < 3) fail('Este motivo requiere una explicación');
  snapshot.responsable = anterior?.snapshot.responsable || usuario.nombre;
  snapshot.busqueda = [snapshot.producto, snapshot.categoria, snapshot.responsable, snapshot.motivo, snapshot.tipo, snapshot.proveedor].join(' ').toLocaleLowerCase('es');
  const { version, motivoCambio, claveIdempotencia, ...fields } = data;
  return { ...fields, cantidad: new Prisma.Decimal(data.cantidad), fechaOperativa: fechaValida(data.fechaOperativa), snapshot };
}
export async function crearBaja(db, body, usuario) {
  const data = datosBaja(body);
  const huella = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return transaccion(db, async tx => {
    const existente = await tx.bajaProducto.findUnique({ where: { creadoPorId_claveIdempotencia: { creadoPorId: usuario.id, claveIdempotencia: data.claveIdempotencia } } });
    if (existente) { if (existente.huella !== huella) fail('Esta solicitud ya se guardó con otros datos. Consulta el historial antes de continuar', 409); return existente; }
    const values = await preparar(tx, data, usuario);
    const row = await tx.bajaProducto.create({ data: { ...values, creadoPorId: usuario.id, claveIdempotencia: data.claveIdempotencia, huella } });
    await auditar(tx, 'bajas', null, row, usuario.id, 'Registrar baja', data.motivoRetroactivo || 'Registro de baja');
    return row;
  });
}
export async function editarBaja(db, id, body, usuario) {
  if (!esGestor(usuario)) fail('No puedes corregir bajas', 403);
  const data = datosBaja(body, true);
  return transaccion(db, async tx => {
    const antes = await tx.bajaProducto.findUnique({ where: { id } });
    if (!antes) fail('Baja no encontrada', 404);
    if (antes.version !== data.version) fail('Otra persona modificó esta baja. Recarga el detalle', 409);
    if (antes.estado !== 'REGISTRADA') fail('No se puede editar una baja anulada');
    const despues = await tx.bajaProducto.update({ where: { id }, data: { ...await preparar(tx, data, usuario, antes), version: { increment: 1 } } });
    await auditar(tx, 'bajas', antes, despues, usuario.id, 'Corregir baja', data.motivoCambio);
    return despues;
  });
}
export async function anularBaja(db, id, body, usuario) {
  if (!esGestor(usuario)) fail('No puedes anular bajas', 403);
  const parsed = z.object({ version: z.number().int().positive(), motivo: z.string().trim().min(3).max(500) }).strict().safeParse(body);
  if (!parsed.success) fail('Versión y motivo de anulación requeridos', 400);
  return transaccion(db, async tx => {
    const antes = await tx.bajaProducto.findUnique({ where: { id } });
    if (!antes) fail('Baja no encontrada', 404);
    if (antes.version !== parsed.data.version || antes.estado !== 'REGISTRADA') fail('El registro cambió o ya está anulado', 409);
    const despues = await tx.bajaProducto.update({ where: { id }, data: { estado: 'ANULADA', anuladoEn: new Date(), anuladoPorId: usuario.id, motivoAnulacion: parsed.data.motivo, version: { increment: 1 } } });
    await auditar(tx, 'bajas', antes, despues, usuario.id, 'Anular baja', parsed.data.motivo);
    return despues;
  });
}
export function filtrosBajas(query, usuario) {
  const schema = z.object({
    q: z.string().trim().max(100).optional(), fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    productoId: z.coerce.number().int().positive().optional(), presentacionId: z.coerce.number().int().positive().optional(), categoriaId: z.coerce.number().int().positive().optional(), tipoId: z.coerce.number().int().positive().optional(), unidadId: z.coerce.number().int().positive().optional(), proveedorId: z.coerce.number().int().positive().optional(), motivoId: z.coerce.number().int().positive().optional(), creadoPorId: z.coerce.number().int().positive().optional(),
    estado: z.enum(['REGISTRADA', 'ANULADA', 'TODOS']).default('TODOS'), pagina: z.coerce.number().int().min(1).default(1), porPagina: z.coerce.number().int().min(1).max(100).default(20), formato: z.enum(['xlsx', 'csv']).optional(),
  }).strict();
  const p = schema.safeParse(Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '')));
  if (!p.success) fail('Filtros inválidos', 400);
  const f = p.data, where = {};
  if (f.fechaDesde && f.fechaHasta && f.fechaDesde > f.fechaHasta) fail('El rango de fechas está invertido', 400);
  if (f.fechaDesde || f.fechaHasta) where.fechaOperativa = { ...(f.fechaDesde ? { gte: fechaValida(f.fechaDesde) } : {}), ...(f.fechaHasta ? { lte: fechaValida(f.fechaHasta) } : {}) };
  if (f.estado !== 'TODOS') where.estado = f.estado;
  for (const key of ['productoId', 'presentacionId', 'proveedorId', 'motivoId', 'creadoPorId']) if (f[key]) where[key] = f[key];
  if (!esGestor(usuario)) where.creadoPorId = usuario.id;
  where.AND = [];
  for (const key of ['categoriaId', 'tipoId', 'unidadId']) if (f[key]) where.AND.push({ snapshot: { path: [key], equals: f[key] } });
  if (f.q) where.AND.push({ OR: [
    { id: { contains: f.q, mode: 'insensitive' } },
    { snapshot: { path: ['busqueda'], string_contains: f.q.toLocaleLowerCase('es') } },
  ] });
  return { where, ...f };
}
export async function resumenBajas(db, where) {
  return db.$transaction(async tx => {
    const efectivos = { AND: [where, { estado: 'REGISTRADA' }] };
    const [registradas, anuladas, grupos, motivos, proveedores, productos] = await Promise.all([
      tx.bajaProducto.count({ where: { AND: [where, { estado: 'REGISTRADA' }] } }),
      tx.bajaProducto.count({ where: { AND: [where, { estado: 'ANULADA' }] } }),
      tx.bajaProducto.groupBy({ by: ['productoId', 'presentacionId'], where: { AND: [where, { estado: 'REGISTRADA' }] }, _sum: { cantidad: true }, _count: true, orderBy: { _count: { id: 'desc' } }, take: 20 }),
      tx.bajaProducto.groupBy({ by: ['motivoId'], where: efectivos, _count: true, orderBy: { _count: { id: 'desc' } }, take: 20 }),
      tx.bajaProducto.groupBy({ by: ['proveedorId'], where: efectivos, _count: true, orderBy: { _count: { id: 'desc' } }, take: 20 }),
      tx.bajaProducto.groupBy({ by: ['productoId'], where: efectivos, _count: true }),
    ]);
    const presentaciones = await tx.presentacionProducto.findMany({ where: { id: { in: grupos.map(g => g.presentacionId) } }, include: { producto: true, unidad: true } });
    const [m, p, prods] = await Promise.all([
      tx.motivoBaja.findMany({ where: { id: { in: motivos.map(g => g.motivoId) } }, select: { id: true, nombre: true } }),
      tx.proveedorBaja.findMany({ where: { id: { in: proveedores.map(g => g.proveedorId).filter(Boolean) } }, select: { id: true, nombre: true } }),
      tx.productoBaja.findMany({ where: { id: { in: productos.map(g => g.productoId) } }, select: { id: true, categoria: { select: { id: true, nombre: true } } } }),
    ]);
    const categorias = new Map();
    for (const g of productos) { const c = prods.find(p => p.id === g.productoId).categoria; const r = categorias.get(c.id) || { nombre: c.nombre, registros: 0 }; r.registros += g._count; categorias.set(c.id, r); }
    return { registradas, anuladas,
      categorias: [...categorias.values()].sort((a,b) => b.registros-a.registros).slice(0,20),
      motivos: motivos.map(g => ({ nombre: m.find(r => r.id === g.motivoId)?.nombre, registros: g._count })),
      proveedores: proveedores.map(g => ({ nombre: p.find(r => r.id === g.proveedorId)?.nombre || 'Sin proveedor', registros: g._count })),
      grupos: grupos.map(g => { const p = presentaciones.find(p => p.id === g.presentacionId); return { producto: p.producto.nombre, presentacion: p.nombre, unidad: p.unidad.nombre, cantidad: g._sum.cantidad.toString(), registros: g._count }; }), limiteGrupos: 20 };
  }, { isolationLevel: 'RepeatableRead' });
}
