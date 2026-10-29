import { performance } from 'node:perf_hooks';
import { PrismaClient } from '../generated/node-client/index.js';
import { sembrarCatalogos } from '../src-node/modules/bajas/seed.js';
import { filtrosBajas, resumenBajas } from '../src-node/modules/bajas/bajasService.js';
const url = new URL(process.env.BAJAS_TEST_DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || !url.pathname.endsWith('_carga_test')) throw new Error('Solo base local dedicada terminada en _carga_test');
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
try {
  await sembrarCatalogos(db);
  const usuario = await db.usuario.create({ data: { nombre: `CARGA ${Date.now()}`, email: `carga-${Date.now()}@example.test`, rol: 'administrador', hashPin: 'synthetic' } });
  for (const total of [10000,100000]) {
    const actual = await db.bajaProducto.count();
    if (actual > total) continue;
    if (actual < total) await db.$executeRaw`
      WITH opciones AS (
        SELECT p.id pid, pr.id prid, p.nombre producto, c.nombre categoria, c.id cid, u.id uid, u.nombre unidad,
          row_number() OVER (ORDER BY p.id) AS n, count(*) OVER () AS total
        FROM "ProductoBaja" p JOIN "CategoriaProducto" c ON c.id=p."categoriaId"
        JOIN "PresentacionProducto" pr ON pr."productoId"=p.id JOIN "UnidadMedida" u ON u.id=pr."unidadId"
      )
      INSERT INTO "BajaProducto" (id,"productoId","presentacionId","motivoId",cantidad,"fechaOperativa","creadoPorId",snapshot,"claveIdempotencia",huella)
      SELECT gen_random_uuid()::text,o.pid,o.prid,(SELECT id FROM "MotivoBaja" ORDER BY id LIMIT 1),1,DATE '2026-10-28',${usuario.id},
        jsonb_build_object('producto',o.producto,'categoria',o.categoria,'categoriaId',o.cid,'unidad',o.unidad,'unidadId',o.uid,'responsable','Prueba de carga','busqueda',lower(o.producto)),gen_random_uuid()::text,'synthetic'
      FROM generate_series(1,${total-actual}) g JOIN opciones o ON o.n=1+g%o.total`;
    const where = filtrosBajas({ fechaDesde:'2026-10-28',fechaHasta:'2026-10-28' },usuario).where;
    let start=performance.now(); await db.bajaProducto.findMany({where,orderBy:[{fechaOperativa:'desc'},{creadoEn:'desc'},{id:'desc'}],take:12}); const listaMs=Math.round(performance.now()-start);
    start=performance.now(); await resumenBajas(db,where); const resumenMs=Math.round(performance.now()-start);
    start=performance.now(); await db.bajaProducto.count({where:filtrosBajas({q:'pollo'},usuario).where}); const buscarMs=Math.round(performance.now()-start);
    console.log(JSON.stringify({ registros:total,listaMs,resumenMs,buscarMs,entorno:'PostgreSQL local; datos sintéticos directos sin auditoría; no representa latencia de Render' }));
  }
} finally { await db.$disconnect(); }
