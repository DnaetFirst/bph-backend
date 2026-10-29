import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import XLSX from 'xlsx';
import { PrismaClient } from '../generated/node-client/index.js';
import { crearBaja, editarBaja, anularBaja, filtrosBajas, resumenBajas, hoyBolivia } from '../src-node/modules/bajas/bajasService.js';
import { guardar, cambiarEstado } from '../src-node/modules/bajas/catalogos.js';
import { sembrarCatalogos } from '../src-node/modules/bajas/seed.js';
import { crearRouterBajas } from '../src-node/modules/bajas/routes.js';
import { AuthService } from '../src-node/services/authService.js';
const url = new URL(process.env.BAJAS_TEST_DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || !url.pathname.endsWith('_test')) throw new Error('Solo base PostgreSQL local terminada en _test');
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
test('Operaciones Bajas: integridad, fechas, aislamiento, reportes y exportación', async t => {
  let server;
  try {
    const tag = randomUUID().slice(0,8), users = {};
    for (const rol of ['administrador','supervisor','evaluador']) users[rol] = await db.usuario.create({ data: { nombre: `OPER ${rol} ${tag}`, email:`oper-${rol}-${tag}@example.test`, rol, hashPin:'synthetic-only' } });
    const admin=users.administrador, reg=users.evaluador;
    await sembrarCatalogos(db);
    let cat = await guardar(db,'categorias',{nombre:`OPER ${tag}`,orden:0,etiquetaTipo:'Tipo',requiereTipo:false,requiereProveedor:false},admin.id);
    const unit = await guardar(db,'unidades',{nombre:`Unidad ${tag}`,abreviatura:'u',decimales:0},admin.id);
    let prod = await guardar(db,'productos',{nombre:`=Producto ${tag}`,categoriaId:cat.id,tipoId:null,presentacion:{nombre:'Caja',unidadId:unit.id}},admin.id);
    const pres=await db.presentacionProducto.findFirst({where:{productoId:prod.id}});
    const mot=await guardar(db,'motivos',{nombre:`Otro ${tag}`,explicacionObligatoria:true,todasCategorias:true,categoriaIds:[]},admin.id);
    const body = extra => ({productoId:prod.id,presentacionId:pres.id,proveedorId:null,motivoId:mot.id,cantidad:'2',fechaOperativa:hoyBolivia(),observaciones:'',explicacion:'Producto dañado',motivoRetroactivo:'',claveIdempotencia:randomUUID(),...extra});
    let baja;
    await t.test('doble envío concurrente genera una baja y una auditoría',async()=>{
      const b=body(); const rows=await Promise.all([crearBaja(db,b,reg),crearBaja(db,b,reg)]);
      assert.equal(rows[0].id,rows[1].id); baja=rows[0];
      assert.equal(await db.eventoAuditoriaBajas.count({where:{entidad:'bajas',entidadId:baja.id}}),1);
      await assert.rejects(crearBaja(db,{...b,cantidad:'3'},reg),{status:409});
      const otra=await crearBaja(db,body(),reg); assert.notEqual(otra.id,baja.id);
    });
    await t.test('validación de cantidades, unidades y explicación',async()=>{
      for(const cantidad of ['0','-1','NaN','1.5','2e3']) await assert.rejects(crearBaja(db,body({cantidad}),reg));
      await assert.rejects(crearBaja(db,body({explicacion:''}),reg),{status:422});
    });
    await t.test('fechas retroactivas solo gestores y con motivo; futuras rechazadas',async()=>{
      await assert.rejects(crearBaja(db,body({fechaOperativa:'2020-01-01',motivoRetroactivo:'Carga pendiente'}),reg),{status:403});
      await assert.rejects(crearBaja(db,body({fechaOperativa:'2020-01-01'}),admin),{status:422});
      const row=await crearBaja(db,body({fechaOperativa:'2020-01-01',motivoRetroactivo:'Carga pendiente'}),users.supervisor);
      assert.equal(row.fechaOperativa.toISOString().slice(0,10),'2020-01-01'); assert.ok(row.creadoEn>row.fechaOperativa);
      await assert.rejects(crearBaja(db,body({fechaOperativa:'2099-12-31'}),admin),{status:422});
      await assert.rejects(crearBaja(db,body({fechaOperativa:'2026-02-30'}),admin),{status:400});
    });
    await t.test('editar conserva snapshot, exige versión y permite referencias antiguas inactivas',async()=>{
      prod=await guardar(db,'productos',{nombre:`Renombrado ${tag}`,categoriaId:cat.id,tipoId:null,version:prod.version,motivoCambio:'Corregir nombre'},admin.id,prod.id);
      await cambiarEstado(db,'productos',prod.id,{version:prod.version,motivo:'Retirar del catálogo'},admin.id,false);
      await assert.rejects(crearBaja(db,body(),admin),{status:422});
      const b=body({cantidad:'3'}); delete b.claveIdempotencia;
      await assert.rejects(editarBaja(db,baja.id,{...b,version:baja.version,motivoCambio:'No autorizado'},reg),{status:403});
      const updated=await editarBaja(db,baja.id,{...b,version:baja.version,motivoCambio:'Cantidad corregida'},admin);
      assert.equal(updated.snapshot.producto,baja.snapshot.producto);
      await assert.rejects(editarBaja(db,baja.id,{...b,version:baja.version,motivoCambio:'Versión vieja'},admin),{status:409});
      baja=updated;
    });
    await t.test('resumen no mezcla unidades y anular excluye cantidades sin borrar',async()=>{
      const where=filtrosBajas({productoId:prod.id},admin).where;
      const antes=await resumenBajas(db,where); assert.equal(antes.registradas,3); assert.equal(antes.grupos[0].cantidad,'7');
      baja=await anularBaja(db,baja.id,{version:baja.version,motivo:'Registro incorrecto'},admin);
      const despues=await resumenBajas(db,where); assert.equal(despues.registradas,2); assert.equal(despues.anuladas,1); assert.equal(despues.grupos[0].cantidad,'4');
      assert.equal(await db.bajaProducto.count({where}),3);
      await assert.rejects(anularBaja(db,baja.id,{version:baja.version,motivo:'Repetir'},admin),{status:409});
      const b=body(); delete b.claveIdempotencia; await assert.rejects(editarBaja(db,baja.id,{...b,version:baja.version,motivoCambio:'Editar anulada'},admin),{status:422});
    });
    await t.test('búsqueda histórica sin distinción de mayúsculas y filtros por fecha',async()=>{
      const where=filtrosBajas({q:`PRODUCTO ${tag}`,productoId:prod.id},admin).where;
      assert.equal(await db.bajaProducto.count({where}),3);
      assert.equal(await db.bajaProducto.count({where:filtrosBajas({productoId:prod.id,fechaDesde:'2020-01-01',fechaHasta:'2020-01-01'},admin).where}),1);
      assert.equal(await db.bajaProducto.count({where:filtrosBajas({productoId:prod.id,creadoPorId:admin.id},reg).where}),2);
    });
    const auth=new AuthService(db,{jwtSecret:'isolated-integration-secret',jwtExpirationSeconds:3600}), tokens={};
    for(const [rol,u] of Object.entries(users)){tokens[rol]=await auth.crearToken({id:u.id,rol}); await db.accesoModulo.create({data:{usuarioId:u.id,modulo:'bajas'}});}
    const app=express();app.use(express.json());app.use('/bajas',crearRouterBajas(db,async(req,res,next)=>{try{req.usuario=await auth.verificarSesion(req.headers.authorization?.slice(7)||'');next();}catch{res.status(401).json({error:'Sesión requerida'});}},()=>true));app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
    server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const request=(path,rol='administrador')=>fetch(`http://127.0.0.1:${server.address().port}/bajas${path}`,{headers:{Authorization:`Bearer ${tokens[rol]}`}});
    await t.test('detalle, listado y resumen protegen datos ajenos; exportación restringida',async()=>{
      const ajena=await db.bajaProducto.findFirst({where:{productoId:prod.id,creadoPorId:users.supervisor.id}});
      assert.equal((await request(`/${ajena.id}`,'evaluador')).status,404);
      assert.equal((await (await request(`?productoId=${prod.id}&creadoPorId=${users.supervisor.id}`,'evaluador')).json()).total,2);
      assert.equal((await request('/exportar','evaluador')).status,403);
      assert.equal((await request(`/${baja.id}/eventos`,'evaluador')).status,403);
    });
    await t.test('Excel y CSV respetan filtros, nombres históricos y neutralizan fórmulas',async()=>{
      const r=await request(`/exportar?productoId=${prod.id}&estado=REGISTRADA&formato=xlsx`); assert.equal(r.status,200);
      const wb=XLSX.read(Buffer.from(await r.arrayBuffer()),{type:'buffer'});const rows=XLSX.utils.sheet_to_json(wb.Sheets.Bajas);
      assert.equal(rows.length,2);assert.equal(rows[0].Producto,`=Producto ${tag}`);
      const cell=Object.values(wb.Sheets.Bajas).find(v=>v?.v===`=Producto ${tag}`);assert.equal(cell.t,'s');assert.equal(cell.f,undefined);
      const csv=await (await request(`/exportar?productoId=${prod.id}&estado=ANULADA&formato=csv`)).text(); assert.ok(csv.includes(`'=Producto ${tag}`)); assert.equal(csv.split('\r\n').length,2);
    });
    await t.test('impresión conserva filtros y responsables requieren permiso',async()=>{
      const response=await request(`/imprimir?productoId=${prod.id}&estado=REGISTRADA`);
      assert.equal(response.status,200);
      const {items}=await response.json(); assert.equal(items.length,2);
      assert.ok(items.every(r=>r.productoId===prod.id && r.estado==='REGISTRADA'));
      assert.equal((await request('/imprimir','evaluador')).status,403);
      assert.equal((await request('/responsables','evaluador')).status,403);
      const responsables=await (await request('/responsables')).json();
      assert.ok(responsables.some(r=>r.id===reg.id));
    });
  } finally {if(server)await new Promise(r=>server.close(r));await db.$disconnect();}
});
