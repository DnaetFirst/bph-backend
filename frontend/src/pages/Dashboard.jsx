import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvaluacionesStore } from '../store/evaluacionesStore';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useAuthStore } from '../store/authStore';
import { PlusCircle, Search, FileText, AlertTriangle, ChevronLeft, ChevronRight, Download, Filter } from 'lucide-react';
import { apiClient } from '../api/client';

const BADGE_STYLES = {
  ACTIVA:    { bg: 'hsla(142, 71%, 45%, 0.15)', color: 'hsl(142, 71%, 35%)',  label: 'Activa'  },
  ANULADA:   { bg: 'hsla(348, 83%, 47%, 0.15)', color: 'hsl(348, 83%, 45%)',  label: 'Anulada' },
};

const CLASIFICACION_STYLES = {
  Excelente:  { color: 'hsl(142, 71%, 35%)' },
  Aceptable:  { color: 'hsl(38, 92%, 40%)'  },
  Deficiente: { color: 'hsl(348, 83%, 45%)' },
};

function EstadoBadge({ estado }) {
  const style = BADGE_STYLES[estado] || BADGE_STYLES.ACTIVA;
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.65rem',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      backgroundColor: style.bg,
      color: style.color,
      letterSpacing: '0.02em',
    }}>
      {style.label}
    </span>
  );
}

function ClasificacionBadge({ clasificacion, porcentaje }) {
  const style = CLASIFICACION_STYLES[clasificacion] || {};
  return (
    <span style={{ fontWeight: 600, color: style.color || 'inherit' }}>
      {porcentaje != null ? `${porcentaje}%` : '—'}
      {clasificacion ? ` · ${clasificacion}` : ''}
    </span>
  );
}

export default function Dashboard() {
  const { evaluaciones, total, cargando, error, fetchEvaluaciones } = useEvaluacionesStore();
  const { trabajadores, fetchTrabajadores, obtenerTrabajadoresActivos } = useTrabajadoresStore();
  const { usuario } = useAuthStore();
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);
  const porPagina = 20;
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState('');
  const [mostrarFiltrosExportar, setMostrarFiltrosExportar] = useState(false);
  const [filtrosExportar, setFiltrosExportar] = useState({
    fechaDesde: '',
    fechaHasta: '',
    trabajadorId: '',
    areaId: '',
    clasificacion: '',
  });

  useEffect(() => {
    fetchEvaluaciones({ pagina, porPagina, trabajadorId: trabajadorSeleccionado });
    fetchTrabajadores();
  }, [fetchEvaluaciones, pagina, trabajadorSeleccionado, fetchTrabajadores]);

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  // Calcular métricas del trabajador seleccionado
  const evaluacionesTrabajador = trabajadorSeleccionado 
    ? evaluaciones.filter(ev => ev.trabajadorId === parseInt(trabajadorSeleccionado))
    : evaluaciones;
  
  const evaluacionesActivas = evaluacionesTrabajador.filter(ev => ev.estado === 'ACTIVA');
  const totalEvaluaciones = evaluacionesActivas.length;
  const promedioGeneral = totalEvaluaciones > 0 
    ? Math.round(evaluacionesActivas.reduce((sum, ev) => sum + (ev.generalPorcentaje || 0), 0) / totalEvaluaciones)
    : 0;
  const mejorResultado = totalEvaluaciones > 0 
    ? Math.max(...evaluacionesActivas.map(ev => ev.generalPorcentaje || 0))
    : 0;
  const noConformes = evaluacionesActivas.filter(ev => (ev.generalPorcentaje || 0) < 80).length;

  const handleExportarExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (filtrosExportar.fechaDesde) params.append('fechaDesde', filtrosExportar.fechaDesde);
      if (filtrosExportar.fechaHasta) params.append('fechaHasta', filtrosExportar.fechaHasta);
      if (filtrosExportar.trabajadorId) params.append('trabajadorId', filtrosExportar.trabajadorId);
      if (filtrosExportar.areaId) params.append('areaId', filtrosExportar.areaId);
      if (filtrosExportar.clasificacion) params.append('clasificacion', filtrosExportar.clasificacion);

      const response = await apiClient.get(`/evaluaciones/exportar?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `evaluaciones_bph_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMostrarFiltrosExportar(false);
    } catch (err) {
      alert('Error al exportar Excel');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: 'hsl(var(--color-primary))', marginBottom: '0.25rem' }}>Dashboard</h1>
          <p style={{ color: 'hsl(var(--color-text-secondary))' }}>
            {trabajadorSeleccionado ? `Evaluaciones de ${obtenerTrabajadoresActivos().find(t => t.id === parseInt(trabajadorSeleccionado))?.nombre || 'trabajador'}` : 'Historial de evaluaciones de Buenas Prácticas de Higiene'}
            {total > 0 && <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>({total} registros)</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(usuario?.rol === 'supervisor' || usuario?.rol === 'administrador') && (
            <button 
              className="btn btn-secondary" 
              onClick={() => setMostrarFiltrosExportar(!mostrarFiltrosExportar)}
            >
              <Download size={18} />
              Exportar Excel
            </button>
          )}
          <button className="btn btn-primary" onClick={() => navigate('/evaluar')}>
            <PlusCircle size={18} />
            Nueva Evaluación
          </button>
        </div>
      </div>

      {/* Filtros de exportación */}
      {mostrarFiltrosExportar && (usuario?.rol === 'supervisor' || usuario?.rol === 'administrador') && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Filtros para Exportar Excel</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'hsl(var(--color-text-secondary))' }}>Fecha Desde</label>
              <input 
                type="date" 
                className="input-field" 
                value={filtrosExportar.fechaDesde}
                onChange={e => setFiltrosExportar({...filtrosExportar, fechaDesde: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'hsl(var(--color-text-secondary))' }}>Fecha Hasta</label>
              <input 
                type="date" 
                className="input-field" 
                value={filtrosExportar.fechaHasta}
                onChange={e => setFiltrosExportar({...filtrosExportar, fechaHasta: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'hsl(var(--color-text-secondary))' }}>Trabajador</label>
              <select 
                className="input-field" 
                value={filtrosExportar.trabajadorId}
                onChange={e => setFiltrosExportar({...filtrosExportar, trabajadorId: e.target.value})}
              >
                <option value="">Todos</option>
                {obtenerTrabajadoresActivos().map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'hsl(var(--color-text-secondary))' }}>Clasificación</label>
              <select 
                className="input-field" 
                value={filtrosExportar.clasificacion}
                onChange={e => setFiltrosExportar({...filtrosExportar, clasificacion: e.target.value})}
              >
                <option value="">Todas</option>
                <option value="Excelente">Excelente</option>
                <option value="Aceptable">Aceptable</option>
                <option value="Deficiente">Deficiente</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleExportarExcel}>
              <Download size={16} />
              Exportar
            </button>
            <button className="btn btn-outline" onClick={() => setMostrarFiltrosExportar(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Selector de trabajador para vista personal */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Filter size={18} style={{ color: 'hsl(var(--color-primary))' }} />
          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'hsl(var(--color-text-secondary))' }}>
            Filtrar por trabajador:
          </label>
          <select 
            className="input-field" 
            style={{ maxWidth: '300px' }}
            value={trabajadorSeleccionado}
            onChange={e => setTrabajadorSeleccionado(e.target.value)}
          >
            <option value="">Todos los trabajadores</option>
            {obtenerTrabajadoresActivos().map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          {trabajadorSeleccionado && (
            <button 
              className="btn btn-outline" 
              style={{ fontSize: '0.875rem', padding: '0.4rem 0.8rem' }}
              onClick={() => setTrabajadorSeleccionado('')}
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </div>

      {/* Métricas del trabajador seleccionado */}
      {trabajadorSeleccionado && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'hsl(var(--color-primary))' }}>{totalEvaluaciones}</div>
            <div style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))', marginTop: '0.5rem' }}>Total Evaluaciones</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'hsl(var(--color-primary))' }}>{promedioGeneral}%</div>
            <div style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))', marginTop: '0.5rem' }}>Promedio General</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'hsl(var(--color-primary))' }}>{mejorResultado}%</div>
            <div style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))', marginTop: '0.5rem' }}>Mejor Resultado</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: noConformes > 0 ? 'hsl(var(--color-danger))' : 'hsl(var(--color-primary))' }}>{noConformes}</div>
            <div style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))', marginTop: '0.5rem' }}>No Conformes</div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
        {error ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'hsl(var(--color-text-secondary))', maxWidth: '420px', padding: '3rem 2rem' }}>
            <AlertTriangle size={48} style={{ color: 'hsl(var(--color-warning))', marginBottom: '1rem' }} />
            <p style={{ color: 'hsl(var(--color-danger))', marginBottom: '0.5rem', fontWeight: 600 }}>{error}</p>
            <p style={{ fontSize: '0.875rem' }}>
              Verificá que el backend esté desplegado y la configuración de Supabase sea correcta.
            </p>
            <button className="btn btn-outline" style={{ marginTop: '1.25rem' }} onClick={() => fetchEvaluaciones({ pagina, porPagina })}>
              Reintentar
            </button>
          </div>
        ) : cargando ? (
          <div style={{ margin: 'auto', padding: '3rem', color: 'hsl(var(--color-text-secondary))' }}>
            Cargando evaluaciones...
          </div>
        ) : evaluaciones.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'hsl(var(--color-text-secondary))', padding: '3rem 2rem' }}>
            <Search size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p style={{ marginBottom: '0.5rem' }}>No hay evaluaciones registradas aún.</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/evaluar')}>
              <PlusCircle size={16} />
              Crear primera evaluación
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Trabajador</th>
                    <th>Área</th>
                    <th>Evaluador</th>
                    <th style={{ textAlign: 'center' }}>General</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    {(usuario?.rol === 'supervisor' || usuario?.rol === 'administrador') && (
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {evaluaciones.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'hsl(var(--color-text-secondary))', fontSize: '0.875rem' }}>
                        {ev.fecha ? new Date(ev.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontWeight: 500 }}>{ev.trabajador?.nombre || '—'}</td>
                      <td style={{ color: 'hsl(var(--color-text-secondary))' }}>{ev.area?.nombre || '—'}</td>
                      <td style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.875rem' }}>{ev.evaluador?.nombre || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <ClasificacionBadge clasificacion={ev.clasificacion} porcentaje={ev.generalPorcentaje} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <EstadoBadge estado={ev.estado} />
                      </td>
                      {(usuario?.rol === 'supervisor' || usuario?.rol === 'administrador') && (
                        <td style={{ textAlign: 'center' }}>
                          {ev.estado === 'ACTIVA' && (
                            <button
                              className="btn btn-outline"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', color: 'hsl(var(--color-danger))', borderColor: 'hsla(var(--color-danger), 0.4)' }}
                              onClick={() => navigate(`/evaluar?anular=${ev.id}`)}
                            >
                              Anular
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem', borderTop: '1px solid hsla(var(--color-secondary), 0.15)' }}>
                <button
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.75rem' }}
                  disabled={pagina <= 1}
                  onClick={() => setPagina(p => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))' }}>
                  Página {pagina} de {totalPaginas}
                </span>
                <button
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.75rem' }}
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina(p => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
