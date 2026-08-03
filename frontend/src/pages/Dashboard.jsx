import { useEffect, useMemo, useState } from 'react';
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
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useEvaluacionesStore } from '../store/evaluacionesStore';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useUiStore } from '../store/uiStore';
import { apiClient } from '../api/client';
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
  const { evaluaciones, total, fetchEvaluaciones, borrarEvaluacion } = useEvaluacionesStore();
  const { areas, fetchTrabajadores, fetchAreas, obtenerTrabajadoresActivos } = useTrabajadoresStore();
  const { usuario } = useAuthStore();
  const mostrarToast = useUiStore((state) => state.mostrarToast);
  const navigate = useNavigate();

  const [verDetalleEvaluacion, setVerDetalleEvaluacion] = useState(null);
  const [busquedaTabla, setBusquedaTabla] = useState('');

  const [pagina, setPagina] = useState(1);
  const porPagina = 12;
  const [mostrarFiltrosExportar, setMostrarFiltrosExportar] = useState(false);
  const [filtros, setFiltros] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    fetchTrabajadores();
    fetchAreas();
  }, [fetchTrabajadores, fetchAreas]);

  useEffect(() => {
    if (filtros.trabajadorId) {
      const trabajador = obtenerTrabajadoresActivos().find(
        (t) => String(t.id) === String(filtros.trabajadorId)
      );
      if (trabajador) {
        setFiltros((prev) => ({
          ...prev,
          areaId: trabajador.areaId ? String(trabajador.areaId) : '',
        }));
      }
    }
  }, [filtros.trabajadorId, obtenerTrabajadoresActivos]);

  useEffect(() => {
    fetchEvaluaciones({ pagina, porPagina, ...filtros });
  }, [fetchEvaluaciones, pagina, porPagina, filtros]);


  const evaluacionesActivas = useMemo(
    () => evaluaciones.filter((ev) => ev.estado === 'ACTIVA'),
    [evaluaciones]
  );

  const evaluacionesTabla = useMemo(() => {
    if (!busquedaTabla) return evaluaciones;
    const term = busquedaTabla.toLowerCase();
    return evaluaciones.filter(ev => 
      ev.trabajador?.nombre?.toLowerCase().includes(term) ||
      ev.evaluador?.nombre?.toLowerCase().includes(term) ||
      ev.clasificacion?.toLowerCase().includes(term)
    );
  }, [evaluaciones, busquedaTabla]);

  const handleEliminarFormulario = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar físicamente esta evaluación por completo?')) return;
    try {
      await borrarEvaluacion(id);
    } catch (error) {
      // El error ya es manejado en el store
    }
  };

  const resumen = useMemo(() => {
    const totalItems = evaluacionesActivas.length;
    const promedioGeneral = totalItems
      ? Math.round(evaluacionesActivas.reduce((sum, ev) => sum + (ev.generalPorcentaje || 0), 0) / totalItems)
      : 0;
    const promedioHigiene = totalItems
      ? Math.round(evaluacionesActivas.reduce((sum, ev) => sum + (ev.higienePorcentaje || 0), 0) / totalItems)
      : 0;
    const promedioUniforme = totalItems
      ? Math.round(evaluacionesActivas.reduce((sum, ev) => sum + (ev.uniformePorcentaje || 0), 0) / totalItems)
      : 0;
    const tieneUniforme = evaluacionesActivas.some((ev) => ev.uniformePorcentaje !== null && ev.uniformePorcentaje !== undefined);
    const excelentes = evaluacionesActivas.filter((ev) => ev.clasificacion === 'Excelente').length;
    const aceptables = evaluacionesActivas.filter((ev) => ev.clasificacion === 'Aceptable').length;
    const deficientes = evaluacionesActivas.filter((ev) => ev.clasificacion === 'Deficiente').length;
    const cumplimientoColor = evaluacionesActivas.filter((ev) => ev.cumplimientoColor === 'Cumple').length;
    const cumplimientoColorPorcentaje = totalItems ? Math.round((cumplimientoColor / totalItems) * 100) : 0;

    const topTrabajadores = Object.values(
      evaluacionesActivas.reduce((acc, ev) => {
        const key = ev.trabajador?.nombre || 'Sin trabajador';
        if (!acc[key]) {
          acc[key] = { label: key, total: 0, sum: 0 };
        }
        acc[key].total += 1;
        acc[key].sum += ev.generalPorcentaje || 0;
        return acc;
      }, {})
    )
      .map((item) => ({
        label: item.label,
        value: Math.round(item.sum / item.total),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const tendencia = [...evaluacionesActivas]
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .slice(-6)
      .map((ev) => ({
        label: new Date(ev.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
        value: ev.generalPorcentaje || 0,
      }));

    return {
      totalItems,
      promedioGeneral,
      promedioHigiene,
      promedioUniforme,
      tieneUniforme,
      excelentes,
      aceptables,
      deficientes,
      cumplimientoColorPorcentaje,
      topTrabajadores,
      tendencia,
    };
  }, [evaluacionesActivas]);

  const handleFilterChange = (field, value) => {
    setPagina(1);
    setFiltros((prev) => ({ ...prev, [field]: value }));
  };

  const limpiarFiltros = () => {
    setPagina(1);
    setFiltros(DEFAULT_FILTERS);
  };

  const handleExportarExcel = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await apiClient.get(`/evaluaciones/exportar?${params.toString()}`, {
        responseType: 'blob',
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
          <button className="btn btn-outline" onClick={() => setMostrarFiltrosExportar((prev) => !prev)}>
            <Download size={18} />
            Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/evaluar')}>
            <PlusCircle size={18} />
            Nueva Evaluación
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="section-card">
        <div className="section-card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Filter size={18} style={{ color: 'hsl(var(--color-primary))' }} />
              <h2 className="section-title">Filtros analíticos</h2>
            </div>
            <button className="btn btn-outline btn-small" onClick={limpiarFiltros}>
              <RefreshCw size={16} />
              Limpiar filtros
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
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
                {[...new Map(evaluaciones.map((ev) => [ev.evaluador?.id, ev.evaluador]).filter(([id]) => id)).values()].map((evaluador) => (
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
          <div className="section-card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
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

      {/* KPIs */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <KpiCard icon={ShieldCheck} titulo="Evaluaciones activas" valor={resumen.totalItems} subtitulo={`${total} registros encontrados con filtros`} color="hsl(var(--color-primary))" />
          <KpiCard icon={TrendingUp} titulo="Promedio general" valor={`${resumen.promedioGeneral}%`} subtitulo="Promedio del indicador BPH" color="hsl(var(--color-success))" />
          <KpiCard icon={CalendarRange} titulo="Cumplimiento de color" valor={`${resumen.cumplimientoColorPorcentaje}%`} subtitulo="Coincidencia entre color esperado y observado" color="hsl(var(--color-warning))" />
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
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {resumen.tendencia.map((item, index) => {
                  const previous = index > 0 ? resumen.tendencia[index - 1].value : item.value;
                  const trendUp = item.value >= previous;
                  const barColor = trendUp
                    ? 'linear-gradient(90deg, hsla(142, 71%, 45%, 0.8), hsla(171, 77%, 40%, 0.95))'
                    : 'linear-gradient(90deg, hsla(38, 92%, 50%, 0.8), hsla(348, 83%, 47%, 0.85))';
                  return (
                    <div key={`${item.label}-${index}`} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-secondary))' }}>{item.label}</span>
                      <div style={{ height: 12, borderRadius: 999, background: 'hsla(var(--color-secondary), 0.12)', overflow: 'hidden' }}>
                        <div style={{ width: `${item.value}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: trendUp ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))' }}>
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
            <ProgressRow label="Uniforme" value={resumen.promedioUniforme} color="linear-gradient(90deg, hsla(38, 92%, 50%, 0.8), hsla(24, 95%, 53%, 0.95))" />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', fontSize: '0.9rem' }}>
              <span>Uniforme</span>
              <strong style={{ color: 'hsl(var(--color-text-secondary))' }}>N/A</strong>
            </div>
          )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: 12, background: 'hsla(142, 71%, 45%, 0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--color-success))' }}>{resumen.excelentes}</div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>Excelentes</div>
              </div>
              <div style={{ padding: '0.85rem', borderRadius: 12, background: 'hsla(38, 92%, 50%, 0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--color-warning))' }}>{resumen.aceptables}</div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>Aceptables</div>
              </div>
              <div style={{ padding: '0.85rem', borderRadius: 12, background: 'hsla(348, 83%, 47%, 0.1)', textAlign: 'center' }}>
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
            <MiniBarChart data={resumen.topTrabajadores} color="hsl(var(--color-success))" />
          ) : (
            <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.9rem' }}>No hay datos para este filtro.</p>
          )}
        </div>
      </section>

      {/* Formularios (sólo administrador) */}
      {usuario?.rol === 'administrador' && (
        <section className="section-card" style={{ marginTop: '1.5rem' }}>
          <div className="section-card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="section-title">Gestión de Formularios</h2>
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '320px', marginBottom: '1rem' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--color-text-secondary))' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Buscar por trabajador, evaluador o clasificación..."
                value={busquedaTabla}
                onChange={(e) => setBusquedaTabla(e.target.value)}
                style={{ paddingLeft: '2.5rem', width: '100%' }}
              />
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="th-nombre">Trabajador</th>
                    <th className="th-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluacionesTabla.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="empty-state">No se encontraron formularios.</td>
                    </tr>
                  ) : (
                    evaluacionesTabla.map(ev => (
                      <tr key={ev.id}>
                        <td>{new Date(ev.fecha).toLocaleDateString()}</td>
                        <td>{ev.trabajador?.nombre || 'N/A'}</td>
                        <td className="td-actions">
                          <button
                            type="button"
                            className="btn-ghost btn-small"
                            onClick={() => setVerDetalleEvaluacion(ev)}
                            title="Ver detalles"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost btn-small"
                            style={{ color: 'hsl(var(--color-danger))' }}
                            onClick={() => handleEliminarFormulario(ev.id)}
                            title="Eliminar por completo"
                          >
                            <Trash2 size={16} />
                          </button>
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
        <div className="modal-overlay" onClick={() => setVerDetalleEvaluacion(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Detalles de la Evaluación</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
               <div>
                 <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Fecha</p>
                 <p style={{ fontWeight: 600 }}>{new Date(verDetalleEvaluacion.fecha).toLocaleString()}</p>
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

            <div style={{ padding: '1rem', background: 'hsl(var(--color-background))', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
               <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Resultados</h4>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>General:</span>
                  <strong>{verDetalleEvaluacion.generalPorcentaje !== null ? `${verDetalleEvaluacion.generalPorcentaje}%` : 'N/A'}</strong>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Higiene:</span>
                  <strong>{verDetalleEvaluacion.higienePorcentaje !== null ? `${verDetalleEvaluacion.higienePorcentaje}%` : 'N/A'}</strong>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Uniforme:</span>
                  <strong>{verDetalleEvaluacion.uniformePorcentaje !== null ? `${verDetalleEvaluacion.uniformePorcentaje}%` : 'N/A'}</strong>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Clasificación:</span>
                  <strong>{verDetalleEvaluacion.clasificacion || 'N/A'}</strong>
               </div>
            </div>
            
            {verDetalleEvaluacion.observaciones && (
              <div style={{ marginBottom: '1.5rem' }}>
                 <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Observaciones</p>
                 <p style={{ padding: '0.75rem', background: 'hsl(var(--color-background))', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
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
        </div>
      )}
    </div>
  );
}
