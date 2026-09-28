import { estadoColorEvaluacion, colorEsperadoParaArea } from '../utils/colorUniforme';
import { useEffect, useState } from 'react';
import Modal from '../components/ui/Modal';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Download,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  CalendarRange,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useEvaluacionesStore } from '../store/evaluacionesStore';
import { useUiStore } from '../store/uiStore';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { getLocalISODate } from '../utils/fecha';
import { apiClient } from '../api/client';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import KpiCard from '../components/ui/KpiCard';
import ProgressRow from '../components/ui/ProgressRow';
import MiniBarChart from '../components/ui/MiniBarChart';

const DEFAULT_FILTERS = {
  trabajadorId: '',
  areaId: '',
  evaluadorId: '',
  estado: 'ACTIVA',
  clasificacion: '',
  fechaDesde: '',
  fechaHasta: '',
};

export default function Dashboard() {
  const { evaluaciones, total, resumen, evaluadores, cargando, error, fetchEvaluaciones, borrarEvaluacion } = useEvaluacionesStore();
  const { areas, fetchTrabajadores, fetchAreas, obtenerTrabajadoresActivos } = useTrabajadoresStore();
  const { usuario } = useAuthStore();
  const mostrarToast = useUiStore((state) => state.mostrarToast);
  const navigate = useNavigate();

  const [verDetalleEvaluacion, setVerDetalleEvaluacion] = useState(null);
  const [busquedaTabla, setBusquedaTabla] = useState('');

  const [pagina, setPagina] = useState(1);
  const porPagina = 12;
  useEffect(() => {
    if (!cargando && !error) setPagina(p => Math.min(p, Math.max(1, Math.ceil(total / porPagina))));
  }, [total, cargando, error]);
  const [mostrarFiltrosExportar, setMostrarFiltrosExportar] = useState(false);
  const [filtros, setFiltros] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    fetchTrabajadores();
    fetchAreas();
  }, [fetchTrabajadores, fetchAreas]);

  useEffect(() => {
    fetchEvaluaciones({ pagina, porPagina, ...filtros, q: busquedaTabla });
  }, [fetchEvaluaciones, pagina, porPagina, filtros, busquedaTabla]);

  const evaluacionesTabla = evaluaciones;

  const handleEliminarFormulario = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar físicamente esta evaluación por completo?')) return;
    try {
      await borrarEvaluacion(id);
    } catch {
      // El error ya es manejado en el store
    }
  };

  const handleFilterChange = (field, value) => {
    setPagina(1);
    setFiltros((prev) => ({ ...prev, [field]: value }));
  };

  const limpiarFiltros = () => {
    setPagina(1);
    setFiltros(DEFAULT_FILTERS);
    setBusquedaTabla('');
  };

  const handleExportarExcel = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries({ ...filtros, q: busquedaTabla }).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await apiClient.get(`/evaluaciones/exportar?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `evaluaciones_bph_${getLocalISODate()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMostrarFiltrosExportar(false);
      mostrarToast({ tipo: 'success', titulo: 'Exportación lista', mensaje: 'El archivo Excel se generó y descargó correctamente.' });
    } catch {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo exportar', mensaje: 'No se pudo generar el archivo Excel. Inténtalo nuevamente.' });
    }
  };

  return (
    <div className="animate-fade-in page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard de Evaluaciones BPH</h1>
          <p className="page-subtitle">
            Visualización profesional de evaluaciones individuales con foco en desempeño, clasificación, cumplimiento y seguimiento operativo.
          </p>
        </div>
        <div className="action-group">
          {['administrador', 'supervisor'].includes(usuario?.rol) && <button className="btn btn-outline" onClick={() => setMostrarFiltrosExportar((prev) => !prev)}>
            <Download size={18} />
            Exportar Excel
          </button>}
          <button className="btn btn-primary" onClick={() => navigate('/evaluar')}>
            <PlusCircle size={18} />
            Nueva Evaluación
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="section-card">
        <div className="section-card-body">
          <div className="section-heading-row" style={{ marginBottom: 'var(--space-3)', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Filter size={18} style={{ color: 'hsl(var(--color-primary))' }} />
              <h2 className="section-title">Filtros analíticos</h2>
            </div>
            <button className="btn btn-outline btn-small" onClick={limpiarFiltros}>
              <RefreshCw size={16} />
              Limpiar filtros
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 'var(--space-3)' }}>
            <div>
              <label className="label">Trabajador</label>
              <select className="input-field" value={filtros.trabajadorId} onChange={(e) => handleFilterChange('trabajadorId', e.target.value)}>
                <option value="">Todos</option>
                {obtenerTrabajadoresActivos().map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Área</label>
              <select className="input-field" value={filtros.areaId} onChange={(e) => handleFilterChange('areaId', e.target.value)}>
                <option value="">Todas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Evaluador</label>
              <select className="input-field" value={filtros.evaluadorId} onChange={(e) => handleFilterChange('evaluadorId', e.target.value)}>
                <option value="">Todos</option>
                {evaluadores.map((evaluador) => (
                  <option key={evaluador.id} value={evaluador.id}>{evaluador.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Estado</label>
              <select className="input-field" value={filtros.estado} onChange={(e) => handleFilterChange('estado', e.target.value)}>
                <option value="">Todos</option>
                <option value="ACTIVA">Activa</option>
                <option value="ANULADA">Anulada</option>
              </select>
            </div>

            <div>
              <label className="label">Clasificación</label>
              <select className="input-field" value={filtros.clasificacion} onChange={(e) => handleFilterChange('clasificacion', e.target.value)}>
                <option value="">Todas</option>
                <option value="Excelente">Excelente</option>
                <option value="Aceptable">Aceptable</option>
                <option value="Deficiente">Deficiente</option>
              </select>
            </div>

            <div>
              <label className="label">Fecha desde</label>
              <input className="input-field" type="date" value={filtros.fechaDesde} onChange={(e) => handleFilterChange('fechaDesde', e.target.value)} />
            </div>

            <div>
              <label className="label">Fecha hasta</label>
              <input className="input-field" type="date" value={filtros.fechaHasta} onChange={(e) => handleFilterChange('fechaHasta', e.target.value)} />
            </div>
          </div>
        </div>
      </section>

      {/* Banner de exportación */}
      {mostrarFiltrosExportar && (
        <section className="section-card">
          <div className="section-card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.9rem' }}>
              La exportación respetará los filtros analíticos actualmente aplicados.
            </p>
            <div className="action-group">
              <button className="btn btn-primary" onClick={handleExportarExcel}>
                <Download size={16} /> Exportar ahora
              </button>
              <button className="btn btn-outline" onClick={() => setMostrarFiltrosExportar(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </section>
      )}

      {error && <ErrorState error={error} onRetry={() => fetchEvaluaciones({ pagina, porPagina, ...filtros, q: busquedaTabla })} />}
      {cargando && <LoadingState mensaje="Cargando evaluaciones e indicadores..." />}
      {!error && !cargando && resumen && <>
      {/* KPIs */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 'var(--space-3)' }}>
          <KpiCard icon={ShieldCheck} titulo="Evaluaciones activas" valor={resumen.totalItems} subtitulo={`${total} registros encontrados con filtros`} color="hsl(var(--color-primary))" />
          <KpiCard icon={TrendingUp} titulo="Promedio general" valor={resumen.promedioGeneral == null ? 'N/A' : `${resumen.promedioGeneral}%`} subtitulo="Promedio del indicador BPH" color="hsl(var(--color-success))" />
          <KpiCard icon={CalendarRange} titulo="Cumplimiento de color" valor={resumen.cumplimientoColorPorcentaje == null ? 'N/A' : `${resumen.cumplimientoColorPorcentaje}%`} subtitulo="Excepto Producción y Calidad e inocuidad; solo colores registrados" color="hsl(var(--color-warning))" />
          <KpiCard icon={ShieldAlert} titulo="Deficientes" valor={resumen.deficientes} subtitulo="Evaluaciones con resultado crítico" color="hsl(var(--color-danger))" />
        </div>
      </section>

      {/* Charts row: Rendimiento reciente + Calidad promedio */}
      <div className="charts-row">
        {/* Rendimiento reciente */}
        <section className="section-card">
          <div className="section-card-body">
            <div>
              <h3 className="section-title">Rendimiento reciente</h3>
              <p className="section-subtitle">Últimas evaluaciones activas dentro del filtro actual</p>
            </div>

            {resumen.tendencia.length > 0 ? (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {resumen.tendencia.map((item, index) => {
                  const previous = index > 0 ? resumen.tendencia[index - 1].value : item.value;
                  const trendUp = item.value >= previous;
                  const barColor = trendUp
                    ? 'linear-gradient(90deg, hsla(142, 71%, 45%, 0.8), hsla(171, 77%, 40%, 0.95))'
                    : 'linear-gradient(90deg, hsla(38, 92%, 50%, 0.8), hsla(348, 83%, 47%, 0.85))';
                  return (
                    <div key={`${item.label}-${index}`} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0, 1fr) 65px', gap: 'var(--space-3)', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-secondary))' }}>{item.label}</span>
                      <div style={{ height: 12, borderRadius: 999, background: 'hsla(var(--color-secondary), 0.12)', overflow: 'hidden' }}>
                        <div style={{ width: `${item.value}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 700, color: trendUp ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))' }}>
                        {trendUp ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                        {item.value}%
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.9rem' }}>No hay datos suficientes para mostrar tendencia.</p>
            )}
          </div>
        </section>

        {/* Calidad promedio */}
        <section className="section-card">
          <div className="section-card-body">
            <div>
              <h3 className="section-title">Calidad promedio</h3>
              <p className="section-subtitle">Desglose por dimensión evaluada</p>
            </div>

            <ProgressRow label="General" value={resumen.promedioGeneral} color="linear-gradient(90deg, hsla(221, 83%, 53%, 0.75), hsla(217, 91%, 60%, 0.95))" />
            <ProgressRow label="Higiene" value={resumen.promedioHigiene} color="linear-gradient(90deg, hsla(142, 71%, 45%, 0.8), hsla(171, 77%, 40%, 0.95))" />
            {resumen.tieneUniforme ? (
            <ProgressRow label="Uniforme / color" value={resumen.promedioUniforme} color="linear-gradient(90deg, hsla(38, 92%, 50%, 0.8), hsla(24, 95%, 53%, 0.95))" />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', fontSize: '0.9rem' }}>
              <span>Uniforme</span>
              <strong style={{ color: 'hsl(var(--color-text-secondary))' }}>N/A</strong>
            </div>
          )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <div style={{ padding: 'var(--space-3)', borderRadius: 12, background: 'hsla(142, 71%, 45%, 0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--color-success))' }}>{resumen.excelentes}</div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>Excelentes</div>
              </div>
              <div style={{ padding: 'var(--space-3)', borderRadius: 12, background: 'hsla(38, 92%, 50%, 0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--color-warning))' }}>{resumen.aceptables}</div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>Aceptables</div>
              </div>
              <div style={{ padding: 'var(--space-3)', borderRadius: 12, background: 'hsla(348, 83%, 47%, 0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--color-danger))' }}>{resumen.deficientes}</div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>Deficientes</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Top desempeño individual (full width) */}
      <section className="section-card">
        <div className="section-card-body">
          <div>
            <h3 className="section-title">Top desempeño individual</h3>
            <p className="section-subtitle">Promedio general por trabajador</p>
          </div>
          {resumen.topTrabajadores.length > 0 ? (
            <MiniBarChart percentage data={resumen.topTrabajadores} color="hsl(var(--color-success))" />
          ) : (
            <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.9rem' }}>No hay datos para este filtro.</p>
          )}
        </div>
      </section>

      </>}
      {/* Historial y gestión según rol */}
      {['administrador', 'supervisor'].includes(usuario?.rol) && (
        <section className="section-card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="section-card-body">
            <div className="section-heading-row" style={{ marginBottom: 'var(--space-3)' }}>
              <h2 className="section-title">Gestión de Formularios</h2>
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '320px', marginBottom: 'var(--space-3)' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--color-text-secondary))' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Buscar por trabajador, evaluador o clasificación..."
                value={busquedaTabla}
                onChange={(e) => { setPagina(1); setBusquedaTabla(e.target.value); }}
                style={{ paddingLeft: '2.5rem', width: '100%' }}
              />
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="th-nombre">Trabajador</th>
                    <th>Área</th><th>General</th><th>Clasificación</th><th>Color</th>
                    <th className="th-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluacionesTabla.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-state">No se encontraron formularios.</td>
                    </tr>
                  ) : (
                    evaluacionesTabla.map(ev => (
                      <tr key={ev.id}>
                         <td>{new Date(ev.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                        <td>{ev.trabajador?.nombre || 'N/A'}</td>
                        <td>{ev.area?.nombre || 'N/A'}</td>
                        <td>{ev.generalPorcentaje == null ? 'N/A' : `${ev.generalPorcentaje}%`}</td>
                        <td>{ev.clasificacion || 'N/A'}</td>
                        <td>{estadoColorEvaluacion(ev)}</td>
                        <td className="td-actions">
                           <button
                            type="button"
                            className="btn-ghost btn-small"
                            onClick={() => setVerDetalleEvaluacion(ev)}
                            title="Ver detalles"
                          >
                             <Eye size={16} />
                           </button>
                           {['administrador', 'supervisor'].includes(usuario?.rol) && ev.estado === 'ACTIVA' && (
                             <button
                               type="button"
                               className="btn-ghost btn-small"
                               onClick={() => navigate(`/evaluar/${ev.id}/editar`)}
                               title="Editar formulario"
                             >
                               <Pencil size={16} />
                             </button>
                           )}
                          {usuario?.rol === 'administrador' && <button
                            type="button"
                            className="btn-ghost btn-small"
                            style={{ color: 'hsl(var(--color-danger))' }}
                            onClick={() => handleEliminarFormulario(ev.id)}
                            title="Eliminar por completo"
                          >
                            <Trash2 size={16} />
                          </button>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {Math.ceil(total / porPagina) > 1 && (
              <div className="pagination-footer">
                <button
                  className="btn btn-outline btn-small"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="pagination-info">
                  Página {pagina} de {Math.ceil(total / porPagina)}
                </span>
                <button
                  className="btn btn-outline btn-small"
                  disabled={pagina >= Math.ceil(total / porPagina)}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Modal para ver detalles */}
      {verDetalleEvaluacion && (
        <Modal label="Detalles de evaluación" onClose={() => setVerDetalleEvaluacion(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1.25rem' }}>Detalles de la Evaluación</h3>
            
            <div className="dialog-details" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
               <div>
                 <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Fecha</p>
                  <p style={{ fontWeight: 600 }}>{new Date(verDetalleEvaluacion.fecha).toLocaleString('es-AR', { timeZone: 'UTC' })}</p>
               </div>
               <div>
                 <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Estado</p>
                 <p style={{ fontWeight: 600, color: verDetalleEvaluacion.estado === 'ACTIVA' ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))' }}>{verDetalleEvaluacion.estado}</p>
               </div>
               <div>
                 <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Trabajador</p>
                 <p style={{ fontWeight: 600 }}>{verDetalleEvaluacion.trabajador?.nombre || 'N/A'}</p>
               </div>
               <div>
                 <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Evaluador</p>
                 <p style={{ fontWeight: 600 }}>{verDetalleEvaluacion.evaluador?.nombre || 'N/A'}</p>
               </div>
            </div>

            <div style={{ padding: 'var(--space-3)', background: 'hsl(var(--color-bg))', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
               <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '1rem' }}>Resultados</h4>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span>General:</span>
                  <strong>{verDetalleEvaluacion.generalPorcentaje !== null ? `${verDetalleEvaluacion.generalPorcentaje}%` : 'N/A'}</strong>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span>Higiene:</span>
                  <strong>{verDetalleEvaluacion.higienePorcentaje !== null ? `${verDetalleEvaluacion.higienePorcentaje}%` : 'N/A'}</strong>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span>Uniforme / color:</span>
                  <strong>{verDetalleEvaluacion.uniformePorcentaje !== null ? `${verDetalleEvaluacion.uniformePorcentaje}%` : 'N/A'}</strong>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Clasificación:</span>
                  <strong>{verDetalleEvaluacion.clasificacion || 'N/A'}</strong>
               </div>
            </div>
            
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <p><strong>Color del uniforme:</strong> {estadoColorEvaluacion(verDetalleEvaluacion)}</p>
              {colorEsperadoParaArea(verDetalleEvaluacion.area?.nombre, verDetalleEvaluacion.fecha) && (
                <p>Esperado: {verDetalleEvaluacion.colorEsperado || colorEsperadoParaArea(verDetalleEvaluacion.area?.nombre, verDetalleEvaluacion.fecha)} · Observado: {verDetalleEvaluacion.colorObservado || 'Sin registrar'}</p>
              )}
            </div>
            {verDetalleEvaluacion.observaciones && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                 <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Observaciones</p>
                 <p style={{ padding: 'var(--space-3)', background: 'hsl(var(--color-bg))', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                   {verDetalleEvaluacion.observaciones}
                 </p>
              </div>
            )}

            <div className="action-group" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setVerDetalleEvaluacion(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
