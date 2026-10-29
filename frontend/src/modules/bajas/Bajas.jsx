import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import Modal from '../../components/ui/Modal';
import CatalogosBajas, { Selector } from './CatalogosBajas';
import './bajas.css';
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const errorTexto = e => e.response?.data?.error || 'No se pudo conectar. Reintenta sin cerrar el formulario.';
const inicial = () => ({ productoId: '', presentacionId: '', proveedorId: '', motivoId: '', cantidad: '', fechaOperativa: hoy(), motivoRetroactivo: '', observaciones: '', explicacion: '' });
const fecha = v => String(v).slice(0, 10);

export default function Bajas() {
  const location = useLocation(), navigate = useNavigate(), { id } = useParams();
  const [search, setSearch] = useSearchParams();
  const nueva = location.pathname === '/bajas' || location.pathname.endsWith('/nueva'), editar = location.pathname.endsWith('/editar');
  const enFormulario = nueva || editar;
  const [sesion, setSesion] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [responsables, setResponsables] = useState([]);
  const [cargando, setCargando] = useState(true), [revision, setRevision] = useState(0);
  const [items, setItems] = useState([]), [total, setTotal] = useState(0), [resumen, setResumen] = useState(null);
  const [detalle, setDetalle] = useState(null), [form, setForm] = useState(inicial), [labels, setLabels] = useState({});
  const [categoria, setCategoria] = useState(null), [guardada, setGuardada] = useState(null);
  const volver = location.state?.volver || '/analytics/bajas';
  const [producto, setProducto] = useState(null), [motivo, setMotivo] = useState(null);
  const [presentacionElegida, setPresentacionElegida] = useState(null);
  const [alta, setAlta] = useState(null), [anulacion, setAnulacion] = useState(false), [razon, setRazon] = useState('');
  const [eventos, setEventos] = useState(null), [impresion, setImpresion] = useState(null);
  const clave = useRef(crypto.randomUUID()), enviando = useRef(false), payloadEnviado = useRef(null), sucio = useRef(false);
  const gestor = sesion?.gestionar;
  const pagina = Number(search.get('pagina') || 1);
  const params = Object.fromEntries(search);
  if (!search.has('rango')) { params.fechaDesde = hoy(); params.fechaHasta = hoy(); }
  delete params.rango;
  const filtroKey = JSON.stringify(params);
  const actualizar = () => setRevision(v => v + 1);
  useEffect(() => {
    let vigente = true;
    if (sesion?.gestionar && !id && !nueva) apiClient.get('/bajas/responsables').then(({data}) => vigente && setResponsables(data)).catch(e => vigente && setError(errorTexto(e)));
    return () => { vigente = false; };
  }, [sesion?.gestionar, id, nueva, revision]);
  useEffect(() => {
    let vigente = true;
    apiClient.get('/bajas/sesion').then(({ data }) => vigente && setSesion(data)).catch(e => vigente && setError(errorTexto(e)));
    return () => { vigente = false; };
  }, [revision]);
  useEffect(() => {
    let vigente = true;
    setError(''); setCargando(true); setEventos(null); setImpresion(null); sucio.current = false;
    if (!sesion?.acceso) { setCargando(false); return; }
    if (nueva) {
      setForm(inicial()); setCategoria(null); setGuardada(null); setDetalle(null); setProducto(null); setMotivo(null); setPresentacionElegida(null); setLabels({}); clave.current = crypto.randomUUID(); payloadEnviado.current = null; setCargando(false);
    } else if (id) {
      apiClient.get(`/bajas/${id}`).then(({ data }) => {
        if (!vigente) return;
        setDetalle(data); setCategoria({ id: data.snapshot.categoriaId, nombre: data.snapshot.categoria, etiquetaTipo: 'Producto', requiereProveedor: data.snapshot.requiereProveedor }); setProducto(null); setMotivo(null); setPresentacionElegida(null);
        setForm({ ...inicial(), ...Object.fromEntries(Object.keys(inicial()).map(k => [k, data[k] ?? ''])), fechaOperativa: fecha(data.fechaOperativa), motivoCambio: '' });
        setLabels({ productoId: data.snapshot.producto, presentacionId: data.snapshot.presentacion, proveedorId: data.snapshot.proveedor, motivoId: data.snapshot.motivo });
      }).catch(e => vigente && setError(errorTexto(e))).finally(() => vigente && setCargando(false));
    } else {
      const filtro = JSON.parse(filtroKey);
      Promise.all([apiClient.get('/bajas', { params: { ...filtro, porPagina: 12 } }), apiClient.get('/bajas/resumen', { params: filtro })]).then(([lista, r]) => {
        if (!vigente) return; setItems(lista.data.items); setTotal(lista.data.total); setResumen(r.data);
      }).catch(e => vigente && setError(errorTexto(e))).finally(() => vigente && setCargando(false));
    }
    return () => { vigente = false; };
  }, [id, nueva, editar, filtroKey, revision, sesion?.acceso]);
  useEffect(() => {
    if (!enFormulario) return;
    const prevenir = e => { if (sucio.current) { e.preventDefault(); e.returnValue = ''; } };
    const link = e => {
      const a = e.target.closest('a[href]');
      if (a && sucio.current && !window.confirm('¿Salir sin guardar esta baja?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', prevenir); document.addEventListener('click', link, true);
    return () => { window.removeEventListener('beforeunload', prevenir); document.removeEventListener('click', link, true); };
  }, [enFormulario]);
  function elegirCategoria(value, row) {
    if (String(value) === String(categoria?.id)) return;
    if (categoria && (form.productoId || form.cantidad || form.motivoId || form.observaciones) && !window.confirm('Cambiar de categoría limpiará los datos de esta baja. ¿Continuar?')) return;
    sucio.current = true; setCategoria(value ? row : null); setProducto(null); setMotivo(null); setPresentacionElegida(null); setLabels({}); setForm(f => ({...inicial(), fechaOperativa: f.fechaOperativa, motivoRetroactivo: f.motivoRetroactivo, motivoCambio: f.motivoCambio || ''})); setGuardada(null);
  }
  function cambiar(k, v) { sucio.current = true; setForm(f => ({ ...f, [k]: v })); }
  const establecerProducto = (value, row) => {
    sucio.current = true; setProducto(row); setMotivo(null); setLabels(l => ({ ...l, productoId: row?.nombre, presentacionId: '', proveedorId: '', motivoId: '' }));
    const disponibles = row?.presentaciones?.filter(p => p.activo && p.unidad.activo) || [];
    const p = disponibles.find(p => p.predeterminada) || (disponibles.length === 1 ? disponibles[0] : null);
    setPresentacionElegida(p);
    setForm(f => ({ ...f, productoId: value, presentacionId: p ? String(p.id) : '', proveedorId: '', motivoId: '' }));
    if (p) setLabels(l => ({ ...l, presentacionId: p.nombre }));
  };
  const snapshot = producto ? { categoria: producto.categoria.nombre, categoriaId: producto.categoriaId, tipo: producto.tipo?.nombre, requiereProveedor: producto.categoria.requiereProveedor } : categoria ? { categoria: categoria.nombre, categoriaId: categoria.id, requiereProveedor: categoria.requiereProveedor } : null;
  const presentacion = producto?.presentaciones?.find(p => String(p.id) === String(form.presentacionId));
  const unidad = presentacionElegida?.unidad?.nombre || presentacion?.unidad?.nombre || (editar && String(form.presentacionId) === String(detalle?.presentacionId) ? detalle?.snapshot.unidad : 'según presentación');
  const requiereExplicacion = motivo?.explicacionObligatoria ?? (editar && String(form.motivoId) === String(detalle?.motivoId) && detalle?.snapshot.explicacionObligatoria);
  const presentacionesDisponibles = producto?.presentaciones?.filter(p => p.activo && p.unidad.activo);
  async function guardar(e) {
    e.preventDefault(); if (enviando.current) return;
    enviando.current = true; setBusy(true); setError('');
    try {
      const body = { ...Object.fromEntries(Object.keys(inicial()).map(k => [k, form[k]])), productoId: Number(form.productoId), presentacionId: Number(form.presentacionId), proveedorId: form.proveedorId ? Number(form.proveedorId) : null, motivoId: Number(form.motivoId) };
      if (editar) Object.assign(body, { version: detalle.version, motivoCambio: form.motivoCambio });
      else {
        const huella = JSON.stringify(body);
        if (payloadEnviado.current && payloadEnviado.current !== huella) throw new Error('CAMBIO_TRAS_ENVIO');
        payloadEnviado.current = huella; body.claveIdempotencia = clave.current;
      }
      const { data } = editar ? await apiClient.patch(`/bajas/${id}`, body) : await apiClient.post('/bajas', body);
      sucio.current = false; payloadEnviado.current = null;
      if (editar) navigate(`/bajas/${data.id}`, { replace: true, state: { volver } });
      else { setGuardada(data); setForm(inicial()); setProducto(null); setMotivo(null); setPresentacionElegida(null); setLabels({}); clave.current = crypto.randomUUID(); }
    } catch (e) {
      if (e.response && e.response.status < 500 && e.response.status !== 409) payloadEnviado.current = null;
      setError(e.message === 'CAMBIO_TRAS_ENVIO' ? 'El envío anterior no se confirmó. Reintenta con los mismos datos o consulta el historial antes de iniciar otro registro.' : errorTexto(e));
    } finally { setBusy(false); enviando.current = false; }
  }
  function filtrar(k, v) {
    const next = new URLSearchParams(search);
    if (!next.has('rango')) { next.set('fechaDesde', hoy()); next.set('fechaHasta', hoy()); }
    next.set('rango', 'personalizado'); next.delete('pagina');
    if (v) next.set(k, v); else next.delete(k);
    setSearch(next, { replace: true });
  }
  async function exportar(formato) {
    setBusy(true); setError('');
    try {
      const response = await apiClient.get('/bajas/exportar', { params: { ...params, formato }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data); const a = document.createElement('a'); a.href = url; a.download = `CEPROD-Bajas-${hoy()}.${formato}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { if (e.response?.data instanceof Blob) { try { setError(JSON.parse(await e.response.data.text()).error); } catch { setError('No se pudo exportar'); } } else setError(errorTexto(e)); }
    finally { setBusy(false); }
  }
  async function prepararImpresion() {
    setBusy(true); setError('');
    try {
      setImpresion((await apiClient.get('/bajas/imprimir', { params })).data.items);
    } catch (e) { setError(errorTexto(e)); } finally { setBusy(false); }
  }
  const selector = (key, tipo, label, extra = {}) => <Selector tipo={tipo} label={label} value={form[key]} selectedLabel={labels[key]} {...extra} onChange={(v, row) => {
    cambiar(key, v); setLabels(l => ({ ...l, [key]: row?.nombre })); if (key === 'productoId') establecerProducto(v, row); if (key === 'motivoId') { setMotivo(row); setForm(f => ({...f, explicacion: ''})); } if (key === 'presentacionId') setPresentacionElegida(row);
  }} onCreate={gestor ? () => setAlta({ tipo, key }) : undefined} />;
  if (!sesion) return <section className="section-card"><p>{error || 'Comprobando acceso…'}</p>{error && <button onClick={actualizar}>Reintentar</button>}</section>;
  if (!sesion.acceso) return <section className="section-card"><h1>Bajas de productos</h1><p>{sesion.habilitado ? 'Solicita al administrador acceso al módulo.' : 'El módulo no está habilitado.'}</p><Link to="/">Volver al inicio</Link></section>;
  if (editar && !gestor) return <p>No tienes permiso para corregir bajas.</p>;
  return <div className="bajas-page page-shell">
    <header className="page-header bajas-no-print"><div><h1 className="page-title">{enFormulario ? editar ? 'Corregir baja' : 'Registrar baja' : id ? 'Detalle de baja' : 'Analytics · Bajas de productos'}</h1><p>{gestor ? 'Consulta y gestiona las bajas de CEPROD.' : 'Registra las bajas del día y consulta tus propios registros.'}</p></div><div className="bajas-actions">
      {(id || nueva) && <Link className="btn btn-outline" to={volver}>{nueva ? 'Consultar historial' : 'Volver al historial'}</Link>}
      {!enFormulario && <Link className="btn btn-primary" to="/bajas">{id ? 'Registrar otra baja' : 'Registrar baja'}</Link>}
      {gestor && !enFormulario && <Link className="btn btn-outline" to="/administracion/catalogos-bajas">Administrar catálogos</Link>}
    </div></header>
    {error && <div role="alert" className="section-card bajas-error"><p>{error}</p>{!enFormulario && <button className="btn btn-outline" onClick={actualizar}>Reintentar</button>}</div>}
    {cargando && <p role="status">Cargando…</p>}
    {guardada && nueva && <div className="section-card" role="status"><div className="section-card-body"><strong>Baja registrada correctamente.</strong><p>Puedes registrar otra baja en {categoria?.nombre}.</p><Link className="btn btn-outline" to={`/bajas/${guardada.id}`} state={{volver:'/analytics/bajas'}}>Ver registro</Link></div></div>}
    {!cargando && enFormulario && (nueva || detalle) && <form onSubmit={guardar} className="section-card"><div className="section-card-body">
      <fieldset className="bajas-form" disabled={busy}>
        <Selector tipo="categorias" label="Categoría" retainWhileSearching value={categoria?.id || ''} selectedLabel={categoria?.nombre} onChange={elegirCategoria} onCreate={gestor ? () => setAlta({tipo:'categorias',key:'categoriaId'}) : undefined} />
        {!categoria && <p>Selecciona una categoría para comenzar.</p>}
        {categoria && <>
        <h2>Baja de {categoria.nombre}</h2>
        <div className="bajas-grid">
          <label className="bajas-field">Fecha de la baja<input className="input-field" type="date" required max={hoy()} value={form.fechaOperativa} disabled={!gestor} onChange={e => cambiar('fechaOperativa', e.target.value)} /></label>
          {form.fechaOperativa < hoy() && <label className="bajas-field">Motivo del registro en fecha anterior<textarea className="input-field" required minLength={3} maxLength={500} value={form.motivoRetroactivo} onChange={e => cambiar('motivoRetroactivo', e.target.value)} /></label>}
        </div>
        {selector('productoId', 'productos', categoria.etiquetaTipo || 'Producto', { categoriaId: categoria.id })}

        {form.productoId && (presentacionesDisponibles?.length === 1 ? <p>Presentación: <strong>{presentacionesDisponibles[0].nombre}</strong></p> : selector('presentacionId', 'presentaciones', 'Presentación', { productoId: form.productoId }))}
        <label className="bajas-field">Cantidad ({unidad})<input className="input-field" inputMode="decimal" required pattern="[0-9]+([.,][0-9]+)?" maxLength={15} placeholder="Ejemplo: 2" value={form.cantidad} onChange={e => cambiar('cantidad', e.target.value)} /></label>
        {snapshot?.requiereProveedor && selector('proveedorId', 'proveedores', 'Proveedor obligatorio', { categoriaId: snapshot.categoriaId })}
        {selector('motivoId', 'motivos', 'Motivo de baja', { categoriaId: snapshot?.categoriaId })}
        {requiereExplicacion && <label className="bajas-field">Explicación (obligatoria)<textarea className="input-field" required minLength={3} maxLength={500} value={form.explicacion} onChange={e => cambiar('explicacion', e.target.value)} /></label>}
        <label className="bajas-field">Observaciones (opcional)<textarea className="input-field" maxLength={500} value={form.observaciones} onChange={e => cambiar('observaciones', e.target.value)} /></label>
        {editar && <label className="bajas-field">Motivo de la corrección<textarea className="input-field" required minLength={3} maxLength={500} value={form.motivoCambio} onChange={e => cambiar('motivoCambio', e.target.value)} /></label>}
        <p>Se registrará con tu usuario. Revisa el producto, la cantidad y la fecha antes de guardar.</p>
        <button className="btn btn-primary" disabled={!form.productoId || !form.presentacionId || !form.motivoId}>{busy ? 'Guardando…' : editar ? 'Guardar corrección' : 'Registrar baja'}</button>
        </>}
      </fieldset>
    </div></form>}
    {!cargando && id && !editar && detalle && <section className="section-card"><div className="section-card-body"><h2>{detalle.snapshot.producto}</h2><p><strong>{detalle.cantidad} {detalle.snapshot.unidad}</strong> · {detalle.estado}</p><dl className="bajas-detail">
      {Object.entries({ Identificador: detalle.id, 'Fecha de baja': fecha(detalle.fechaOperativa), 'Registrado el': new Date(detalle.creadoEn).toLocaleString('es-BO', { timeZone: 'America/La_Paz' }), Responsable: detalle.snapshot.responsable, Categoría: detalle.snapshot.categoria, Tipo: detalle.snapshot.tipo, Presentación: detalle.snapshot.presentacion, Proveedor: detalle.snapshot.proveedor, Motivo: detalle.snapshot.motivo, Explicación: detalle.explicacion, Observaciones: detalle.observaciones, 'Motivo retroactivo': detalle.motivoRetroactivo, 'Motivo de anulación': detalle.motivoAnulacion }).filter(([,v]) => v).map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>{gestor && <div className="bajas-actions">{detalle.estado === 'REGISTRADA' && <><Link className="btn btn-outline" to={`/bajas/${id}/editar`} state={{volver}}>Corregir</Link><button className="btn btn-outline" onClick={() => { setAnulacion(true); setRazon(''); }}>Anular</button></>}<button className="btn btn-outline" onClick={async () => { try { setEventos((await apiClient.get(`/bajas/${id}/eventos`)).data); } catch(e) { setError(errorTexto(e)); } }}>Historial de cambios</button></div>}</div></section>}
    {!id && !nueva && <>
      <section className="section-card bajas-no-print"><div className="section-card-body"><div className="bajas-toolbar">
        <label>Desde<input className="input-field" type="date" value={params.fechaDesde || ''} onChange={e => filtrar('fechaDesde', e.target.value)} /></label>
        <label>Hasta<input className="input-field" type="date" value={params.fechaHasta || ''} onChange={e => filtrar('fechaHasta', e.target.value)} /></label>
        <label>Estado<select className="input-field" value={params.estado || 'TODOS'} onChange={e => filtrar('estado', e.target.value)}><option value="TODOS">Todos</option><option value="REGISTRADA">Registradas</option><option value="ANULADA">Anuladas</option></select></label>
        <label>Buscar<input className="input-field" type="search" value={params.q || ''} placeholder="Producto, responsable o identificador" onChange={e => filtrar('q', e.target.value)} /></label>
        {gestor && <label>Responsable<select className="input-field" value={params.creadoPorId || ''} onChange={e => filtrar('creadoPorId',e.target.value)}><option value="">Todos</option>{responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></label>}
      </div><div className="bajas-actions"><button className="btn btn-outline" onClick={() => setSearch({})}>Hoy / limpiar filtros</button><button className="btn btn-outline" onClick={() => setSearch({ rango: 'todo' })}>Todo el historial</button></div>
      <details><summary>Más filtros</summary><div className="bajas-grid">{[['categoriaId','categorias','Categoría'],['tipoId','tipos','Tipo'],['productoId','productos','Producto'],['presentacionId','presentaciones','Presentación'],['unidadId','unidades','Unidad'],['proveedorId','proveedores','Proveedor'],['motivoId','motivos','Motivo']].map(([key,t,label]) => <Selector key={key} tipo={t} label={label} estado={gestor ? 'todos' : 'activos'} value={params[key] || ''} onChange={v => filtrar(key,v)} />)}</div></details>
      {gestor && <div className="bajas-actions"><button className="btn btn-outline" disabled={busy} onClick={() => exportar('xlsx')}>Exportar Excel</button><button className="btn btn-outline" disabled={busy} onClick={() => exportar('csv')}>Exportar CSV</button><button className="btn btn-outline" disabled={busy} onClick={prepararImpresion}>Preparar impresión</button></div>}
      </div></section>
      {!cargando && !error && resumen && <section className="section-card bajas-no-print"><div className="section-card-body"><h2>Resumen del filtro</h2><p><strong>{resumen.registradas}</strong> registros efectivos · <strong>{resumen.anuladas}</strong> anulados</p><p>Cantidades separadas por producto y presentación. No se mezclan unidades. Hasta {resumen.limiteGrupos} grupos con más registros; nombres actuales de catálogo.</p><ul className="bajas-list">{resumen.grupos.map((g,i) => <li key={i}><span>{g.producto} · {g.presentacion}</span><strong>{g.cantidad} {g.unidad}</strong></li>)}</ul></div></section>}
      {!cargando && !error && resumen && <section className="section-card bajas-no-print"><div className="section-card-body"><details><summary>Distribución de registros por categoría, motivo y proveedor</summary><p>Hasta 20 grupos por sección, con los nombres actuales de los catálogos.</p><div className="bajas-grid">{[['categorias','Categorías'],['motivos','Motivos'],['proveedores','Proveedores']].map(([key,title]) => <div key={key}><h3>{title}</h3><ul className="bajas-list">{resumen[key]?.map((r,i) => <li key={i}><span>{r.nombre}</span><strong>{r.registros} registros</strong></li>)}</ul></div>)}</div></details></div></section>}
      {!cargando && !error && <section className="section-card bajas-no-print"><div className="section-card-body"><h2>Historial · {total} registros</h2>{!items.length && <p>No hay bajas para estos filtros. Puedes cambiar el rango o registrar la primera baja.</p>}<ul className="bajas-list">{items.map(r => <li key={r.id}><div><strong>{r.snapshot.producto}</strong><p>{fecha(r.fechaOperativa)} · {r.cantidad} {r.snapshot.unidad} · {r.estado}</p><p>{r.snapshot.motivo} · {r.snapshot.responsable}</p></div><Link className="btn btn-outline" to={`/bajas/${r.id}`} state={{volver: location.pathname + location.search}}>Ver detalle</Link></li>)}</ul><div className="bajas-actions"><button className="btn btn-outline" disabled={pagina <= 1} onClick={() => { const s = new URLSearchParams(search); s.set('pagina', String(pagina - 1)); setSearch(s); }}>Anterior</button><span>Página {pagina} de {Math.max(1,Math.ceil(total / 12))}</span><button className="btn btn-outline" disabled={pagina * 12 >= total} onClick={() => { const s = new URLSearchParams(search); s.set('pagina', String(pagina + 1)); setSearch(s); }}>Siguiente</button></div></div></section>}
    </>}
    {alta && <CatalogosBajas soloAlta={alta.tipo} contextoLabels={{categoriaId:categoria?.nombre,productoId:labels.productoId}} contexto={alta.tipo === 'presentaciones' ? { productoId: form.productoId } : alta.tipo === 'productos' ? { categoriaId: categoria?.id || '' } : {}} onCerrar={() => setAlta(null)} onCreado={async row => {
      const key = alta.key; if (key === 'categoriaId') { elegirCategoria(String(row.id), row); setAlta(null); return; } cambiar(key, String(row.id)); setLabels(l => ({ ...l, [key]: row.nombre })); setAlta(null);
      if (key === 'productoId') establecerProducto(String(row.id), row);
      if (key === 'motivoId') setMotivo(row);
      if (key === 'presentacionId') setPresentacionElegida(row);
    }} />}
    {anulacion && <Modal label="Anular baja" busy={busy} onClose={() => !busy && setAnulacion(false)}><form className="modal-content bajas-dialog" onSubmit={async e => { e.preventDefault(); if(enviando.current) return; enviando.current=true; setBusy(true); try { await apiClient.post(`/bajas/${id}/anular`, { version: detalle.version, motivo: razon }); setAnulacion(false); actualizar(); } catch(e) { setError(errorTexto(e)); } finally { setBusy(false); enviando.current=false; } }}><h2>Anular baja</h2><p>El registro se conservará, pero dejará de sumar en las cantidades efectivas.</p><label>Motivo<textarea className="input-field" required minLength={3} maxLength={500} value={razon} onChange={e => setRazon(e.target.value)} disabled={busy} /></label>{error && <p role="alert">{error}</p>}<div className="bajas-actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setAnulacion(false)}>Cancelar</button><button className="btn btn-primary" disabled={busy}>Confirmar anulación</button></div></form></Modal>}
    {eventos && <Modal label="Auditoría de baja" onClose={() => setEventos(null)}><div className="modal-content bajas-dialog"><h2>Historial de cambios</h2>{eventos.items.map(e => <article key={e.id}><h3>{e.accion}</h3><p>{new Date(e.creadoEn).toLocaleString('es-BO', {timeZone:'America/La_Paz'})} · Usuario #{e.usuarioId}</p><p>{e.motivo}</p><details><summary>Antes y después</summary><pre>{JSON.stringify({antes:e.antes,despues:e.despues},null,2)}</pre></details></article>)}<div className="bajas-actions">{[[-1,'Anterior'],[1,'Siguiente']].map(([delta,label]) => <button key={label} className="btn btn-outline" disabled={delta < 0 ? eventos.pagina <= 1 : eventos.pagina * 20 >= eventos.total} onClick={async () => { try { setEventos((await apiClient.get(`/bajas/${id}/eventos`, {params:{pagina:eventos.pagina+delta}})).data); } catch(e) {setError(errorTexto(e));} }}>{label}</button>)}<button className="btn btn-primary" onClick={() => setEventos(null)}>Cerrar</button></div></div></Modal>}
    {impresion && <section className="section-card bajas-print"><h2>CEPROD · Registro de bajas</h2><p>Filtros: {JSON.stringify(params)} · {impresion.length} registros · Generado: {new Date().toLocaleString('es-BO')}</p><p>Las anuladas no suman como bajas efectivas.</p><div className="bajas-actions bajas-no-print"><button className="btn btn-primary" onClick={() => window.print()}>Imprimir ahora</button><button className="btn btn-outline" onClick={() => setImpresion(null)}>Cerrar vista de impresión</button></div>{impresion.map(r => <article key={r.id}><h3>{r.snapshot.producto} · {r.cantidad} {r.snapshot.unidad}</h3><p>{fecha(r.fechaOperativa)} · {r.estado} · {r.id}</p><p>{r.snapshot.categoria} · {r.snapshot.presentacion} · {r.snapshot.proveedor}</p><p>{r.snapshot.motivo} · {r.explicacion} · {r.observaciones}</p><p>Responsable: {r.snapshot.responsable}</p></article>)}</section>}
  </div>;
}
