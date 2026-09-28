import { colorEsperadoParaArea } from '../utils/colorUniforme';
import { useEffect, useRef, useState } from 'react';
import Modal from '../components/ui/Modal';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, CheckCircle, XCircle, MinusCircle, Info, X, ShieldCheck } from 'lucide-react';
import { useEvaluacionesStore } from '../store/evaluacionesStore';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { getLocalISODate, normalizarNombre } from '../utils/fecha';
import { calcularProgreso, clasificar } from '../utils/evaluacion';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

export default function EvaluacionForm() {
  const navigate = useNavigate();
  const { id: evaluacionId } = useParams();
  const esEdicion = Boolean(evaluacionId);
  const { usuario } = useAuthStore();
  const { areas, parametros, fetchDependenciasFormulario, crearEvaluacion, obtenerEvaluacion, editarEvaluacion, cargando, error, dependenciasCargando, dependenciasError } = useEvaluacionesStore();
  const { fetchTrabajadores, obtenerTrabajadoresActivos } = useTrabajadoresStore();

  const mostrarToast = useUiStore((state) => state.mostrarToast);

  const [trabajadorId, setTrabajadorId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [colorObservado, setColorObservado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [respuestas, setRespuestas] = useState({});
  const [fecha, setFecha] = useState(getLocalISODate());
  const [evaluacionOriginal, setEvaluacionOriginal] = useState(null);
  const [cargandoEdicion, setCargandoEdicion] = useState(esEdicion);
  const [evaluacionGuardada, setEvaluacionGuardada] = useState(null);
  const [paso, setPaso] = useState(1);
  const formRef = useRef(null);

  useEffect(() => {
    fetchDependenciasFormulario();
    fetchTrabajadores();
  }, [fetchDependenciasFormulario, fetchTrabajadores]);

  useEffect(() => {
    if (!esEdicion) return;
    let vigente = true;
    setCargandoEdicion(true);
    obtenerEvaluacion(evaluacionId)
      .then((evaluacion) => {
        if (!vigente) return;
        if (evaluacion.estado === 'ANULADA') {
          mostrarToast({ tipo: 'error', titulo: 'Edición no permitida', mensaje: 'No se puede editar una evaluación anulada.' });
          navigate('/dashboard', { replace: true });
          return;
        }
        setEvaluacionOriginal(evaluacion);
        setTrabajadorId(String(evaluacion.trabajadorId));
        setAreaId(String(evaluacion.areaId));
        setFecha(String(evaluacion.fecha).slice(0, 10));
        setColorObservado(evaluacion.colorObservado || '');
        setObservaciones(evaluacion.observaciones || '');
        setRespuestas(Object.fromEntries(
          (evaluacion.detalles || []).map((detalle) => [detalle.parametroId, detalle.resultado])
        ));
      })
      .catch((err) => {
        if (!vigente) return;
        mostrarToast({
          tipo: 'error',
          titulo: 'No se pudo cargar',
          mensaje: err.response?.data?.error || 'No se pudo cargar la evaluación para editar.',
        });
        navigate('/dashboard', { replace: true });
      })
      .finally(() => vigente && setCargandoEdicion(false));
    return () => { vigente = false; };
  }, [esEdicion, evaluacionId, obtenerEvaluacion, mostrarToast, navigate]);

  useEffect(() => {
    if (esEdicion) return;
    if (trabajadorId) {
      const trabajador = obtenerTrabajadoresActivos().find(
        (t) => String(t.id) === String(trabajadorId)
      );
      if (trabajador) {
        setAreaId(trabajador.areaId ? String(trabajador.areaId) : '');
      }
    }
  }, [trabajadorId, obtenerTrabajadoresActivos, esEdicion]);


  const areaSeleccionada = areas.find(a => String(a.id) === String(areaId));
  const areaNormalizada = normalizarNombre(areaSeleccionada?.nombre || evaluacionOriginal?.area?.nombre || '');
  const sinUniforme = ['produccion', 'calidad e inocuidad'].includes(areaNormalizada);
  const colorEsperado = colorEsperadoParaArea(areaNormalizada, fecha) || '';
  const requiereColor = Boolean(colorEsperado);
  const resultadoColor = requiereColor && colorObservado ? (colorEsperado === colorObservado ? 'Cumple' : 'No cumple') : null;
  const parametrosAplicables = parametros.filter(p => {
    if (sinUniforme && p.categoria === 'uniforme') return false;
    try {
      const excluidas = JSON.parse(p.excluyeAreasJson || '[]');
      return !Array.isArray(excluidas) || !excluidas.some(nombre => normalizarNombre(nombre) === areaNormalizada);
    } catch { return true; }
  });
  const higieneParams = parametrosAplicables.filter(p => p.categoria === 'higiene');
  const uniformeParams = parametrosAplicables.filter(p => p.categoria === 'uniforme');

  useEffect(() => {
    if (!sinUniforme) return;
    const idsUniforme = new Set(
      parametros.filter((parametro) => parametro.categoria === 'uniforme').map((parametro) => String(parametro.id))
    );
    setRespuestas((prev) => Object.fromEntries(
      Object.entries(prev).filter(([parametroId]) => !idsUniforme.has(String(parametroId)))
    ));
  }, [sinUniforme, parametros]);

  useEffect(() => {
    if (!esEdicion) setColorObservado('');
  }, [fecha, areaId, esEdicion]);

  const handleResultadoChange = (parametroId, resultado) => {
    setRespuestas(prev => ({
      ...prev,
      [parametroId]: resultado
    }));
  };

  useEffect(() => {
    if (!esEdicion) { setRespuestas({}); setObservaciones(''); setColorObservado(''); }
  }, [trabajadorId, areaId, esEdicion]);

  const higieneProgress = calcularProgreso(higieneParams, respuestas);
  const uniformeProgress = calcularProgreso(uniformeParams, respuestas, resultadoColor);
  const progreso = calcularProgreso([...higieneParams, ...uniformeParams], respuestas, resultadoColor);
  const progresoGeneral = progreso.porcentaje;
  const clasificacion = clasificar(progresoGeneral);
  const clasificacionColor = progresoGeneral == null ? 'hsl(var(--color-text-secondary))'
    : progresoGeneral >= 90 ? 'hsl(var(--color-success))'
    : progresoGeneral >= 75 ? 'hsl(var(--color-warning))' : 'hsl(var(--color-danger))';

  const datosBaseCompletos = trabajadorId && areaId;
  const puedeAvanzar = datosBaseCompletos && fecha && !dependenciasCargando && !dependenciasError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trabajadorId || !areaId) {
      mostrarToast({ tipo: 'error', titulo: 'Datos incompletos', mensaje: 'Completa los datos básicos.' });
      return;
    }

    const aplicables = [...higieneParams, ...uniformeParams];
    if (!aplicables.length || aplicables.some(p => !respuestas[p.id])) {
      mostrarToast({ tipo: 'error', titulo: 'Evaluación incompleta', mensaje: 'Responde todos los parámetros; usa No aplica cuando corresponda.' });
      return;
    }
    if (requiereColor && !colorObservado) {
      mostrarToast({ tipo: 'error', titulo: 'Color pendiente', mensaje: 'Selecciona el color observado del uniforme.' });
      return;
    }
    const detalles = aplicables.map(p => ({ parametroId: p.id, resultado: respuestas[p.id] }));

    const datos = {
      fecha: fecha,
      trabajadorId: parseInt(trabajadorId),
      areaId: parseInt(areaId),
      evaluadorId: usuario.id,
      // En fin de semana no se registra color de uniforme
      colorEsperado: requiereColor && colorEsperado ? colorEsperado : undefined,
      colorObservado: requiereColor && colorObservado ? colorObservado : undefined,
      cumplimientoColor: requiereColor && colorEsperado && colorObservado
        ? (colorEsperado === colorObservado ? 'Cumple' : 'No cumple')
        : undefined,
      observaciones: observaciones || undefined,
      detalles
    };

    try {
      if (esEdicion) {
        await editarEvaluacion(evaluacionId, {
          colorEsperado: datos.colorEsperado,
          colorObservado: datos.colorObservado,
          cumplimientoColor: datos.cumplimientoColor,
          observaciones: datos.observaciones,
          detalles,
        });
        navigate('/dashboard');
        return;
      }
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
        <div className="section-heading-row" style={{ marginBottom: 'var(--space-3)' }}>
          <h3 className="section-title">{titulo}</h3>
          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--color-text-secondary))' }}>
            {progreso.cumple}/{progreso.total} cumplen · {progreso.porcentaje == null ? 'N/A' : `${progreso.porcentaje}%`}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {params.map(p => {
            const valorActual = respuestas[p.id] || null;
            return (
              <div key={p.id} style={{ padding: 'var(--space-3)', background: 'hsla(var(--color-surface), 0.5)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ marginBottom: 'var(--space-2)', fontSize: '0.9rem', fontWeight: 500, color: 'hsl(var(--color-text-primary))' }}>
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
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 'var(--space-1)' }}>
        <span>{label}</span>
        <strong>{value == null ? 'N/A' : `${value ?? 0}%`}</strong>
      </div>
      <div style={{ width: '100%', height: 10, background: 'hsla(var(--color-secondary), 0.12)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${value ?? 0}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
  const ModalContenido = evaluacionGuardada ? (
    <Modal label="Evaluación guardada" onClose={() => navigate('/')}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="section-heading-row" style={{ marginBottom: 'var(--space-4)' }}>
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

        <div className="dialog-details" style={{ gap: 'var(--space-3)', fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
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

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 'var(--space-3)', color: 'hsl(var(--color-text-primary))' }}>
            Cumplimiento por dimensión
          </h3>
          <BarraProgreso label="Higiene" value={higieneProgress.porcentaje} color="linear-gradient(90deg, hsla(142, 71%, 45%, 0.8), hsla(171, 77%, 40%, 0.95))" />
          {(uniformeParams.length > 0 || requiereColor) && <BarraProgreso label="Uniforme / color" value={uniformeProgress.porcentaje} color="linear-gradient(90deg, hsla(38, 92%, 50%, 0.8), hsla(24, 95%, 53%, 0.95))" />}
          <BarraProgreso label="General" value={progresoGeneral} color="linear-gradient(90deg, hsla(221, 83%, 53%, 0.75), hsla(217, 91%, 60%, 0.95))" />
        </div>

        <div className="section-heading-row" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <ShieldCheck size={24} style={{ color: clasificacionColor }} />
            <span style={{ fontSize: '1rem', fontWeight: 700, color: clasificacionColor }}>
              Clasificación: {clasificacion}
            </span>
          </div>
          {requiereColor && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>Cumplimiento de color</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                {colorEsperado === colorObservado ? (
                  <ShieldCheck size={16} style={{ color: 'hsl(var(--color-success))' }} />
                ) : (
                  <XCircle size={16} style={{ color: 'hsl(var(--color-danger))' }} />
                )}
                <strong>{evaluacionGuardada.cumplimientoColor || 'Sin registrar'}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="action-group" style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
          {['administrador', 'supervisor'].includes(usuario?.rol) && <button className="btn btn-outline" onClick={() => {
            navigate(`/evaluar/${evaluacionGuardada.id}/editar`);
            setEvaluacionGuardada(null);
          }}>
            Editar evaluación
          </button>}
          <button className="btn btn-primary" onClick={() => {
            setEvaluacionGuardada(null);
            setRespuestas({});
            setObservaciones('');
            setTrabajadorId('');
            setAreaId('');
            setColorObservado('');
            setFecha(getLocalISODate());
            setPaso(1);
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            Realizar nueva evaluación
          </button>
        </div>
      </div>
    </Modal>
  ) : null;

  if (dependenciasCargando) return <LoadingState mensaje="Cargando formulario..." />;
  if (dependenciasError) return <ErrorState error={dependenciasError} onRetry={fetchDependenciasFormulario} />;

  return (
    <div className="animate-fade-in page-shell" style={{ maxWidth: '920px', margin: '0 auto' }}>
      <header className="page-header">
        <div>
          <h1 className="page-title">{esEdicion ? 'Editar evaluación BPH' : 'Nueva evaluación BPH'}</h1>
          <p className="page-subtitle">
            {sinUniforme
              ? 'Evalúa higiene y, de lunes a viernes, el color del uniforme.'
              : 'Registra una evaluación individual con criterios de higiene y uniforme.'}
          </p>
        </div>
      </header>

      <section className="section-card">
        <div className="section-card-body">
          {error && <ErrorState error={error} />}

          {cargandoEdicion ? (
            <div className="loading-state">Cargando evaluación...</div>
          ) : <form onSubmit={handleSubmit} ref={formRef} style={{ scrollMarginTop: '7rem' }}>
            {/* Datos Base — Solo en Paso 1 */}
            {paso === 1 && (
              <div className="form-grid-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
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
                  <div style={{ marginTop: 'var(--space-2)', fontSize: '0.78rem', color: 'hsl(var(--color-text-secondary))' }}>
                    <Info size={12} style={{ display: 'inline', marginRight: 'var(--space-1)' }} />
                    Fecha auto-generada al momento de crear la evaluación
                  </div>
                </div>
                <div>
                  <label className="label">Trabajador</label>
                  {esEdicion ? (
                    <input className="input-field" value={evaluacionOriginal?.trabajador?.nombre || ''} disabled />
                  ) : (
                    <select required className="input-field" value={trabajadorId} onChange={e => setTrabajadorId(e.target.value)}>
                      <option value="">Selecciona un trabajador...</option>
                      {obtenerTrabajadoresActivos().map(t => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="label">Área</label>
                  {esEdicion ? (
                    <input className="input-field" value={evaluacionOriginal?.area?.nombre || ''} disabled />
                  ) : (
                    <select required className="input-field" value={areaId} onChange={e => setAreaId(e.target.value)} disabled={!trabajadorId}>
                      <option value="">Selecciona un área...</option>
                      {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="label">Evaluador</label>
                  <input className="input-field" value={esEdicion ? (evaluacionOriginal?.evaluador?.nombre || '') : (usuario?.nombre || '')} disabled style={{ backgroundColor: 'hsla(var(--color-surface), 0.3)' }} />
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

                <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'hsla(var(--color-primary), 0.06)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'hsl(var(--color-text-secondary))' }}>
                  Haz clic en cada botón para marcar el estado de cada parámetro: <strong>Cumple</strong>, <strong>No cumple</strong> o <strong>No aplica</strong>.
                </div>

                <div className="action-group" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
                  <button type="button" className="btn btn-primary" onClick={() => setPaso(2)} disabled={!puedeAvanzar}>
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

                {/* Control de Color — solo días de semana (Lunes a Viernes) */}
                {requiereColor && (
                  <section className="info-banner" style={{ padding: 'var(--space-4)' }}>
                    <div className="form-grid-2" style={{ gap: 'var(--space-3)' }}>
                      <div>
                        <label className="label">Color de uniforme esperado</label>
                        <input
                          className="input-field"
                          value={colorEsperado}
                          disabled
                          style={{ backgroundColor: 'hsla(var(--color-surface), 0.3)' }}
                        />
                        {colorEsperado && (
                          <div style={{ marginTop: 'var(--space-2)', fontSize: '0.78rem', color: 'hsl(var(--color-text-secondary))' }}>
                            <Info size={12} style={{ display: 'inline', marginRight: 'var(--space-1)' }} />
                            Calculado según el día. Cuenta como un criterio en la puntuación general.
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="label">Color observado</label>
                        <select required className="input-field" value={colorObservado} onChange={e => setColorObservado(e.target.value)}>
                          <option value="">Selecciona el color observado...</option>
                          <option value="Rojo">Rojo</option>
                          <option value="Amarillo">Amarillo</option>
                          <option value="Verde">Verde</option>
                        </select>
                      </div>
                    </div>
                  </section>
                )}

                {/* Observaciones */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
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
                    {cargando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Guardar Evaluación'}
                  </button>
                </div>
              </>
            )}
          </form>}
        </div>
      </section>

      {ModalContenido}
    </div>
  );
}
