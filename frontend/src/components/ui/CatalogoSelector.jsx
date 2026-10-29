import { useEffect, useId, useRef, useState } from 'react';
import { apiClient } from '../../api/client';

export default function CatalogoSelector({ tipo, label, value, onChange, onCreate, categoriaId, productoId, selectedLabel, estado = 'activos', disabled = false, retainWhileSearching = false }) {
  const id = useId(), root = useRef(null), input = useRef(null), cache = useRef(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(null);
  const [pagina, setPagina] = useState(1), [revision, setRevision] = useState(0);
  const [rows, setRows] = useState([]), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [active, setActive] = useState(-1);
  const q = query ?? '';
  const selected = rows.find(r => String(r.id) === String(value));
  const text = selectedLabel || selected?.nombre || (String(cache.current?.id) === String(value) ? cache.current?.nombre : '') || (value ? 'Selección actual' : '');
  useEffect(() => { setPagina(1); setRows([]); setActive(-1); }, [q, tipo, categoriaId, productoId, estado]);
  useEffect(() => { if (value) setQuery(null); }, [value]);
  useEffect(() => { setQuery(null); setPagina(1); }, [tipo, categoriaId, productoId]);
  useEffect(() => { if (active >= 0) root.current?.querySelector(`[id="${id}-option-${active}"]`)?.scrollIntoView({block:'nearest'}); }, [active, id]);
  useEffect(() => {
    if (!open || disabled) return;
    let vigente = true;
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      apiClient.get(`/bajas/catalogos/${tipo}`, { params: { q, pagina, porPagina: 20, estado, ...(categoriaId ? { categoriaId } : {}), ...(productoId ? { productoId } : {}) } })
        .then(({data}) => { if (vigente) { setRows(prev => pagina === 1 ? data.items : [...new Map([...prev, ...data.items].map(r => [r.id,r])).values()]); setTotal(data.total); setActive(-1); } })
        .catch(e => { if (vigente) setError(e.response?.data?.error || 'No se pudieron cargar las opciones.'); })
        .finally(() => { if (vigente) setLoading(false); });
    }, 200);
    return () => { vigente = false; clearTimeout(timer); };
  }, [open, disabled, tipo, q, pagina, categoriaId, productoId, estado, revision]);
  function choose(row) { cache.current = row; setQuery(null); setOpen(false); setActive(-1); onChange(String(row.id), row); input.current?.focus(); }
  function close() { setOpen(false); setQuery(null); setActive(-1); }
  return <div className="catalogo-selector" ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) close(); }}>
    <label htmlFor={id}>{label}</label>
    <div className="catalogo-control">
      <input ref={input} id={id} className="input-field" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined} autoComplete="off" disabled={disabled} placeholder="Selecciona o escribe para buscar…" value={query === null ? text : query}
        onClick={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setPagina(1); setOpen(true); setActive(-1); if (value && !retainWhileSearching) onChange('', undefined); }}
        onKeyDown={e => {
          if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(v => Math.max(0, Math.min(rows.length - 1, v + (e.key === 'ArrowDown' ? 1 : -1)))); }
          if (e.key === 'Enter' && open) { e.preventDefault(); if (!loading && rows[active]) choose(rows[active]); }
        }} />
      {value && <button type="button" className="catalogo-clear" disabled={disabled} aria-label={`Limpiar ${label}`} onClick={() => { onChange('', undefined); setQuery(null); setPagina(1); input.current?.focus(); }}>×</button>}
      <button type="button" className="catalogo-arrow" disabled={disabled} aria-label={`Mostrar opciones de ${label}`} aria-expanded={open} onClick={() => { setOpen(v => !v); input.current?.focus(); }}>⌄</button>
    </div>
    {open && !disabled && <div className="catalogo-popup">
      <ul id={`${id}-list`} role="listbox" aria-label={label} aria-busy={loading}>
        {!error && rows.map((r,i) => <li id={`${id}-option-${i}`} key={r.id} role="option" aria-selected={String(value) === String(r.id)} className={active === i ? 'highlighted' : ''} onMouseDown={e => e.preventDefault()} onClick={() => choose(r)}>{r.nombre}</li>)}
      </ul>
      {loading && <p role="status">Buscando…</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" className="btn btn-outline" onClick={() => setRevision(v => v + 1)}>Reintentar</button></div>}
      {!loading && !error && !rows.length && <p>No hay opciones disponibles para esta búsqueda.</p>}
      {!error && rows.length < total && <button type="button" className="btn btn-outline" disabled={loading} onClick={() => setPagina(p => p + 1)}>Mostrar más opciones</button>}
      {onCreate && <button type="button" className="btn btn-outline" onClick={() => { close(); onCreate(); }}>Agregar nuevo…</button>}
    </div>}
  </div>;
}
