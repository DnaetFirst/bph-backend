import { z } from 'zod';

const nombre = z.string().trim().min(2).max(100);
const id = z.number().int().positive();
const codigo = z.string().trim().min(1).max(40).nullable().optional();
const alcance = { todasCategorias: z.boolean(), categoriaIds: z.array(id).max(100) };
export const catalogos = {
  categorias: { model: 'categoriaProducto', schema: z.object({ nombre, orden: z.number().int().min(0).max(9999), etiquetaTipo: z.string().trim().min(2).max(60), requiereTipo: z.boolean(), requiereProveedor: z.boolean() }) },
  tipos: { model: 'tipoProducto', schema: z.object({ nombre, categoriaId: id }) },
  unidades: { model: 'unidadMedida', schema: z.object({ nombre, abreviatura: z.string().trim().min(1).max(12), decimales: z.number().int().min(0).max(3) }) },
  productos: { model: 'productoBaja', schema: z.object({ nombre, codigo, categoriaId: id, tipoId: id.nullable(), presentacion: z.object({ nombre, unidadId: id }).optional() }) },
  presentaciones: { model: 'presentacionProducto', schema: z.object({ nombre, productoId: id, unidadId: id, predeterminada: z.boolean() }) },
  proveedores: { model: 'proveedorBaja', schema: z.object({ nombre, codigo, ...alcance }) },
  motivos: { model: 'motivoBaja', schema: z.object({ nombre, explicacionObligatoria: z.boolean(), ...alcance }) },
};
export const normalizar = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es');
export const fail = (message, status = 422) => { throw Object.assign(new Error(message), { status }); };
export function validar(tipo, body, nuevo) {
  const config = catalogos[tipo];
  if (!config) fail('Catálogo no encontrado', 404);
  const schema = config.schema.extend(nuevo ? {} : { version: id, motivoCambio: z.string().trim().min(3).max(500) }).strict();
  const parsed = schema.safeParse(body);
  if (!parsed.success) fail(parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; '), 400);
  if (nuevo && tipo === 'productos' && !parsed.data.presentacion) fail('Agrega la presentación inicial del producto');
  if (!nuevo && parsed.data.presentacion) fail('Administra las presentaciones por separado');
  if (parsed.data.todasCategorias === false && !parsed.data.categoriaIds.length) fail('Selecciona al menos una categoría');
  return parsed.data;
}
export const incluir = tipo => ['proveedores', 'motivos'].includes(tipo) ? { categorias: true }
  : tipo === 'productos' ? { categoria: true, tipo: true, presentaciones: { include: { unidad: true } } }
    : tipo === 'tipos' ? { categoria: true } : tipo === 'presentaciones' ? { producto: { include: { categoria: true } }, unidad: true } : undefined;

const json = value => value == null ? undefined : JSON.parse(JSON.stringify(value));
export async function auditar(tx, entidad, antes, despues, usuarioId, accion, motivo) {
  await tx.eventoAuditoriaBajas.create({ data: { entidad, entidadId: String(despues?.id ?? antes?.id), usuarioId, accion, motivo, antes: json(antes), despues: json(despues) } });
}

// Serialización entre escrituras de catálogos, accesos y bajas. No bloquea BPH.
export async function transaccion(db, fn) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(7281028)');
    return fn(tx);
  }, { maxWait: 10000, timeout: 60000 });
}
async function activo(tx, model, id) {
  const row = await tx[model].findUnique({ where: { id } });
  if (!row?.activo) fail('La opción seleccionada no existe o está inactiva');
  return row;
}
async function relaciones(tx, tipo, data, anterior, restaurando = false) {
  if (['tipos', 'productos'].includes(tipo)) {
    const cat = await activo(tx, 'categoriaProducto', data.categoriaId);
    if (tipo === 'productos') {
      if (cat.requiereTipo && !data.tipoId) fail('Esta categoría requiere un tipo');
      if (data.tipoId) {
        const t = await activo(tx, 'tipoProducto', data.tipoId);
        if (t.categoriaId !== data.categoriaId) fail('El tipo no pertenece a la categoría');
      }
      if (anterior && (anterior.categoriaId !== data.categoriaId || anterior.tipoId !== data.tipoId) && await tx.bajaProducto.count({ where: { productoId: anterior.id } })) fail('Este producto tiene historial. Crea otro producto para cambiar su clasificación');
      if (data.presentacion) await activo(tx, 'unidadMedida', data.presentacion.unidadId);
    } else if (anterior && anterior.categoriaId !== data.categoriaId && await tx.productoBaja.count({ where: { tipoId: anterior.id } })) fail('El tipo tiene productos relacionados; no se puede mover');
  }
  if (tipo === 'presentaciones') {
    const p = restaurando ? await tx.productoBaja.findUnique({ where: { id: data.productoId } }) : await activo(tx, 'productoBaja', data.productoId);
    if (!p) fail('Producto no encontrado');
    if (!restaurando) await activo(tx, 'categoriaProducto', p.categoriaId);
    await activo(tx, 'unidadMedida', data.unidadId);
    if (anterior && (anterior.productoId !== data.productoId || anterior.unidadId !== data.unidadId)) fail('Crea otra presentación para cambiar el producto o la unidad');
  }
  if (tipo === 'unidades' && anterior && anterior.decimales !== data.decimales && await tx.presentacionProducto.count({ where: { unidadId: anterior.id } })) fail('Esta unidad ya tiene presentaciones; crea otra para cambiar la precisión');
  if (data.categoriaIds) for (const id of new Set(data.categoriaIds)) await activo(tx, 'categoriaProducto', id);
  if (tipo === 'categorias' && data.requiereTipo && anterior && await tx.productoBaja.count({ where: { categoriaId: anterior.id, activo: true, tipoId: null } })) fail('Asigna un tipo a todos los productos activos antes de exigirlo');
}
async function cobertura(tx) {
  const categorias = await tx.categoriaProducto.findMany({ where: { activo: true } });
  for (const c of categorias) {
    // Exigir cobertura cuando la categoría ya tiene productos activos.
    if (!await tx.productoBaja.count({ where: { categoriaId: c.id, activo: true } })) continue;
    for (const model of ['motivoBaja', ...(c.requiereProveedor ? ['proveedorBaja'] : [])]) {
      if (!await tx[model].count({ where: { activo: true, OR: [{ todasCategorias: true }, { categorias: { some: { categoriaId: c.id } } }] } })) fail(`La categoría ${c.nombre} necesita ${model === 'motivoBaja' ? 'un motivo' : 'un proveedor'} activo`);
    }
  }
}
async function predeterminada(tx, productoId, id, usuarioId) {
  const previas = await tx.presentacionProducto.findMany({ where: { productoId, predeterminada: true, id: { not: id } } });
  for (const antes of previas) {
    const despues = await tx.presentacionProducto.update({ where: { id: antes.id }, data: { predeterminada: false, version: { increment: 1 }, actualizadoPorId: usuarioId, actualizadoEn: new Date() } });
    await auditar(tx, 'presentaciones', antes, despues, usuarioId, 'Editar', 'Cambio de presentación predeterminada');
  }
}
export async function guardar(db, tipo, body, usuarioId, id) {
  const data = validar(tipo, body, !id);
  return transaccion(db, async tx => {
    const model = catalogos[tipo].model;
    const antes = id ? await tx[model].findUnique({ where: { id }, include: incluir(tipo) }) : null;
    if (id && !antes) fail('Opción no encontrada', 404);
    if (antes && data.version !== antes.version) fail('Otra persona modificó esta opción. Recarga antes de guardar', 409);
    if (antes && !antes.activo) fail('Restaura la opción antes de editarla');
    await relaciones(tx, tipo, data, antes);
    const { version, motivoCambio, categoriaIds, presentacion, ...campos } = data;
    const values = { ...campos, nombre: campos.nombre.trim().replace(/\s+/gu, ' '), clave: normalizar(campos.nombre), actualizadoEn: new Date(), actualizadoPorId: usuarioId };
    const duplicado = await tx[model].findFirst({ where: { clave: values.clave, ...(id ? { id: { not: id } } : {}), ...(['tipos', 'productos'].includes(tipo) ? { categoriaId: data.categoriaId } : {}), ...(tipo === 'presentaciones' ? { productoId: data.productoId } : {}) } });
    if (duplicado) fail(duplicado.activo ? 'Ya existe una opción con este nombre en el catálogo' : 'Esta opción está desactivada. Abre el filtro Desactivados y restáurala para reutilizarla', 409);
    if (values.codigo) values.codigo = values.codigo.toUpperCase();
    if (tipo === 'presentaciones') {
      const n = await tx.presentacionProducto.count({ where: { productoId: data.productoId, activo: true } });
      if (!n) values.predeterminada = true;
      if (antes?.predeterminada && !values.predeterminada) fail('Selecciona otra presentación como predeterminada para sustituir esta');
      if (values.predeterminada) await predeterminada(tx, data.productoId, id || 0, usuarioId);
    }
    if (categoriaIds) values.categorias = { ...(id ? { deleteMany: {} } : {}), create: (data.todasCategorias ? [] : [...new Set(categoriaIds)]).map(categoriaId => ({ categoriaId })) };
    const row = id ? await tx[model].update({ where: { id }, data: { ...values, version: { increment: 1 } }, include: incluir(tipo) })
      : await tx[model].create({ data: { ...values, creadoPorId: usuarioId }, include: incluir(tipo) });
    if (presentacion) {
      const p = await tx.presentacionProducto.create({ data: { nombre: presentacion.nombre, clave: normalizar(presentacion.nombre), productoId: row.id, unidadId: presentacion.unidadId, predeterminada: true, creadoPorId: usuarioId, actualizadoPorId: usuarioId } });
      await auditar(tx, 'presentaciones', null, p, usuarioId, 'Crear', 'Presentación inicial del producto');
    }
    await cobertura(tx);
    const completo = presentacion ? await tx[model].findUnique({ where: { id: row.id }, include: incluir(tipo) }) : row;
    await auditar(tx, tipo, antes, completo, usuarioId, id ? 'Editar' : 'Crear', motivoCambio || 'Alta de catálogo');
    return completo;
  });
}
export async function cambiarEstado(db, tipo, id, body, usuarioId, restaurar) {
  const config = catalogos[tipo];
  if (!config) fail('Catálogo no encontrado', 404);
  const parsed = z.object({ version: z.number().int().positive(), motivo: z.string().trim().min(3).max(500) }).strict().safeParse(body);
  if (!parsed.success) fail('Indica la versión y un motivo de 3 a 500 caracteres', 400);
  return transaccion(db, async tx => {
    const antes = await tx[config.model].findUnique({ where: { id }, include: incluir(tipo) });
    if (!antes) fail('Opción no encontrada', 404);
    if (antes.version !== body.version) fail('La opción cambió. Recarga la lista', 409);
    if (antes.activo === restaurar) fail('La opción ya tiene ese estado', 409);
    if (restaurar) {
      await relaciones(tx, tipo, { ...antes, categoriaIds: antes.categorias?.map(c => c.categoriaId) }, antes, true);
      if (tipo === 'productos' && !await tx.presentacionProducto.count({ where: { productoId: id, activo: true, predeterminada: true, unidad: { activo: true } } })) fail('El producto necesita una presentación predeterminada activa');
    } else {
      if (tipo === 'tipos' && await tx.productoBaja.count({ where: { tipoId: id, activo: true } })) fail('Desactiva o reclasifica primero los productos activos de este tipo');
      if (tipo === 'unidades' && await tx.presentacionProducto.count({ where: { unidadId: id, activo: true, producto: { activo: true } } })) fail('Esta unidad tiene presentaciones de productos activos. Desactiva esos productos o utiliza otra presentación');
      if (tipo === 'presentaciones' && antes.predeterminada && (await tx.productoBaja.findUnique({ where: { id: antes.productoId } }))?.activo) fail('Elige otra presentación predeterminada o desactiva primero el producto');
    }
    const despues = await tx[config.model].update({ where: { id }, data: { activo: restaurar, version: { increment: 1 }, actualizadoEn: new Date(), actualizadoPorId: usuarioId, desactivadoEn: restaurar ? null : new Date(), desactivadoPorId: restaurar ? null : usuarioId, motivoDesactivacion: restaurar ? null : parsed.data.motivo }, include: incluir(tipo) });
    await cobertura(tx);
    await auditar(tx, tipo, antes, despues, usuarioId, restaurar ? 'Restaurar' : 'Desactivar', parsed.data.motivo);
    return despues;
  });
}
