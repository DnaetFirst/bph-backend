import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvaluacionesStore } from '../store/evaluacionesStore';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useAuthStore } from '../store/authStore';
import {
  PlusCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  CalendarRange,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useUiStore } from '../store/uiStore';

const BADGE_STYLES = {
  ACTIVA: { bg: 'hsla(142, 71%, 45%, 0.15)', color: 'hsl(142, 71%, 35%)', label: 'Activa' },
  ANULADA: { bg: 'hsla(348, 83%, 47%, 0.15)', color: 'hsl(348, 83%, 45%)', label: 'Anulada' },
};

const CLASIFICACION_STYLES = {
  Excelente: { color: 'hsl(142, 71%, 35%)', bg: 'hsla(142, 71%, 45%, 0.12)' },
  Aceptable: { color: 'hsl(38, 92%, 40%)', bg: 'hsla(38, 92%, 50%, 0.12)' },
  Deficiente: { color: 'hsl(348, 83%, 45%)', bg: 'hsla(348, 83%, 47%, 0.12)' },
};

const DEFAULT_FILTERS = {
  trabajadorId: '',
  areaId: '',
  evaluadorId: '',
  estado: 'ACTIVA',
  clasificacion: '',
  fechaDesde: '',
  fechaHasta: '',
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
  const style = CLASIFICACION_STYLES[clasificacion] || { color: 'hsl(var(--color-text-primary))', bg: 'hsla(var(--color-secondary), 0.08)' };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      borderRadius: '999px',
      padding: '0.3rem 0.65rem',
      fontWeight: 600,
      color: style.color,
      backgroundColor: style.bg,
      whiteSpace: 'nowrap',
    }}>
      <span>{porcentaje != null ? `${porcentaje}%` : '—'}</span>
      {clasificacion ? <span>· {clasificacion}</span> : null}
    </span>
  );
}

function KpiCard({ icon: Icon, titulo, valor, subtitulo, color = 'hsl(var(--color-primary))' }) {
  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))', fontWeight: 600 }}>{titulo}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'hsla(var(--color-primary), 0.12)', color }}>
          <Icon size={18} />
        </div>
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>{subtitulo}</div>
    </div>
  );
}

function MiniBarChart({ data, color }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {data.map((item) => (
        <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 46px', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </div>
          <div style={{ height: 10, background: 'hsla(var(--color-secondary), 0.12)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(item.value / max) * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, textAlign: 'right' }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function ProgressRow({ label, value, color }) {
  const safeValue = value ?? 0;
  return (
    <div style={{ display: 'grid', gap: '0.45rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{safeValue}%</span>
      </div>
      <div style={{ height: 10, background: 'hsla(var(--color-secondary), 0.12)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, safeValue))}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { evaluaciones, total, cargando, error, fetchEvaluaciones, anularEvaluacion } = useEvaluacionesStore();
  const { areas, fetchTrabajadores, fetchAreas, obtenerTrabajadoresActivos } = useTrabajadoresStore();
  const { usuario } = useAuthStore();
  const mostrarToast = useUiStore((state) => state.mostrarToast);
  const navigate = useNavigate();

  const [pagina, setPagina] = useState(1);
  const porPagina = 12;
  const [mostrarFiltrosExportar, setMostrarFiltrosExportar] = useState(false);
  const [filtros, setFiltros] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    fetchTrabajadores();
    fetchAreas();
  }, [fetchTrabajadores, fetchAreas]);

  useEffect(() => {
    fetchEvaluaciones({ pagina, porPagina, ...filtros });
  }, [fetchEvaluaciones, pagina, porPagina, filtros]);

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const evaluacionesActivas = useMemo(
    () => evaluaciones.filter((ev) => ev.estado === 'ACTIVA'),
    [evaluaciones]
  );

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

    const porArea = Object.values(
      evaluacionesActivas.reduce((acc, ev) => {
        const key = ev.area?.nombre || 'Sin área';
        if (!acc[key]) {
          acc[key] = { label: key, value: 0 };
        }
        acc[key].value += 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

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
      excelentes,
      aceptables,
      deficientes,
      cumplimientoColorPorcentaje,
      topTrabajadores,
      porArea,
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

  const handleAnularEvaluacion = async (evaluacion) => {
    const motivo = window.prompt(`Ingresa el motivo de anulación para la evaluación de ${evaluacion.trabajador?.nombre || 'este trabajador'}:`);
    if (!motivo) return;

    try {
      await anularEvaluacion(evaluacion.id, motivo);
      await fetchEvaluaciones({ pagina, porPagina, ...filtros });
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo anular', mensaje: err.response?.data?.error || 'No se pudo anular la evaluación. Inténtalo nuevamente.' });
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', color: 'hsl(var(--color-primary))', marginBottom: '0.35rem' }}>
            Dashboard de Evaluaciones BPH
          </h1>
          <p style={{ color: 'hsl(var(--color-text-secondary))', maxWidth: 760 }}>
            Visualización profesional de evaluaciones individuales con foco en desempeño, clasificación, cumplimiento y seguimiento operativo.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(usuario?.rol === 'supervisor' || usuario?.rol === 'administrador') && (
            <button className="btn btn-outline" onClick={() => setMostrarFiltrosExportar((prev) => !prev)}>
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

      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Filter size={18} style={{ color: 'hsl(var(--color-primary))' }} />
            <h2 style={{ fontSize: '1rem' }}>Filtros analíticos</h2>
          </div>
          <button className="btn btn-outline" onClick={limpiarFiltros}>
            <RefreshCcw size={16} />
            Limpiar filtros
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', color: 'hsl(var(--color-text-secondary))' }}>Trabajador</label>
            <select className="input-field" value={filtros.trabajadorId} onChange={(e) => handleFilterChange('trabajadorId', e.target.value)}>
              <option value="">Todos</option>
              {obtenerTrabajadoresActivos().map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', color: 'hsl(var(--color-text-secondary))' }}>Área</label>
            <select className="input-field" value={filtros.areaId} onChange={(e) => handleFilterChange('areaId', e.target.value)}>
              <option value="">Todas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', color: 'hsl(var(--color-text-secondary))' }}>Evaluador</label>
            <select className="input-field" value={filtros.evaluadorId} onChange={(e) => handleFilterChange('evaluadorId', e.target.value)}>
              <option value="">Todos</option>
              {[...new Map(evaluaciones.map((ev) => [ev.evaluador?.id, ev.evaluador]).filter(([id]) => id)).values()].map((evaluador) => (
                <option key={evaluador.id} value={evaluador.id}>{evaluador.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', color: 'hsl(var(--color-text-secondary))' }}>Estado</label>
            <select className="input-field" value={filtros.estado} onChange={(e) => handleFilterChange('estado', e.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVA">Activa</option>
              <option value="ANULADA">Anulada</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', color: 'hsl(var(--color-text-secondary))' }}>Clasificación</label>
            <select className="input-field" value={filtros.clasificacion} onChange={(e) => handleFilterChange('clasificacion', e.target.value)}>
              <option value="">Todas</option>
              <option value="Excelente">Excelente</option>
              <option value="Aceptable">Aceptable</option>
              <option value="Deficiente">Deficiente</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', color: 'hsl(var(--color-text-secondary))' }}>Fecha desde</label>
            <input className="input-field" type="date" value={filtros.fechaDesde} onChange={(e) => handleFilterChange('fechaDesde', e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', color: 'hsl(var(--color-text-secondary))' }}>Fecha hasta</label>
            <input className="input-field" type="date" value={filtros.fechaHasta} onChange={(e) => handleFilterChange('fechaHasta', e.target.value)} />
          </div>
        </div>
      </div>

      {mostrarFiltrosExportar && (usuario?.rol === 'supervisor' || usuario?.rol === 'administrador') && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.9rem' }}>
            La exportación respetará los filtros analíticos actualmente aplicados.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleExportarExcel}>
              <Download size={16} /> Exportar ahora
            </button>
            <button className="btn btn-outline" onClick={() => setMostrarFiltrosExportar(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <KpiCard icon={ShieldCheck} titulo="Evaluaciones activas" valor={resumen.totalItems} subtitulo={`${total} registros encontrados con filtros`} color="hsl(var(--color-primary))" />
        <KpiCard icon={TrendingUp} titulo="Promedio general" valor={`${resumen.promedioGeneral}%`} subtitulo="Promedio del indicador BPH" color="hsl(var(--color-success))" />
        <KpiCard icon={CalendarRange} titulo="Cumplimiento de color" valor={`${resumen.cumplimientoColorPorcentaje}%`} subtitulo="Coincidencia entre color esperado y observado" color="hsl(var(--color-warning))" />
        <KpiCard icon={ShieldAlert} titulo="Deficientes" valor={resumen.deficientes} subtitulo="Evaluaciones con resultado crítico" color="hsl(var(--color-danger))" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>Rendimiento reciente</h3>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Últimas evaluaciones activas dentro del filtro actual</p>
            </div>
          </div>

          {resumen.tendencia.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {resumen.tendencia.map((item, index) => {
                const previous = index > 0 ? resumen.tendencia[index - 1].value : item.value;
                const trendUp = item.value >= previous;
                return (
                  <div key={`${item.label}-${index}`} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-secondary))' }}>{item.label}</span>
                    <div style={{ height: 12, borderRadius: 999, background: 'hsla(var(--color-secondary), 0.12)', overflow: 'hidden' }}>
                      <div style={{ width: `${item.value}%`, height: '100%', background: trendUp ? 'linear-gradient(90deg, hsla(142, 71%, 45%, 0.8), hsla(221, 83%, 53%, 0.9))' : 'linear-gradient(90deg, hsla(38, 92%, 50%, 0.8), hsla(348, 83%, 47%, 0.85))' }} />
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

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>Calidad promedio</h3>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Desglose por dimensión evaluada</p>
          </div>
          <ProgressRow label="General" value={resumen.promedioGeneral} color="linear-gradient(90deg, hsla(221, 83%, 53%, 0.75), hsla(217, 91%, 60%, 0.95))" />
          <ProgressRow label="Higiene" value={resumen.promedioHigiene} color="linear-gradient(90deg, hsla(142, 71%, 45%, 0.8), hsla(171, 77%, 40%, 0.95))" />
          <ProgressRow label="Uniforme" value={resumen.promedioUniforme} color="linear-gradient(90deg, hsla(38, 92%, 50%, 0.8), hsla(24, 95%, 53%, 0.95))" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.25rem' }}>
            <div style={{ padding: '0.85rem', borderRadius: 12, background: 'hsla(142, 71%, 45%, 0.1)' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--color-success))' }}>{resumen.excelentes}</div>
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>Excelentes</div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: 12, background: 'hsla(38, 92%, 50%, 0.1)' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--color-warning))' }}>{resumen.aceptables}</div>
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>Aceptables</div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: 12, background: 'hsla(348, 83%, 47%, 0.1)' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--color-danger))' }}>{resumen.deficientes}</div>
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>Deficientes</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>Volumen por área</h3>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Dónde se concentra la actividad evaluada</p>
          </div>
          {resumen.porArea.length > 0 ? (
            <MiniBarChart data={resumen.porArea} color="linear-gradient(90deg, hsla(221, 83%, 53%, 0.8), hsla(217, 91%, 60%, 0.95))" />
          ) : (
            <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.9rem' }}>No hay datos para este filtro.</p>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>Top desempeño individual</h3>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Promedio general por trabajador</p>
          </div>
          {resumen.topTrabajadores.length > 0 ? (
            <MiniBarChart data={resumen.topTrabajadores} color="linear-gradient(90deg, hsla(142, 71%, 45%, 0.8), hsla(171, 77%, 40%, 0.95))" />
          ) : (
            <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.9rem' }}>No hay datos para este filtro.</p>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid hsla(var(--color-secondary), 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>Detalle de evaluaciones individuales</h3>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Vista operativa para análisis puntual y seguimiento</p>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>
            Mostrando {evaluaciones.length} de {total} resultados
          </div>
        </div>

        {error ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'hsl(var(--color-text-secondary))', maxWidth: '420px', padding: '3rem 2rem' }}>
            <AlertTriangle size={48} style={{ color: 'hsl(var(--color-warning))', marginBottom: '1rem' }} />
            <p style={{ color: 'hsl(var(--color-danger))', marginBottom: '0.5rem', fontWeight: 600 }}>{error}</p>
            <p style={{ fontSize: '0.875rem' }}>Verificá que el backend esté desplegado y la configuración de Neon/Cloudflare sea correcta.</p>
            <button className="btn btn-outline" style={{ marginTop: '1.25rem' }} onClick={() => fetchEvaluaciones({ pagina, porPagina, ...filtros })}>
              Reintentar
            </button>
          </div>
        ) : cargando ? (
          <div style={{ margin: 'auto', padding: '3rem', color: 'hsl(var(--color-text-secondary))' }}>Cargando dashboard...</div>
        ) : evaluaciones.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'hsl(var(--color-text-secondary))', padding: '3rem 2rem' }}>
            <AlertTriangle size={44} style={{ opacity: 0.35, marginBottom: '1rem' }} />
            <p style={{ marginBottom: '0.5rem' }}>No hay evaluaciones para los filtros seleccionados.</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/evaluar')}>
              <PlusCircle size={16} />
              Crear evaluación
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
                    <th>Higiene</th>
                    <th>Uniforme</th>
                    <th>General</th>
                    <th>Color</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluaciones.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'hsl(var(--color-text-secondary))', fontSize: '0.875rem' }}>
                        {ev.fecha ? new Date(ev.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{ev.trabajador?.nombre || '—'}</td>
                      <td style={{ color: 'hsl(var(--color-text-secondary))' }}>{ev.area?.nombre || '—'}</td>
                      <td style={{ color: 'hsl(var(--color-text-secondary))' }}>{ev.evaluador?.nombre || '—'}</td>
                      <td>{ev.higienePorcentaje != null ? `${ev.higienePorcentaje}%` : '—'}</td>
                      <td>{ev.uniformePorcentaje != null ? `${ev.uniformePorcentaje}%` : '—'}</td>
                      <td><ClasificacionBadge clasificacion={ev.clasificacion} porcentaje={ev.generalPorcentaje} /></td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.28rem 0.6rem',
                          borderRadius: 999,
                          background: ev.cumplimientoColor === 'Cumple' ? 'hsla(142, 71%, 45%, 0.12)' : 'hsla(348, 83%, 47%, 0.12)',
                          color: ev.cumplimientoColor === 'Cumple' ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>
                          {ev.colorObservado || '—'}
                          {ev.cumplimientoColor ? `· ${ev.cumplimientoColor}` : ''}
                        </span>
                      </td>
                      <td><EstadoBadge estado={ev.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem', borderTop: '1px solid hsla(var(--color-secondary), 0.15)' }}>
                <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem' }} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.875rem', color: 'hsl(var(--color-text-secondary))' }}>
                  Página {pagina} de {totalPaginas}
                </span>
                <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem' }} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
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
