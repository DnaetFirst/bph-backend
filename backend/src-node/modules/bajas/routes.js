import { Router } from 'express';
import { z } from 'zod';
import { catalogos, incluir, fail, guardar, cambiarEstado, transaccion, auditar } from './catalogos.js';
import { operacionesBajas } from './operacionesRoutes.js';

export function crearRouterBajas(db, autenticar, habilitado = () => process.env.BAJAS_ENABLED !== 'false') {
  const router = Router();
  router.use(autenticar);
  const permiso = async usuario => {
    if (usuario.rol === 'administrador') return true;
    return Boolean((await db.accesoModulo.findUnique({ where: { usuarioId_modulo: { usuarioId: usuario.id, modulo: 'bajas' } } }))?.activo);
  };
  const run = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const numero = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) fail('Identificador inválido', 400); return n; };
  router.get('/sesion', run(async (req, res) => {
    const enabled = habilitado();
    const acceso = enabled && await permiso(req.usuario);
    res.json({ habilitado: enabled, acceso, gestionar: acceso && ['administrador', 'supervisor'].includes(req.usuario.rol), administrarAccesos: enabled && req.usuario.rol === 'administrador' });
  }));
  router.use((req, res, next) => {
    if (!habilitado()) return res.status(404).json({ error: 'El módulo de Bajas no está habilitado' });
    permiso(req.usuario).then(ok => ok ? next() : res.status(403).json({ error: 'No tienes acceso al módulo de Bajas' })).catch(next);
  });
  const gestionar = (req, res, next) => ['administrador', 'supervisor'].includes(req.usuario.rol) ? next() : res.status(403).json({ error: 'Solo administrador y supervisor pueden gestionar catálogos' });
  const admin = (req, res, next) => req.usuario.rol === 'administrador' ? next() : res.status(403).json({ error: 'Solo el administrador gestiona accesos' });
  router.get('/accesos', admin, run(async (req, res) => {
    const usuarios = await db.usuario.findMany({ where: { activo: true }, select: { id: true, nombre: true, rol: true }, orderBy: { nombre: 'asc' } });
    const accesos = await db.accesoModulo.findMany({ where: { modulo: 'bajas' } });
    res.json(usuarios.map(u => ({ ...u, acceso: u.rol === 'administrador' || Boolean(accesos.find(a => a.usuarioId === u.id)?.activo), version: accesos.find(a => a.usuarioId === u.id)?.version || 0 })));
  }));
  router.get('/auditoria', gestionar, run(async (req, res) => {
    const parsed = z.object({ pagina: z.coerce.number().int().min(1).default(1), entidad: z.enum(['bajas', ...Object.keys(catalogos), 'accesos']).optional() }).strict().safeParse(req.query);
    if (!parsed.success) fail('Filtros inválidos', 400);
    const { pagina, entidad } = parsed.data;
    if (entidad === 'accesos' && req.usuario.rol !== 'administrador') fail('Solo el administrador consulta cambios de accesos', 403);
    const where = { ...(entidad ? { entidad } : {}), ...(req.usuario.rol !== 'administrador' ? { NOT: { entidad: 'accesos' } } : {}) };
    const [items,total] = await db.$transaction([db.eventoAuditoriaBajas.findMany({where,orderBy:[{creadoEn:'desc'},{id:'desc'}],skip:(pagina-1)*20,take:20}),db.eventoAuditoriaBajas.count({where})]);
    res.json({items,total,pagina});
  }));
  router.put('/accesos/:id', admin, run(async (req, res) => {
    const body = z.object({ activo: z.boolean(), version: z.number().int().min(0), motivo: z.string().trim().min(3).max(500) }).strict().safeParse(req.body);
    if (!body.success) fail('Acceso, versión y motivo requeridos', 400);
    const usuarioId = numero(req.params.id);
    const result = await transaccion(db, async tx => {
      const usuario = await tx.usuario.findUnique({ where: { id: usuarioId } });
      if (!usuario?.activo || usuario.rol === 'administrador') fail('Usuario no modificable');
      const where = { usuarioId_modulo: { usuarioId, modulo: 'bajas' } };
      const antes = await tx.accesoModulo.findUnique({ where });
      if ((antes?.version || 0) !== body.data.version) fail('El acceso cambió; recarga la lista', 409);
      const despues = await tx.accesoModulo.upsert({ where, create: { usuarioId, modulo: 'bajas', activo: body.data.activo }, update: { activo: body.data.activo, version: { increment: 1 }, actualizadoEn: new Date() } });
      await auditar(tx, 'accesos', antes ? { ...antes, id: usuarioId } : null, { ...despues, id: usuarioId }, req.usuario.id, 'Cambiar acceso', body.data.motivo);
      return despues;
    });
    res.json(result);
  }));
  router.get('/catalogos/:tipo', run(async (req, res) => {
    const { tipo } = req.params;
    const config = catalogos[tipo];
    if (!config) fail('Catálogo no encontrado', 404);
    const filtros = z.object({ q: z.string().max(100).optional(), pagina: z.coerce.number().int().min(1).default(1), porPagina: z.coerce.number().int().min(1).max(100).default(20), estado: z.enum(['activos', 'inactivos', 'todos']).default('activos'), categoriaId: z.coerce.number().int().positive().optional(), productoId: z.coerce.number().int().positive().optional() }).strict().safeParse(req.query);
    if (!filtros.success) fail('Filtros inválidos', 400);
    const f = filtros.data;
    if (!['administrador', 'supervisor'].includes(req.usuario.rol) && f.estado !== 'activos') fail('No autorizado para consultar catálogos inactivos', 403);
    const where = { ...(f.estado !== 'todos' ? { activo: f.estado === 'activos' } : {}), ...(f.q ? { nombre: { contains: f.q.trim(), mode: 'insensitive' } } : {}) };
    if (f.categoriaId && ['tipos', 'productos'].includes(tipo)) where.categoriaId = f.categoriaId;
    if (f.productoId && tipo === 'presentaciones') where.productoId = f.productoId;
    if (f.categoriaId && ['proveedores', 'motivos'].includes(tipo)) where.OR = [{ todasCategorias: true }, { categorias: { some: { categoriaId: f.categoriaId } } }];
    if (f.estado === 'activos') {
      if (['tipos', 'productos'].includes(tipo)) where.categoria = { activo: true };
      if (tipo === 'productos') where.OR = [{ tipoId: null }, { tipo: { activo: true } }];
      if (tipo === 'presentaciones') Object.assign(where, { unidad: { activo: true }, producto: { activo: true, categoria: { activo: true } } });
    }
    const [items, total] = await db.$transaction([
      db[config.model].findMany({ where, include: incluir(tipo), orderBy: [{ nombre: 'asc' }, { id: 'asc' }], skip: (f.pagina - 1) * f.porPagina, take: f.porPagina }),
      db[config.model].count({ where }),
    ]);
    res.json({ items, total, pagina: f.pagina, porPagina: f.porPagina });
  }));
  router.get('/catalogos/:tipo/:id/eventos', gestionar, run(async (req, res) => {
    if (!catalogos[req.params.tipo]) fail('Catálogo no encontrado', 404);
    const pagina = numero(req.query.pagina || 1);
    const where = { entidad: req.params.tipo, entidadId: String(numero(req.params.id)) };
    const [items, total] = await db.$transaction([db.eventoAuditoriaBajas.findMany({ where, orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }], take: 20, skip: (pagina - 1) * 20 }), db.eventoAuditoriaBajas.count({ where })]);
    res.json({ items, total, pagina });
  }));
  router.post('/catalogos/:tipo', gestionar, run(async (req, res) => res.status(201).json(await guardar(db, req.params.tipo, req.body, req.usuario.id))));
  router.put('/catalogos/:tipo/:id', gestionar, run(async (req, res) => res.json(await guardar(db, req.params.tipo, req.body, req.usuario.id, numero(req.params.id)))));
  for (const accion of ['desactivar', 'restaurar']) router.post(`/catalogos/:tipo/:id/${accion}`, gestionar, run(async (req, res) => res.json(await cambiarEstado(db, req.params.tipo, numero(req.params.id), req.body, req.usuario.id, accion === 'restaurar'))));
  router.use('/', operacionesBajas(db));
  return router;
}
