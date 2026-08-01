import { useEffect, useState, useMemo } from 'react';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useUiStore } from '../store/uiStore';
import { Search, Edit, Check, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import Tooltip from '../components/ui/Tooltip';

export default function Trabajadores() {
  const trabajadores = useTrabajadoresStore((state) => state.trabajadores);
  const areas = useTrabajadoresStore((state) => state.areas);
  const cargando = useTrabajadoresStore((state) => state.cargando);
  const error = useTrabajadoresStore((state) => state.error);
  const fetchTrabajadores = useTrabajadoresStore((state) => state.fetchTrabajadores);
  const fetchAreas = useTrabajadoresStore((state) => state.fetchAreas);
  const crearTrabajador = useTrabajadoresStore((state) => state.crearTrabajador);
  const actualizarTrabajador = useTrabajadoresStore((state) => state.actualizarTrabajador);
  const desactivarTrabajador = useTrabajadoresStore((state) => state.desactivarTrabajador);
  const activarTrabajador = useTrabajadoresStore((state) => state.activarTrabajador);
  const eliminarTrabajador = useTrabajadoresStore((state) => state.eliminarTrabajador);

  const mostrarToast = useUiStore((state) => state.mostrarToast);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', areaId: '' });
  const [procesando, setProcesando] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [paginaActivos, setPaginaActivos] = useState(1);
  const [paginaInactivos, setPaginaInactivos] = useState(1);
  const porPagina = 5;

  useEffect(() => {
    fetchTrabajadores();
    fetchAreas();
  }, [fetchTrabajadores, fetchAreas]);

  useEffect(() => {
    const handler = setTimeout(() => setSearchDebounced(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setPaginaActivos(1);
    setPaginaInactivos(1);
  }, [searchDebounced]);

  const matchSearch = (t, term) => {
    if (!term) return true;
    const lower = term.toLowerCase();
    const inNombre = t.nombre.toLowerCase().includes(lower);
    const inArea = (t.area?.nombre || '').toLowerCase().includes(lower);
    return inNombre || inArea;
  };

  const trabajadoresActivos = useMemo(
    () => trabajadores.filter((t) => t.activo).filter((t) => matchSearch(t, searchDebounced)),
    [trabajadores, searchDebounced]
  );
  const trabajadoresInactivos = useMemo(
    () => trabajadores.filter((t) => !t.activo).filter((t) => matchSearch(t, searchDebounced)),
    [trabajadores, searchDebounced]
  );

  const totalActivos = trabajadoresActivos.length;
  const totalInactivos = trabajadoresInactivos.length;
  const activosPaginados = totalActivos > 0 ? trabajadoresActivos.slice((paginaActivos - 1) * porPagina, paginaActivos * porPagina) : [];
  const inactivosPaginados = totalInactivos > 0 ? trabajadoresInactivos.slice((paginaInactivos - 1) * porPagina, paginaInactivos * porPagina) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const areaIdParsed = parseInt(formData.areaId, 10);

      if (!formData.areaId || Number.isNaN(areaIdParsed)) {
        mostrarToast({ tipo: 'error', titulo: 'Área requerida', mensaje: 'Debes seleccionar un área antes de guardar el trabajador.' });
        return;
      }

      const datos = { nombre: formData.nombre, areaId: areaIdParsed };

      if (editando) {
        await actualizarTrabajador(editando.id, datos);
        setEditando(null);
      } else {
        await crearTrabajador(datos);
      }

      setFormData({ nombre: '', areaId: '' });
      setMostrarFormulario(false);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo guardar', mensaje: err.response?.data?.error || 'No se pudo guardar el trabajador. Inténtalo nuevamente.' });
    }
  };

  const handleEditar = (trabajador) => {
    setEditando(trabajador);
    setFormData({ nombre: trabajador.nombre, areaId: trabajador.areaId });
    setMostrarFormulario(true);
  };

  const handleCancelar = () => {
    setEditando(null);
    setFormData({ nombre: '', areaId: '' });
    setMostrarFormulario(false);
  };

  const handleDesactivar = async (id) => {
    if (procesando) return;
    setProcesando(true);
    try {
      await desactivarTrabajador(id);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo desactivar', mensaje: err.response?.data?.error || 'Error al desactivar.' });
    } finally {
      setProcesando(false);
    }
  };

  const handleActivar = async (id) => {
    try {
      await activarTrabajador(id);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo activar', mensaje: err.response?.data?.error || 'Error al activar.' });
    }
  };

  const handleEliminar = async (id) => {
    if (confirm('¿Eliminar este trabajador? No se podrá recuperar.')) {
      try {
        await eliminarTrabajador(id);
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Error al eliminar trabajador.';
        mostrarToast({ tipo: 'error', titulo: 'No se pudo eliminar', mensaje: errorMsg });
      }
    }
  };

  const renderActions = (t, type) => {
    if (type === 'activo') {
      return (
        <td className="td-actions">
          <div className="btn-group-actions">
            <Tooltip text="Editar trabajador">
              <button className="btn-ghost btn-small" onClick={() => handleEditar(t)} title="Editar">
                <Edit size={14} /> Editar
              </button>
            </Tooltip>
            <Tooltip text="Desactivar trabajador">
              <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-warning))' }} onClick={() => handleDesactivar(t.id)} title="Desactivar" disabled={cargando || procesando}>
                <X size={14} /> Desactivar
              </button>
            </Tooltip>
          </div>
        </td>
      );
    }
    return (
      <td className="td-actions">
        <div className="btn-group-actions">
          <Tooltip text="Activar trabajador">
            <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-success))' }} onClick={() => handleActivar(t.id)} title="Activar" disabled={cargando}>
              <Check size={14} /> Activar
            </button>
          </Tooltip>
          <Tooltip text="Eliminar trabajador">
            <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-danger))' }} onClick={() => handleEliminar(t.id)} title="Eliminar" disabled={cargando}>
              <Trash2 size={14} /> Eliminar
            </button>
          </Tooltip>
        </div>
      </td>
    );
  };

  return (
    <div className="page-shell animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Gestión de trabajadores</h1>
          <p className="page-subtitle">
            Administra altas, ediciones, activaciones, desactivaciones y eliminaciones con una vista clara y ordenada.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditando(null); setFormData({ nombre: '', areaId: '' }); setMostrarFormulario(true); }} disabled={cargando}>
          + Nuevo trabajador
        </button>
      </header>

      {/* Search */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
        <Search size={18} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--color-text-secondary))' }} />
        <input
          type="text"
          className="input-field"
          placeholder="Buscar por nombre o área..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ paddingLeft: '2.5rem' }}
        />
      </div>

      {error && <ErrorState error={error} onRetry={fetchTrabajadores} />}

      {mostrarFormulario && (
        <section className="section-card">
          <div className="section-card-body">
            <h2 className="section-title">{editando ? 'Editar trabajador' : 'Nuevo trabajador'}</h2>
            <p className="section-subtitle">
              Completa los datos del trabajador para mantener la información actualizada.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-grid-2" style={{ gap: '1rem' }}>
                <div>
                  <label className="label">Nombre del trabajador</label>
                  <input
                    className="input-field"
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value.toUpperCase() })}
                    placeholder="Ingresa el nombre..."
                    required
                    disabled={cargando}
                  />
                </div>
                <div>
                  <label className="label">Área</label>
                  <select
                    className="input-field"
                    value={formData.areaId}
                    onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                    required
                    disabled={cargando}
                  >
                    <option value="">Seleccionar área</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="action-group" style={{ marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
                </button>
                <button type="button" className="btn btn-outline" onClick={handleCancelar} disabled={cargando}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Trabajadores activos */}
      <section className="section-card">
        <div className="section-card-body">
          <h2 className="section-title">Trabajadores activos</h2>
          <p className="section-subtitle">Personal habilitado actualmente para operar y ser evaluado.</p>

          {trabajadoresActivos.length === 0 ? (
            <EmptyState titulo="Sin trabajadores activos" mensaje="No hay trabajadores activos para mostrar." icono={Search} />
          ) : (
            <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="th-nombre">Nombre</th>
                    <th className="th-area">Área</th>
                    <th className="th-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {activosPaginados.map((t) => (
                    <tr key={t.id}>
                      <td className="td-nombre" style={{ fontWeight: 600 }}>{t.nombre}</td>
                      <td className="td-area" style={{ color: 'hsl(var(--color-text-secondary))' }}>{t.area?.nombre || 'Sin área'}</td>
                      {renderActions(t, 'activo')}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalActivos > porPagina && (
              <div className="pagination-footer">
                <button className="btn btn-outline btn-small" disabled={paginaActivos <= 1} onClick={() => setPaginaActivos((p) => p - 1)}>
                  <ChevronLeft size={16} />
                </button>
                <span className="pagination-info">
                  Pág. {paginaActivos} de {Math.ceil(totalActivos / porPagina)}
                </span>
                <button className="btn btn-outline btn-small" disabled={paginaActivos >= Math.ceil(totalActivos / porPagina)} onClick={() => setPaginaActivos((p) => p + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            </>
          )}
        </div>
      </section>

      {/* Trabajadores inactivos */}
      {trabajadoresInactivos.length > 0 && (
        <section className="section-card">
          <div className="section-card-body">
            <h2 className="section-title">Trabajadores inactivos</h2>
            <p className="section-subtitle">Personal desactivado. Desde aquí puedes reactivarlo o eliminarlo definitivamente.</p>

            <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="th-nombre">Nombre</th>
                    <th className="th-area">Área</th>
                    <th className="th-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inactivosPaginados.map((t) => (
                    <tr key={t.id}>
                      <td className="td-nombre" style={{ fontWeight: 600, opacity: 0.75 }}>{t.nombre}</td>
                      <td className="td-area" style={{ color: 'hsl(var(--color-text-secondary))' }}>{t.area?.nombre || 'Sin área'}</td>
                      {renderActions(t, 'inactivo')}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalInactivos > porPagina && (
              <div className="pagination-footer">
                <button className="btn btn-outline btn-small" disabled={paginaInactivos <= 1} onClick={() => { if(!procesando) setPaginaInactivos((p) => p - 1)}}>
                  <ChevronLeft size={16} />
                </button>
                <span className="pagination-info">
                  Pág. {paginaInactivos} de {Math.ceil(totalInactivos / porPagina)}
                </span>
                <button className="btn btn-outline btn-small" disabled={procesando || paginaInactivos >= Math.ceil(totalInactivos / porPagina)} onClick={() => setPaginaInactivos((p) => p + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            </>
          </div>
        </section>
      )}
    </div>
  );
}
