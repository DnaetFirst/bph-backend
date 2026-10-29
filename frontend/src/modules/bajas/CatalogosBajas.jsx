import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api/client';
import Modal from '../../components/ui/Modal';
import './bajas.css';

const nombres = { categorias: 'Categorías', tipos: 'Tipos y cortes', productos: 'Productos', presentaciones: 'Presentaciones', unidades: 'Unidades', proveedores: 'Proveedores', motivos: 'Motivos' };
const defaults = {
  categorias: { nombre: '', orden: 0, etiquetaTipo: 'Tipo de producto', requiereTipo: false, requiereProveedor: false },
  tipos: { nombre: '', categoriaId: '' },
  productos: { nombre: '', codigo: '', categoriaId: '', tipoId: '', presentacionNombre: 'Unidad', unidadId: '' },
  presentaciones: { nombre: '', productoId: '', unidadId: '', predeterminada: false },
  unidades: { nombre: '', abreviatura: '', decimales: 0 },
  proveedores: { nombre: '', codigo: '', todasCategorias: true, categoriaIds: [] },
  motivos: { nombre: '', explicacionObligatoria: false, todasCategorias: true, categoriaIds: [] },
};
const mensaje = e => e.response?.data?.error || 'No se pudo conectar. Tus cambios siguen en el formulario.';

// Selector paginado: nunca descarga todo el catálogo ni pierde una opción fuera de página.
export function Selector({ tipo, label, value, onChange, onCreate, categoriaId, productoId, selectedLabel, estado = 'activos' }) {
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0 });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  useEffect(() => { setPagina(1); }, [tipo, categoriaId, productoId, estado]);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    const timer = setTimeout(() => {
      apiClient.get(`/bajas/catalogos/${tipo}`, { params: { q, pagina, porPagina: 20, estado, ...(categoriaId ? { categoriaId } : {}), ...(productoId ? { productoId } : {}) } })
        .then(({ data }) => { if (vigente) { setResult(data); setError(''); } })
        .catch(e => vigente && setError(mensaje(e)))
        .finally(() => vigente && setCargando(false));
    }, 200);
    return () => { vigente = false; clearTimeout(timer); };
  }, [tipo, q, pagina, categoriaId, productoId, value, estado]);
  return <fieldset className="bajas-selector"><legend>{label}</legend>
    <input className="input-field" aria-label={`Buscar ${label}`} placeholder="Escribe para buscar…" value={q} onChange={e => { setQ(e.target.value); setPagina(1); }} />
    <select className="input-field" aria-label={label} value={value || ''} onChange={e => onChange(e.target.value, result.items.find(r => String(r.id) === e.target.value))}>
      <option value="">Selecciona una opción</option>
      {value && !result.items.some(r => String(r.id) === String(value)) && <option value={value}>{selectedLabel || `Selección actual #${value}`}</option>}
      {result.items.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
    </select>
    {cargando && <small role="status">Buscando opciones…</small>}
    {error && <p role="alert">{error} Modifica la búsqueda para reintentar.</p>}
    <div className="bajas-actions">
      <button type="button" className="btn btn-outline btn-small" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
      <small>{pagina} / {Math.max(1, Math.ceil(result.total / 20))}</small>
      <button type="button" className="btn btn-outline btn-small" disabled={pagina * 20 >= result.total} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
      {onCreate && <button type="button" className="btn btn-outline btn-small" onClick={onCreate}>Agregar…</button>}
    </div>
  </fieldset>;
}

export default function CatalogosBajas({ soloAlta = null, onCreado, onCerrar, contexto = {} }) {
  const [sesion, setSesion] = useState(null);
  const [tipo, setTipo] = useState('productos');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('activos');
  const [pagina, setPagina] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ items: [], total: 0 });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState('');
  const [stack, setStack] = useState(() => soloAlta ? [{ tipo: soloAlta, row: null, form: { ...defaults[soloAlta], ...contexto }, labels: {} }] : []);
  const [dialogError, setDialogError] = useState('');
  const [accion, setAccion] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [historial, setHistorial] = useState(null);
  const [accesos, setAccesos] = useState(null);
  const submitting = useRef(false);
  const current = stack.at(-1);
  const reload = () => setRevision(v => v + 1);
  useEffect(() => {
    let vigente = true;
    apiClient.get('/bajas/sesion').then(({ data }) => vigente && setSesion(data)).catch(e => vigente && setError(mensaje(e)));
    return () => { vigente = false; };
  }, [revision]);
  useEffect(() => {
    if (!sesion?.gestionar) { setCargando(false); return; }
    let vigente = true;
    setCargando(true);
    const timer = setTimeout(() => {
      apiClient.get(`/bajas/catalogos/${tipo}`, { params: { q, estado, pagina, porPagina: 12 } }).then(({ data }) => {
        if (!vigente) return;
        setResult(data); setError('');
        if (pagina > Math.max(1, Math.ceil(data.total / 12))) setPagina(Math.max(1, Math.ceil(data.total / 12)));
      }).catch(e => vigente && setError(mensaje(e))).finally(() => vigente && setCargando(false));
    }, 200);
    return () => { vigente = false; clearTimeout(timer); };
  }, [tipo, q, estado, pagina, revision, sesion?.gestionar]);
  useEffect(() => {
    if (!stack.length) return;
    const prevenir = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', prevenir);
    return () => window.removeEventListener('beforeunload', prevenir);
  }, [stack.length]);
  function abrir(tipo, row, returnField, seed = {}) {
    const form = { ...defaults[tipo], ...seed };
    if (row) for (const key of Object.keys(defaults[tipo])) {
      if (key === 'categoriaIds') form[key] = row.categorias?.map(c => c.categoriaId) || [];
      else if (row[key] !== undefined) form[key] = row[key] ?? '';
    }
    setDialogError('');
    setStack(prev => [...prev, { tipo, row, form, returnField, labels: { categoriaId: row?.categoria?.nombre, tipoId: row?.tipo?.nombre, productoId: row?.producto?.nombre, unidadId: row?.unidad?.nombre } }]);
  }
  function campo(key, value, label) {
    setStack(prev => prev.map((item, i) => i === prev.length - 1 ? { ...item, form: { ...item.form, [key]: value, ...(key === 'categoriaId' ? { tipoId: '' } : {}) }, labels: { ...item.labels, ...(label ? { [key]: label } : {}) } } : item));
  }
  function cerrar() {
    if (busy) return;
    if (stack.length && !window.confirm('¿Cerrar este formulario sin guardar los cambios?')) return;
    setStack(s => s.slice(0, -1)); setDialogError('');
    if (soloAlta && stack.length === 1) onCerrar?.();
  }
  async function guardar(e) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setDialogError('');
    try {
      const { tipo: t, row, form, returnField } = current;
      const body = Object.fromEntries(Object.keys(defaults[t]).filter(k => !['presentacionNombre', 'unidadId'].includes(k) || t !== 'productos').map(k => [k, form[k]]));
      for (const key of ['categoriaId', 'productoId', 'unidadId', 'orden', 'decimales']) if (key in body) body[key] = Number(body[key]);
      if ('tipoId' in body) body.tipoId = body.tipoId ? Number(body.tipoId) : null;
      if ('codigo' in body) body.codigo = body.codigo?.trim() || null;
      if (t === 'productos' && !row) body.presentacion = { nombre: form.presentacionNombre, unidadId: Number(form.unidadId) };
      if (row) Object.assign(body, { version: row.version, motivoCambio: form.motivoCambio || '' });
      const { data } = row ? await apiClient.put(`/bajas/catalogos/${t}/${row.id}`, body) : await apiClient.post(`/bajas/catalogos/${t}`, body);
      setStack(prev => {
        const next = prev.slice(0, -1);
        if (next.length && returnField) {
          const parent = next.at(-1);
          parent.form = { ...parent.form, [returnField]: returnField === 'categoriaIds' ? [...new Set([...parent.form.categoriaIds, data.id])] : String(data.id) };
          parent.labels = { ...parent.labels, [returnField]: data.nombre };
        }
        return next;
      });
      setAviso(`${data.nombre}: cambios guardados.`); reload();
      if (soloAlta && stack.length === 1) onCreado?.(data, t);
    } catch (e) { setDialogError(mensaje(e)); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function cambiar(e) {
    e.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setDialogError('');
    try {
      if (accion.acceso) {
        await apiClient.put(`/bajas/accesos/${accion.row.id}`, { activo: !accion.row.acceso, version: accion.row.version, motivo });
        setAccesos((await apiClient.get('/bajas/accesos')).data);
      } else await apiClient.post(`/bajas/catalogos/${tipo}/${accion.row.id}/${accion.row.activo ? 'desactivar' : 'restaurar'}`, { version: accion.row.version, motivo });
      setAccion(null); setAviso('Estado actualizado. El historial se conserva.'); reload();
    } catch (e) { setDialogError(mensaje(e)); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function verEventos(row, pagina = 1) {
    try { const { data } = await apiClient.get(`/bajas/catalogos/${tipo}/${row.id}/eventos`, { params: { pagina } }); setHistorial({ ...data, row }); }
    catch (e) { setError(mensaje(e)); }
  }
  const text = (key, label, props = {}) => <label className="bajas-field">{label}<input className="input-field" value={current.form[key] ?? ''} onChange={e => campo(key, e.target.value)} {...props} /></label>;
  const check = (key, label) => <label className="bajas-check"><input type="checkbox" checked={Boolean(current.form[key])} onChange={e => campo(key, e.target.checked)} />{label}</label>;
  const select = (key, t, label, filters = {}) => <Selector tipo={t} label={label} value={current.form[key]} selectedLabel={current.labels[key]} onChange={(v, row) => campo(key, v, row?.nombre)} {...filters} onCreate={() => abrir(t, null, key, filters.categoriaId ? { categoriaId: filters.categoriaId } : {})} />;
  if (!sesion) return <section className="section-card"><p>{error || 'Comprobando acceso…'}</p>{error && <button className="btn" onClick={reload}>Reintentar</button>}</section>;
  if (!sesion.gestionar) return <section className="section-card"><h1>Catálogos de Bajas</h1><p>{sesion.habilitado ? 'Esta sección requiere acceso de administrador o supervisor.' : 'El módulo todavía no está habilitado. BPH continúa disponible.'}</p></section>;
  return <div className="bajas-page page-shell">
    {!soloAlta && <>
    <header className="page-header"><div><h1 className="page-title">Catálogos de Bajas</h1><p>Prepara las opciones del registro. Desactivar conserva toda la información.</p></div>
      {sesion.administrarAccesos && <button className="btn btn-outline" onClick={async () => { try { setAccesos((await apiClient.get('/bajas/accesos')).data); } catch (e) { setError(mensaje(e)); } }}>Accesos al módulo</button>}
    </header>
    <nav className="bajas-tabs" aria-label="Catálogos">{Object.entries(nombres).map(([k, label]) => <button key={k} type="button" className={`btn ${tipo === k ? 'btn-primary' : 'btn-outline'}`} aria-current={tipo === k ? 'page' : undefined} onClick={() => { setTipo(k); setPagina(1); setQ(''); setError(''); }}>{label}</button>)}</nav>
    <section className="section-card"><div className="section-card-body">
      <div className="bajas-toolbar"><label>Buscar<input className="input-field" type="search" placeholder={`Buscar ${nombres[tipo].toLowerCase()}`} value={q} onChange={e => { setQ(e.target.value); setPagina(1); }} /></label>
        <label>Mostrar<select className="input-field" value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }}><option value="activos">Activos disponibles</option><option value="inactivos">Desactivados</option><option value="todos">Todos, incluidos los de categorías inactivas</option></select></label>
        <button className="btn btn-primary" onClick={() => abrir(tipo)}>Agregar opción</button>
      </div>
      {aviso && <p role="status" className="bajas-notice">{aviso}</p>}
      {error && <div role="alert"><p>{error}</p><button className="btn btn-outline" onClick={reload}>Reintentar</button></div>}
      {cargando ? <p role="status">Cargando opciones…</p> : !error && <>
        <p>{result.total} opciones · Página {pagina} de {Math.max(1, Math.ceil(result.total / 12))}</p>
        {!result.items.length && <p className="bajas-empty">No hay opciones para estos filtros. Puedes cambiar la búsqueda o agregar una nueva.</p>}
        <ul className="bajas-list">{result.items.map(row => <li key={row.id}>
          <div><strong>{row.nombre}</strong><p>{row.categoria?.nombre || row.producto?.nombre || row.abreviatura || ''}{row.unidad ? ` · ${row.unidad.nombre}` : ''}{row.predeterminada ? ' · Predeterminada' : ''}</p><small>{row.activo ? 'Activo' : 'Desactivado'} · Versión {row.version}{row.categoria && !row.categoria.activo ? ' · Categoría desactivada' : ''}</small></div>
          <div className="bajas-actions"><button className="btn btn-outline" disabled={!row.activo} onClick={() => abrir(tipo, row)}>Editar</button><button className="btn btn-outline" onClick={() => { setAccion({ row }); setMotivo(''); setDialogError(''); }}>{row.activo ? 'Desactivar' : 'Restaurar'}</button><button className="btn btn-outline" onClick={() => verEventos(row)}>Historial</button></div>
        </li>)}</ul>
        <div className="bajas-actions"><button className="btn btn-outline" disabled={pagina === 1} onClick={() => setPagina(v => v - 1)}>Anterior</button><button className="btn btn-outline" disabled={pagina * 12 >= result.total} onClick={() => setPagina(v => v + 1)}>Siguiente</button></div>
      </>}
    </div></section>
    </>}
    {current && <Modal key={`${current.tipo}-${stack.length}`} label={`${current.row ? 'Editar' : 'Agregar'} ${nombres[current.tipo]}`} onClose={cerrar} busy={busy}><form className="modal-content bajas-dialog" onSubmit={guardar}>
      <h2>{current.row ? 'Editar' : 'Agregar'} · {nombres[current.tipo]}</h2>
      {stack.length > 1 && <p>Al guardar regresarás al formulario anterior con esta opción seleccionada.</p>}
      <fieldset disabled={busy} className="bajas-form">
        {text('nombre', 'Nombre', { required: true, minLength: 2, maxLength: 100 })}
        {['productos', 'proveedores'].includes(current.tipo) && text('codigo', 'Código interno (opcional)', { maxLength: 40 })}
        {current.tipo === 'categorias' && <>{text('etiquetaTipo', 'Cómo llamar al tipo', { required: true, maxLength: 60 })}{text('orden', 'Orden', { type: 'number', min: 0, max: 9999, required: true })}{check('requiereTipo', 'Exigir tipo de producto')}{check('requiereProveedor', 'Exigir proveedor')}</>}
        {['tipos', 'productos'].includes(current.tipo) && select('categoriaId', 'categorias', 'Categoría')}
        {current.tipo === 'productos' && <>
          {current.form.categoriaId && select('tipoId', 'tipos', 'Tipo (según categoría)', { categoriaId: current.form.categoriaId })}
          {!current.row && <>{text('presentacionNombre', 'Nombre de la presentación inicial', { required: true, minLength: 2, maxLength: 100 })}{select('unidadId', 'unidades', 'Unidad de registro')}</>}
          {current.row && <p>Para cambiar las presentaciones utiliza el catálogo «Presentaciones».</p>}
        </>}
        {current.tipo === 'presentaciones' && <>{select('productoId', 'productos', 'Producto')}{select('unidadId', 'unidades', 'Unidad')}{check('predeterminada', 'Usar como presentación predeterminada')}</>}
        {current.tipo === 'unidades' && <>{text('abreviatura', 'Abreviatura', { required: true, maxLength: 12 })}<label>Decimales permitidos<select className="input-field" value={current.form.decimales} onChange={e => campo('decimales', Number(e.target.value))}>{[0, 1, 2, 3].map(v => <option key={v} value={v}>{v === 0 ? '0 — Solo cantidades enteras' : v}</option>)}</select></label></>}
        {current.tipo === 'motivos' && check('explicacionObligatoria', 'Exigir explicación al elegir este motivo')}
        {['motivos', 'proveedores'].includes(current.tipo) && <>{check('todasCategorias', 'Disponible en todas las categorías')}{!current.form.todasCategorias && <>
          <Selector tipo="categorias" label="Agregar categoría aplicable" value="" onChange={(v, row) => { if (v) { campo('categoriaIds', [...new Set([...current.form.categoriaIds, Number(v)])]); setStack(s => s.map((x, i) => i === s.length - 1 ? { ...x, labels: { ...x.labels, [v]: row?.nombre } } : x)); } }} onCreate={() => abrir('categorias', null, 'categoriaIds')} />
          <ul>{current.form.categoriaIds.map(id => <li key={id}>{current.labels[id] || `Categoría #${id}`} <button type="button" className="btn btn-outline" onClick={() => campo('categoriaIds', current.form.categoriaIds.filter(v => v !== id))}>Quitar</button></li>)}</ul>
        </>}</>}
        {current.row && text('motivoCambio', 'Motivo del cambio', { required: true, minLength: 3, maxLength: 500 })}
      </fieldset>
      {dialogError && <p role="alert" className="bajas-error">{dialogError}</p>}
      <div className="bajas-actions"><button type="button" className="btn btn-outline" onClick={cerrar} disabled={busy}>{stack.length > 1 ? 'Volver sin guardar' : 'Cancelar'}</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar opción'}</button></div>
    </form></Modal>}
    {accion && <Modal label="Cambiar estado" busy={busy} onClose={() => !busy && setAccion(null)}><form className="modal-content bajas-dialog" onSubmit={cambiar}><h2>{accion.acceso ? (accion.row.acceso ? 'Retirar acceso' : 'Dar acceso') : accion.row.activo ? 'Desactivar opción' : 'Restaurar opción'}</h2><p>{accion.row.nombre}</p><p>{accion.acceso ? 'El permiso se verificará en cada solicitud.' : 'La información histórica se conservará. Las dependencias se comprobarán antes de guardar.'}</p><label>Motivo<textarea className="input-field" required minLength={3} maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} disabled={busy} /></label>{dialogError && <p role="alert">{dialogError}</p>}<div className="bajas-actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setAccion(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy}>Confirmar</button></div></form></Modal>}
    {historial && <Modal label="Historial de cambios" onClose={() => setHistorial(null)}><div className="modal-content bajas-dialog"><h2>Historial · {historial.row.nombre}</h2>{historial.items.map(ev => <article key={ev.id}><h3>{ev.accion}</h3><p>{new Date(ev.creadoEn).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })} · {ev.usuarioId ? `Usuario #${ev.usuarioId}` : 'Inicialización del sistema'}</p><p>{ev.motivo}</p><details><summary>Ver valores anteriores y posteriores</summary><pre>{JSON.stringify({ antes: ev.antes, despues: ev.despues }, null, 2)}</pre></details></article>)}<div className="bajas-actions"><button className="btn btn-outline" disabled={historial.pagina <= 1} onClick={() => verEventos(historial.row, historial.pagina - 1)}>Anterior</button><button className="btn btn-outline" disabled={historial.pagina * 20 >= historial.total} onClick={() => verEventos(historial.row, historial.pagina + 1)}>Siguiente</button><button className="btn btn-primary" onClick={() => setHistorial(null)}>Cerrar</button></div></div></Modal>}
    {accesos && !accion && <Modal label="Accesos al módulo" onClose={() => setAccesos(null)}><div className="modal-content bajas-dialog"><h2>Accesos a Bajas</h2><p>El rol define las acciones. Dar acceso no convierte a un registrador en supervisor.</p><ul className="bajas-list">{accesos.map(u => <li key={u.id}><div><strong>{u.nombre}</strong><p>{u.rol} · {u.acceso ? 'Con acceso' : 'Sin acceso'}</p></div>{u.rol !== 'administrador' && <button className="btn btn-outline" onClick={() => { setAccion({ row: u, acceso: true }); setMotivo(''); setDialogError(''); }}>{u.acceso ? 'Retirar' : 'Dar acceso'}</button>}</li>)}</ul><button className="btn btn-primary" onClick={() => setAccesos(null)}>Cerrar</button></div></Modal>}
  </div>;
}
