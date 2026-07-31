import { useEffect, useState, useMemo } from 'react';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useUiStore } from '../store/uiStore';
import { Search, Edit, Check, Trash2, X } from 'lucide-react';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';

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

  useEffect(() => {
    fetchTrabajadores();
    fetchAreas();
  }, [fetchTrabajadores, fetchAreas]);

  const trabajadoresActivos = useMemo(
    () => trabajadores.filter((t) => t.activo).filter(t =>
      t.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [trabajadores, searchTerm]
  );
  const trabajadoresInactivos = useMemo(
    () => trabajadores.filter((t) => !t.activo).filter(t =>
      t.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [trabajadores, searchTerm]
  );

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
    if (confirm('¿Está seguro de desactivar este trabajador?')) {
      setProcesando(true);
      try {
        await desactivarTrabajador(id);
      } catch (err) {
        mostrarToast({ tipo: 'error', titulo: 'No se pudo desactivar', mensaje: err.response?.data?.error || 'No se pudo desactivar el trabajador. Inténtalo nuevamente.' });
      } finally {
        setProcesando(false);
      }
    }
  };

  const handleActivar = async (id) => {
    try {
      await activarTrabajador(id);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo activar', mensaje: err.response?.data?.error || 'No se pudo activar el trabajador. Inténtalo nuevamente.' });
    }
  };

  const handleEliminar = async (id) => {
    if (confirm('¿Está seguro de eliminar este trabajador? Esta acción no se puede deshacer.')) {
      try {
        await eliminarTrabajador(id);
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Error al eliminar trabajador.';
        mostrarToast({ tipo: 'error', titulo: 'No se pudo eliminar', mensaje: errorMsg });
      }
    }
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
      <div style={{ position: 'relative', maxWidth: '320px' }}>
        <Search size={18} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--color-text-secondary))' }} />
        <input
          type="text"
          className="input-field"
          placeholder="Buscar trabajador..."
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
                    placeholder="Ej: JUAN PEREZ"
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
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Área</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {trabajadoresActivos.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                      <td style={{ color: 'hsl(var(--color-text-secondary))' }}>{t.area?.nombre || 'Sin área'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button className="btn-ghost btn-small" onClick={() => handleEditar(t)} title="Editar">
                            <Edit size={14} />
                          </button>
                          <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-warning))' }} onClick={() => handleDesactivar(t.id)} title="Desactivar" disabled={cargando || procesando}>
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Trabajadores inactivos */}
      {trabajadoresInactivos.length > 0 && (
        <section className="section-card">
          <div className="section-card-body">
            <h2 className="section-title">Trabajadores inactivos</h2>
            <p className="section-subtitle">Personal desactivado. Desde aquí puedes reactivarlo o eliminarlo definitivamente.</p>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Área</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {trabajadoresInactivos.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600, opacity: 0.75 }}>{t.nombre}</td>
                      <td style={{ color: 'hsl(var(--color-text-secondary))' }}>{t.area?.nombre || 'Sin área'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-success))' }} onClick={() => handleActivar(t.id)} title="Activar" disabled={cargando}>
                            <Check size={14} />
                          </button>
                          <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-danger))' }} onClick={() => handleEliminar(t.id)} title="Eliminar" disabled={cargando}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
