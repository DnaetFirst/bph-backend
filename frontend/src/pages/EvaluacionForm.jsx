import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Save, CheckCircle, XCircle, MinusCircle, Info, X, ShieldCheck } from 'lucide-react';
import { useEvaluacionesStore } from '../store/evaluacionesStore';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { getLocalISODate, normalizarNombre } from '../utils/fecha';
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
  const [fecha, _setFecha] = useState(getLocalISODate());
  const [evaluacionGuardada, setEvaluacionGuardada] = useState(null);
  const [paso, setPaso] = useState(1);
  const modalRef = useRef(null);
  const formRef = useRef(null);

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
    if (!fecha || uniformeParams.length === 0) return;
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
  }, [fecha, uniformeParams.length]);

  useEffect(() => {
    if (!evaluacionGuardada) return;

    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        navigate('/');
      }
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [evaluacionGuardada, navigate]);

  const handleResultadoChange = (parametroId, resultado) => {
    setRespuestas(prev => ({
      ...prev,
      [parametroId]: resultado
    }));
  };

  const higieneParams = parametros.filter(p => p.categoria === 'higiene');
  const uniformeParams = parametros.filter(p => p.categoria === 'uniforme').filter(p => {
    if (!p.excluyeAreasJson) return true;
    try {
      const excluded = JSON.parse(p.excluyeAreasJson);
      const areaNombre = areas.find(a => String(a.id) === String(areaId))?.nombre || '';
      if (excluded.includes(areaNombre)) return false;
      return !excluded.some(e => normalizarNombre(e) === normalizarNombre(areaNombre));
    } catch {
      return true;
    }
  });

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
  const progresoGeneral = _totalRespondidos > 0 ? Math.round((_totalProgreso / _totalRespondidos) * 100) : 0;

  const clasificacion = progresoGeneral >= 90 ? 'Excelente'
    : progresoGeneral >= 70 ? 'Aceptable'
      : 'Deficiente';

  const clasificacionColor = progresoGeneral >= 90 ? 'hsl(var(--color-success))'
    : progresoGeneral >= 70 ? 'hsl(var(--color-warning))'
      : 'hsl(var(--color-danger))';

  const datosBaseCompletos = trabajadorId && areaId;
  const puedeAvanzar = datosBaseCompletos && (higieneParams.length > 0 || uniformeParams.length > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trabajadorId || !areaId) {
      mostrarToast({ tipo: 'error', titulo: 'Datos incompletos', mensaje: 'Completa los datos básicos.' });
      return;
    }

    const detalles = Object.entries(respuestas).map(([parametroId, resultado]) => ({
      parametroId: parseInt(parametroId),
      resultado
    }));

    if (detalles.length === 0) {
      mostrarToast({ tipo: 'error', titulo: 'Evaluación incompleta', mensaje: 'Debes evaluar al menos un parámetro.' });
      return;
    }

    const datos = {
      fecha: fecha,
      trabajadorId: parseInt(trabajadorId),
      areaId: parseInt(areaId),
      evaluadorId: usuario?.id || 1,
      ...(uniformeParams.length > 0 && {
        colorEsperado: colorEsperado || undefined,
        colorObservado: colorObservado || undefined,
        cumplimientoColor: colorEsperado === colorObservado ? 'Cumple' : 'No cumple',
      }),
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

  const BarraProgreso = ({ label, value, color }) => (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div style={{ width: '100%', height: 10, background: 'hsla(var(--color-secondary), 0.12)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
  const ModalContenido = evaluacionGuardada ? (
    <div className="modal-overlay" onClick={() => navigate('/')}>
      <div className="modal-content" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'hsl(var(--color-text-primary))' }}>
            Resumen de evaluación
          </h2>
          <button
            className="btn-ghost btn-small"
            onClick={() => navigate('/')}
            title="Cerrar"
            style={{ color: 'hsl(var(--color-text-secondary))' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
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
            <strong>{evaluacionGuardada.fecha ? new Date(evaluacionGuardada.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '---'}</strong>
          </div>
          <div>
            <span style={{ color: 'hsl(var(--color-text-secondary))' }}>Evaluador: </span>
            <strong>{evaluacionGuardada.evaluador?.nombre || usuario?.nombre}</strong>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: 'hsl(var(--color-text-primary))' }}>
            Cumplimiento por dimensión
          </h3>
          <BarraProgreso label="Higiene" value={higieneProgress.porcentaje} color="linear-gradient(90deg, hsla(142, 71%, 45%, 0.8), hsla(171, 77%, 40%, 0.95))" />
          {uniformeParams.length > 0 && <BarraProgreso label="Uniforme" value={uniformeProgress.porcentaje} color="linear-gradient(90deg, hsla(38, 92%, 50%, 0.8), hsla(24, 95%, 53%, 0.95))" />}
          <BarraProgreso label="General" value={progresoGeneral} color="linear-gradient(90deg, hsla(221, 83%, 53%, 0.75), hsla(217, 91%, 60%, 0.95))" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldCheck size={24} style={{ color: clasificacionColor }} />
            <span style={{ fontSize: '1rem', fontWeight: 700, color: clasificacionColor }}>
              Clasificación: {clasificacion}
            </span>
          </div>
          {uniformeParams.length > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Cumplimiento de color</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
              {colorEsperado === colorObservado ? (
                <ShieldCheck size={16} style={{ color: 'hsl(var(--color-success))' }} />
              ) : (
                <XCircle size={16} style={{ color: 'hsl(var(--color-danger))' }} />
              )}
              <strong>{colorEsperado === colorObservado ? 'Cumple' : 'No cumple'}</strong>
            </div>
          </div>
        )}
        </div>

        <div className="action-group" style={{ justifyContent: 'center', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => {
             setEvaluacionGuardada(null);
             setPaso(uniformeParams.length > 0 ? 2 : 1);
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            Editar evaluación
          </button>
          <button className="btn btn-primary" onClick={() => {
            setEvaluacionGuardada(null);
            setRespuestas({});
            setObservaciones('');
            setTrabajadorId('');
            setAreaId('');
            setColorEsperado('');
            setColorObservado('');
            setPaso(1);
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            Realizar nueva evaluación
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="animate-fade-in page-shell" style={{ maxWidth: '920px', margin: '0 auto' }}>
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

          <form onSubmit={handleSubmit} ref={formRef}>
            {/* Datos Base — Solo en Paso 1 */}
            {paso === 1 && (
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
                     max={getLocalISODate()}
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
                  <select required className="input-field" value={areaId} onChange={e => setAreaId(e.target.value)} disabled={!trabajadorId}>
                    <option value="">Selecciona un área...</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Evaluador</label>
                  <input className="input-field" value={usuario?.nombre || ''} disabled style={{ backgroundColor: 'hsla(var(--color-surface), 0.3)' }} />
                </div>
              </div>
            )}

            {paso === 1 && (
              <>
                {higieneParams.length > 0 && (
                  <SeccionParametros titulo="Parámetros de Higiene" params={higieneParams} progreso={higieneProgress} />
                )}
                {higieneParams.length === 0 && uniformeParams.length === 0 && (
                  <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.9rem' }}>No hay parámetros configurados para evaluar.</p>
                )}

                <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.9rem', background: 'hsla(var(--color-primary), 0.06)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>
                  Haz clic en cada botón para marcar el estado de cada parámetro: <strong>Cumple</strong>, <strong>No cumple</strong> o <strong>No aplica</strong>.
                </div>

                <div className="action-group" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                 <button type="button" className="btn btn-primary" onClick={() => {
                    if (uniformeParams.length > 0) {
                      setPaso(2);
                    } else {
                      // No uniform params for this area - submit directly
                      const form = formRef.current;
                      if (form) {
                        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                        form.dispatchEvent(submitEvent);
                      }
                    }
                  }} disabled={!puedeAvanzar}>
                    {uniformeParams.length > 0 ? 'Siguiente' : 'Guardar Evaluaci�n'}
                  </button>
                </div>
              </>
            )}

            {paso === 2 && (
              <>
                {uniformeParams.length > 0 && (
                  <>
                    <SeccionParametros titulo="Parámetros de Uniforme" params={uniformeParams} progreso={uniformeProgress} />

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
                  </>
                )}

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
      </section>

      {ModalContenido && createPortal(ModalContenido, document.body)}
    </div>
  );
}
