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
      const areaIdParsed = parseInt(formData.areaId);
      
      // Validar que se haya seleccionado un área
      if (!formData.areaId || isNaN(areaIdParsed)) {
        mostrarToast({ tipo: 'error', mensaje: 'Por favor, selecciona un área.' });
        return;
      }
      
      const datos = {
        nombre: formData.nombre,
        areaId: areaIdParsed
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
      mostrarToast({ tipo: 'error', mensaje: err.response?.data?.error || 'Error al guardar trabajador.' });
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
    if (procesando) {
      return;
    }
    if (confirm('¿Está seguro de desactivar este trabajador?')) {
      setProcesando(true);
      try {
        await desactivarTrabajador(id);
      } catch (err) {
        console.error('Error al desactivar trabajador:', err);
        mostrarToast({ tipo: 'error', mensaje: err.response?.data?.error || 'Error al desactivar trabajador.' });
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
      mostrarToast({ tipo: 'error', mensaje: err.response?.data?.error || 'Error al activar trabajador.' });
    }
  };

  const handleEliminar = async (id) => {
    if (confirm('¿Está seguro de eliminar este trabajador? Esta acción no se puede deshacer.')) {
      try {
        await eliminarTrabajador(id);
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Error al eliminar trabajador.';
        console.error('Error:', err);
        mostrarToast({ tipo: 'error', mensaje: errorMsg });
      }
    }
  };

  const trabajadoresActivos = trabajadores.filter(t => t.activo);
  const trabajadoresInactivos = trabajadores.filter(t => !t.activo);



  return (
    <div className="glass-panel animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Gestión de Trabajadores</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => setMostrarFormulario(true)}
          disabled={cargando}
        >
          + Nuevo Trabajador
        </button>
      </div>

      {error && (
        <div style={{ 
          backgroundColor: 'hsla(var(--color-danger), 0.1)', 
          border: '1px solid hsla(var(--color-danger), 0.3)',
          color: 'hsl(var(--color-danger))', 
          padding: '0.75rem', 
          borderRadius: 'var(--radius-md)', 
          marginBottom: '1rem' 
        }}>
          {error}
        </div>
      )}

      {mostrarFormulario && (
        <div style={{ 
          backgroundColor: 'hsl(var(--color-bg))', 
          padding: '1.5rem', 
          borderRadius: 'var(--radius-md)', 
          marginBottom: '1.5rem',
          border: '1px solid hsl(var(--color-border))'
        }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
            {editando ? 'Editar Trabajador' : 'Nuevo Trabajador'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Nombre del Trabajador
              </label>
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Área
              </label>
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={cargando}>
                {cargando ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear')}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCancelar}
                disabled={cargando}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Trabajadores Activos</h2>
        {trabajadoresActivos.length === 0 ? (
          <p style={{ color: 'hsl(var(--color-text-secondary))' }}>
            No hay trabajadores activos
          </p>
        ) : (
          <div style={{ 
            display: 'grid', 
            gap: '0.75rem',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {trabajadoresActivos.map((trabajador) => (
              <div 
                key={trabajador.id}
                style={{ 
                  padding: '1rem', 
                  backgroundColor: 'hsl(var(--color-bg))', 
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid hsl(var(--color-border))',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ display: 'block' }}>{trabajador.nombre}</strong>
                  <span style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))' }}>
                    {trabajador.area?.nombre || 'Sin área'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-secondary btn-small"
                    onClick={() => handleEditar(trabajador)}
                    disabled={cargando}
                  >
                    Editar
                  </button>
                  <button 
                    className="btn btn-danger btn-small"
                    onClick={() => handleDesactivar(trabajador.id)}
                    disabled={cargando || procesando}
                  >
                    Desactivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {trabajadoresInactivos.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Trabajadores Inactivos</h2>
          <div style={{ 
            display: 'grid', 
            gap: '0.75rem',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {trabajadoresInactivos.map((trabajador) => (
              <div 
                key={trabajador.id}
                style={{ 
                  padding: '1rem', 
                  backgroundColor: 'hsla(var(--color-text-secondary), 0.05)', 
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid hsl(var(--color-border))',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ display: 'block', opacity: 0.7 }}>{trabajador.nombre}</strong>
                  <span style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))' }}>
                    {trabajador.area?.nombre || 'Sin área'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-secondary btn-small"
                    onClick={() => handleActivar(trabajador.id)}
                    disabled={cargando}
                  >
                    Activar
                  </button>
                  <button 
                    className="btn btn-danger btn-small"
                    onClick={() => handleEliminar(trabajador.id)}
                    disabled={cargando}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
