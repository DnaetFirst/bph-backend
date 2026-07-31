import { useEffect, useState } from 'react';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useUiStore } from '../store/uiStore';

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
  const [formData, setFormData] = useState({
    nombre: '',
    areaId: '',
  });
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    fetchTrabajadores();
    fetchAreas();
  }, [fetchTrabajadores, fetchAreas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const areaIdParsed = parseInt(formData.areaId, 10);

      if (!formData.areaId || Number.isNaN(areaIdParsed)) {
        mostrarToast({ tipo: 'error', titulo: 'Área requerida', mensaje: 'Debes seleccionar un área antes de guardar el trabajador.' });
        return;
      }

      const datos = {
        nombre: formData.nombre,
        areaId: areaIdParsed,
      };

      if (editando) {
        await actualizarTrabajador(editando.id, datos);
        setEditando(null);
      } else {
        await crearTrabajador(datos);
      }

      setFormData({ nombre: '', areaId: '' });
      setMostrarFormulario(false);
    } catch (err) {
      console.error('Error:', err);
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
        console.error('Error al desactivar trabajador:', err);
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
      console.error('Error:', err);
      mostrarToast({ tipo: 'error', titulo: 'No se pudo activar', mensaje: err.response?.data?.error || 'No se pudo activar el trabajador. Inténtalo nuevamente.' });
    }
  };

  const handleEliminar = async (id) => {
    if (confirm('¿Está seguro de eliminar este trabajador? Esta acción no se puede deshacer.')) {
      try {
        await eliminarTrabajador(id);
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Error al eliminar trabajador.';
        console.error('Error:', err);
        mostrarToast({ tipo: 'error', titulo: 'No se pudo eliminar', mensaje: errorMsg });
      }
    }
  };

  const trabajadoresActivos = trabajadores.filter((t) => t.activo);
  const trabajadoresInactivos = trabajadores.filter((t) => !t.activo);

  return (
    <div className="page-shell animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de trabajadores</h1>
          <p className="page-subtitle">Administra altas, ediciones, activaciones, desactivaciones y eliminaciones con una vista clara y ordenada.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setMostrarFormulario(true)} disabled={cargando}>
          + Nuevo trabajador
        </button>
      </div>

      <div className="glass-panel section-card-body">
        {error && (
          <div style={{ backgroundColor: 'hsla(var(--color-danger), 0.1)', border: '1px solid hsla(var(--color-danger), 0.3)', color: 'hsl(var(--color-danger))', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {mostrarFormulario && (
          <div className="section-card" style={{ marginBottom: '1.5rem' }}>
            <div className="section-card-body">
              <h2 className="section-title">{editando ? 'Editar trabajador' : 'Nuevo trabajador'}</h2>
              <p className="section-subtitle" style={{ marginBottom: '1.2rem' }}>
                Completa los datos del trabajador para mantener la información actualizada.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
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

                <div style={{ marginBottom: '1rem' }}>
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

                <div className="action-group">
                  <button type="submit" className="btn btn-primary" disabled={cargando}>
                    {cargando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={handleCancelar} disabled={cargando}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="section-card" style={{ marginBottom: '1.5rem' }}>
          <div className="section-card-body">
            <h2 className="section-title">Trabajadores activos</h2>
            <p className="section-subtitle" style={{ marginBottom: '1rem' }}>
              Personal habilitado actualmente para operar y ser evaluado.
            </p>

            {trabajadoresActivos.length === 0 ? (
              <p style={{ color: 'hsl(var(--color-text-secondary))' }}>No hay trabajadores activos.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {trabajadoresActivos.map((trabajador) => (
                  <div
                    key={trabajador.id}
                    style={{
                      padding: '1rem',
                      backgroundColor: 'hsl(var(--color-surface-hover))',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid hsl(var(--color-table-border))',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', color: 'hsl(var(--color-text-primary))' }}>{trabajador.nombre}</strong>
                      <span style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))' }}>
                        {trabajador.area?.nombre || 'Sin área'}
                      </span>
                    </div>
                    <div className="action-group">
                      <button className="btn btn-outline btn-small" onClick={() => handleEditar(trabajador)} disabled={cargando}>
                        Editar
                      </button>
                      <button className="btn btn-danger btn-small" onClick={() => handleDesactivar(trabajador.id)} disabled={cargando || procesando}>
                        Desactivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {trabajadoresInactivos.length > 0 && (
          <div className="section-card">
            <div className="section-card-body">
              <h2 className="section-title">Trabajadores inactivos</h2>
              <p className="section-subtitle" style={{ marginBottom: '1rem' }}>
                Personal desactivado. Desde aquí puedes reactivarlo o eliminarlo definitivamente.
              </p>

              <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                {trabajadoresInactivos.map((trabajador) => (
                  <div
                    key={trabajador.id}
                    style={{
                      padding: '1rem',
                      backgroundColor: 'hsla(var(--color-primary), 0.04)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid hsl(var(--color-table-border))',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', color: 'hsl(var(--color-text-primary))', opacity: 0.75 }}>{trabajador.nombre}</strong>
                      <span style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))' }}>
                        {trabajador.area?.nombre || 'Sin área'}
                      </span>
                    </div>
                    <div className="action-group">
                      <button className="btn btn-outline btn-small" onClick={() => handleActivar(trabajador.id)} disabled={cargando}>
                        Activar
                      </button>
                      <button className="btn btn-danger btn-small" onClick={() => handleEliminar(trabajador.id)} disabled={cargando}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
