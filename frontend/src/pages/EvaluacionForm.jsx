import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle, XCircle, MinusCircle, Info } from 'lucide-react';
import { useEvaluacionesStore } from '../store/evaluacionesStore';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import ErrorState from '../components/ui/ErrorState';

export default function EvaluacionForm() {
  const navigate = useNavigate();
  const { usuario } = useAuthStore();
  const { areas, parametros, fetchDependenciasFormulario, crearEvaluacion, cargando, error } = useEvaluacionesStore();
  const { fetchTrabajadores, obtenerTrabajadoresActivos } = useTrabajadoresStore();

  const mostrarToast = useUiStore((state) => state.mostrarToast);

  const [trabajadorId, setTrabajadorId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [colorEsperado, setColorEsperado] = useState('');
  const [colorObservado, setColorObservado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [respuestas, setRespuestas] = useState({});
  const [fecha, _setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [evaluacionGuardada, setEvaluacionGuardada] = useState(null);
  const [paso, setPaso] = useState(1);

  useEffect(() => {
    fetchDependenciasFormulario();
    fetchTrabajadores();
  }, [fetchDependenciasFormulario, fetchTrabajadores]);

  useEffect(() => {
    if (trabajadorId) {
      const trabajador = obtenerTrabajadoresActivos().find(
        (t) => String(t.id) === String(trabajadorId)
      );
      if (trabajador) {
        setAreaId(trabajador.areaId ? String(trabajador.areaId) : '');
      }
    }
  }, [trabajadorId, obtenerTrabajadoresActivos]);

  useEffect(() => {
    if (!fecha) return;
    const fechaObj = new Date(fecha + 'T12:00:00');
    const diaSemana = fechaObj.getDay();

    const coloresPorDia = {
      1: 'Rojo',
      2: 'Amarillo',
      3: 'Verde',
      4: 'Rojo',
      5: 'Amarillo',
      6: 'Verde',
    };

    setColorEsperado(coloresPorDia[diaSemana] || '');
  }, [fecha]);

  const handleResultadoChange = (parametroId, resultado) => {
    setRespuestas(prev => ({
      ...prev,
      [parametroId]: resultado
    }));
  };

  const higieneParams = parametros.filter(p => p.categoria === 'higiene');
  const uniformeParams = parametros.filter(p => p.categoria === 'uniforme');

  const calcularProgreso = (params) => {
    const total = params.length;
    const cumple = params.filter((p) => respuestas[p.id] === 'Cumple').length;
    const porcentaje = total > 0 ? Math.round((cumple / total) * 100) : 0;
    return { cumple, total, porcentaje };
  };

  const higieneProgress = calcularProgreso(higieneParams);
  const uniformeProgress = calcularProgreso(uniformeParams);

  const _totalRespondidos = higieneProgress.total + uniformeProgress.total;
  const _totalProgreso = higieneProgress.cumple + uniformeProgress.cumple;
  const _progresoGeneral = _totalRespondidos > 0 ? Math.round((_totalProgreso / _totalRespondidos) * 100) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trabajadorId || !areaId) {
      mostrarToast({ tipo: 'error', titulo: 'Datos incompletos', mensaje: 'Completa los datos básicos de la evaluación antes de continuar.' });
      return;
    }

    const detalles = Object.entries(respuestas).map(([parametroId, resultado]) => ({
      parametroId: parseInt(parametroId),
      resultado
    }));

    if (detalles.length === 0) {
      mostrarToast({ tipo: 'error', titulo: 'Evaluación incompleta', mensaje: 'Debes evaluar al menos un parámetro antes de guardar.' });
      return;
    }

    const datos = {
      fecha: fecha,
      trabajadorId: parseInt(trabajadorId),
      areaId: parseInt(areaId),
      evaluadorId: usuario?.id || 1,
      colorEsperado: colorEsperado || undefined,
      colorObservado: colorObservado || undefined,
      cumplimientoColor: colorEsperado === colorObservado ? 'Cumple' : 'No cumple',
      observaciones: observaciones || undefined,
      detalles
    };

    try {
      const result = await crearEvaluacion(datos);
      const trabajador = obtenerTrabajadoresActivos().find(
        (t) => String(t.id) === String(trabajadorId)
      );
      const area = areas.find((a) => String(a.id) === String(areaId));
      setEvaluacionGuardada({
        ...result,
        trabajador: { nombre: trabajador?.nombre || '' },
        area: { nombre: area?.nombre || '' },
        evaluador: { nombre: usuario?.nombre || '' },
      });
    } catch {
      // Error manejado en store
    }
  };

  const SeccionParametros = ({ titulo, params, progreso }) => (
    <section className="section-card">
      <div className="section-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="section-title">{titulo}</h3>
          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>
            {progreso.cumple}/{progreso.total} cumplen · {progreso.porcentaje}%
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {params.map(p => {
            const valorActual = respuestas[p.id] || null;
            return (
              <div key={p.id} style={{ padding: '0.85rem', background: 'hsla(var(--color-surface), 0.5)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500, color: 'hsl(var(--color-text-primary))' }}>
                  {p.texto}
                </div>
                <div className="segmented">
                  <button
                    type="button"
                    className={`segmented-btn ${valorActual === 'Cumple' ? 'active' : 'inactive'}`}
                    style={{
                      background: valorActual === 'Cumple' ? 'hsla(153, 69%, 42%, 0.15)' : undefined,
                      color: valorActual === 'Cumple' ? 'hsl(153, 69%, 35%)' : undefined,
                      fontWeight: valorActual === 'Cumple' ? 700 : 400,
                    }}
                    onClick={() => handleResultadoChange(p.id, 'Cumple')}
                  >
                    <CheckCircle size={14} /> Cumple
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${valorActual === 'No cumple' ? 'active' : 'inactive'}`}
                    style={{
                      background: valorActual === 'No cumple' ? 'hsla(348, 75%, 61%, 0.15)' : undefined,
                      color: valorActual === 'No cumple' ? 'hsl(348, 75%, 45%)' : undefined,
                      fontWeight: valorActual === 'No cumple' ? 700 : 400,
                    }}
                    onClick={() => handleResultadoChange(p.id, 'No cumple')}
                  >
                    <XCircle size={14} /> No cumple
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${valorActual === 'No aplica' ? 'active' : 'inactive'}`}
                    style={{
                      background: valorActual === 'No aplica' ? 'hsla(221, 83%, 53%, 0.15)' : undefined,
                      color: valorActual === 'No aplica' ? 'hsl(221, 83%, 40%)' : undefined,
                      fontWeight: valorActual === 'No aplica' ? 700 : 400,
                    }}
                    onClick={() => handleResultadoChange(p.id, 'No aplica')}
                  >
                    <MinusCircle size={14} /> No aplica
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );

  const observacionesMaxLen = 500;
  const progresoObservaciones = observaciones ? Math.round((observaciones.length / observacionesMaxLen) * 100) : 0;

  return (
    <div className="animate-fade-in page-shell" style={{ maxWidth: '920px', margin: '0 auto' }}>
      <button className="btn btn-outline btn-small" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> Volver al dashboard
      </button>

      <header className="page-header">
        <div>
          <h1 className="page-title">Nueva evaluación BPH</h1>
          <p className="page-subtitle">
            Registra una evaluación individual con criterios de higiene, uniforme y control visual de color.
          </p>
        </div>
      </header>

      <section className="section-card">
        <div className="section-card-body">
          {error && <ErrorState error={error} />}

          <form onSubmit={handleSubmit}>
            {/* Datos Base */}
            <div className="form-grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label className="label">Fecha de evaluación</label>
                <input
                  required
                  type="date"
                  className="input-field"
                  value={fecha}
                  disabled
                  readOnly
                  style={{ backgroundColor: 'hsla(var(--color-surface), 0.3)' }}
                  max={new Date().toISOString().split('T')[0]}
                />
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'hsl(var(--color-text-secondary))' }}>
                  <Info size={12} style={{ display: 'inline', marginRight: '0.2rem' }} />
                  Fecha auto-generada al momento de crear la evaluación
                </div>
              </div>
              <div>
                <label className="label">Trabajador</label>
                <select required className="input-field" value={trabajadorId} onChange={e => setTrabajadorId(e.target.value)}>
                  <option value="">Selecciona un trabajador...</option>
                  {obtenerTrabajadoresActivos().map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Área</label>
                <select required className="input-field" value={areaId} onChange={e => setAreaId(e.target.value)}>
                  <option value="">Selecciona un área...</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Evaluador</label>
                <input className="input-field" value={usuario?.nombre || ''} disabled style={{ backgroundColor: 'hsla(var(--color-surface), 0.3)' }} />
              </div>
            </div>

            {paso === 1 && (
              <>
            {higieneParams.length > 0 && (
              <SeccionParametros titulo="Parámetros de Higiene" params={higieneParams} progreso={higieneProgress} />
            )}
            {uniformeParams.length === 0 && higieneParams.length === 0 && (
              <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.9rem' }}>No hay parámetros configurados para evaluar.</p>
            )}

            <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.9rem', background: 'hsla(var(--color-primary), 0.06)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>
              Haz clic en cada botón para marcar el estado de cada parámetro: <strong>Cumple</strong>, <strong>No cumple</strong> o <strong>No aplica</strong>.
            </div>

            <div className="action-group" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => setPaso(2)} disabled={higieneParams.length === 0}>
                Siguiente
              </button>
            </div>
          </>
        )}

        {paso === 2 && (
          <>
            {uniformeParams.length > 0 && (
              <SeccionParametros titulo="Parámetros de Uniforme" params={uniformeParams} progreso={uniformeProgress} />
            )}

            {/* Control de Color */}
            <section className="info-banner" style={{ padding: '1.25rem' }}>
              <div className="form-grid-2" style={{ gap: '1rem' }}>
                <div>
                  <label className="label">Color de uniforme esperado</label>
                  <input
                    className="input-field"
                    value={colorEsperado}
                    disabled
                    style={{ backgroundColor: 'hsla(var(--color-surface), 0.3)' }}
                  />
                  {colorEsperado && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'hsl(var(--color-text-secondary))' }}>
                      <Info size={12} style={{ display: 'inline', marginRight: '0.2rem' }} />
                      Calculado automáticamente según el día de la semana
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Color observado</label>
                  <select className="input-field" value={colorObservado} onChange={e => setColorObservado(e.target.value)}>
                    <option value="">Selecciona el color observado...</option>
                    <option value="Rojo">Rojo</option>
                    <option value="Amarillo">Amarillo</option>
                    <option value="Verde">Verde</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Observaciones */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="label">Observaciones adicionales</label>
              <textarea
                className="input-field"
                rows="3"
                maxLength={observacionesMaxLen}
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Anotaciones sobre la evaluación..."
              />
              <div className="char-counter" style={{ color: progresoObservaciones >= 100 ? 'hsl(var(--color-danger))' : progresoObservaciones >= 75 ? 'hsl(var(--color-warning))' : 'hsl(var(--color-text-secondary))' }}>
                {observaciones.length}/{observacionesMaxLen} caracteres
              </div>
            </div>

            {/* Botones de acción */}
            <div className="action-group" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setPaso(1)}>
                Volver
              </button>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={cargando}>
                <Save size={18} />
                {cargando ? 'Guardando...' : 'Guardar Evaluación'}
              </button>
            </div>
          </>
        )}
      </form>
        </div>

        {evaluacionGuardada && (
          <div style={{ marginTop: '1.5rem' }}>
            <div className="info-banner" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <CheckCircle size={22} style={{ color: 'hsl(var(--color-success))' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'hsl(var(--color-success))' }}>
                  Evaluación guardada correctamente
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: 'hsl(var(--color-text-secondary))' }}>Trabajador: </span>
                  <strong>{evaluacionGuardada.trabajador?.nombre || '---'}</strong>
                </div>
                <div>
                  <span style={{ color: 'hsl(var(--color-text-secondary))' }}>Área: </span>
                  <strong>{evaluacionGuardada.area?.nombre || '---'}</strong>
                </div>
                <div>
                  <span style={{ color: 'hsl(var(--color-text-secondary))' }}>Fecha: </span>
                  <strong>{evaluacionGuardada.fecha ? new Date(evaluacionGuardada.fecha).toLocaleDateString('es-AR') : '---'}</strong>
                </div>
                <div>
                  <span style={{ color: 'hsl(var(--color-text-secondary))' }}>Evaluador: </span>
                  <strong>{evaluacionGuardada.evaluador?.nombre || usuario?.nombre}</strong>
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-outline btn-small" onClick={() => navigate('/')}>
                  Volver al inicio
                </button>
                <button className="btn btn-outline btn-small" onClick={() => { setEvaluacionGuardada(null); setRespuestas({}); setObservaciones(''); }}>
                  Nueva evaluación
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}