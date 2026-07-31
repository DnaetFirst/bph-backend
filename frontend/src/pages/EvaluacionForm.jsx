import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvaluacionesStore } from '../store/evaluacionesStore';
import { useTrabajadoresStore } from '../store/trabajadoresStore';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { ArrowLeft, Save, CheckCircle, XCircle, MinusCircle } from 'lucide-react';

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
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchDependenciasFormulario();
    fetchTrabajadores();
  }, [fetchDependenciasFormulario, fetchTrabajadores]);

  // Calcular color esperado según día de la semana
  useEffect(() => {
    if (!fecha) return;
    const fechaObj = new Date(fecha + 'T12:00:00');
    const diaSemana = fechaObj.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    
    const coloresPorDia = {
      1: 'Rojo',    // Lunes
      2: 'Amarillo', // Martes
      3: 'Verde',   // Miércoles
      4: 'Rojo',    // Jueves
      5: 'Amarillo', // Viernes
      6: 'Verde'    // Sábado
    };
    
    setColorEsperado(coloresPorDia[diaSemana] || '');
  }, [fecha]);

  const handleResultadoChange = (parametroId, resultado) => {
    setRespuestas(prev => ({
      ...prev,
      [parametroId]: resultado
    }));
  };

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
      await crearEvaluacion(datos);
      navigate('/');
    } catch {
      // Error manejado en store
    }
  };

  const higieneParams = parametros.filter(p => p.categoria === 'higiene');
  const uniformeParams = parametros.filter(p => p.categoria === 'uniforme');

  const SeccionParametros = ({ titulo, params }) => (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ borderBottom: '1px solid hsla(var(--color-secondary), 0.2)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'hsl(var(--color-primary))' }}>
        {titulo}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {params.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'hsla(var(--color-surface), 0.5)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ flex: 1, paddingRight: '1rem' }}>{p.texto}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => handleResultadoChange(p.id, 'Cumple')} className={`btn ${respuestas[p.id] === 'Cumple' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '0.5rem' }}>
                <CheckCircle size={18} />
              </button>
              <button type="button" onClick={() => handleResultadoChange(p.id, 'No cumple')} className={`btn ${respuestas[p.id] === 'No cumple' ? 'btn-danger' : 'btn-outline'}`} style={{ padding: '0.5rem' }}>
                <XCircle size={18} />
              </button>
              <button type="button" onClick={() => handleResultadoChange(p.id, 'No aplica')} className={`btn ${respuestas[p.id] === 'No aplica' ? 'btn-outline' : 'btn-outline'}`} style={{ padding: '0.5rem', opacity: respuestas[p.id] === 'No aplica' ? 1 : 0.5 }}>
                <MinusCircle size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page-shell animate-fade-in" style={{ maxWidth: '920px', margin: '0 auto' }}>
      <button className="btn btn-outline" onClick={() => navigate('/')} style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={18} /> Volver al dashboard
      </button>
      
      <div className="page-header">
        <div>
          <h1 className="page-title">Nueva evaluación BPH</h1>
          <p className="page-subtitle">Registra una evaluación individual con criterios de higiene, uniforme y control visual de color.</p>
        </div>
      </div>

      <div className="glass-panel section-card-body">
        
        {error && (
          <div style={{ backgroundColor: 'hsla(var(--color-danger), 0.1)', color: 'hsl(var(--color-danger))', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Datos Base */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <label className="label">Fecha de evaluación</label>
              <input 
                required 
                type="date" 
                className="input-field" 
                value={fecha} 
                onChange={e => setFecha(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
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

          <SeccionParametros titulo="Parámetros de Higiene" params={higieneParams} />
          <SeccionParametros titulo="Parámetros de Uniforme" params={uniformeParams} />

          {/* Colores */}
          <div className="info-banner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', padding: '1.5rem' }}>
            <div>
              <label className="label">Color de uniforme esperado</label>
              <input className="input-field" value={colorEsperado} disabled style={{ backgroundColor: 'hsla(var(--color-surface), 0.3)' }} />
              {colorEsperado && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'hsl(var(--color-text-secondary))' }}>
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

          {/* Observaciones */}
          <div style={{ marginBottom: '2rem' }}>
            <label className="label">Observaciones adicionales</label>
            <textarea className="input-field" rows="3" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Anotaciones sobre la evaluación..."></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={cargando}>
              <Save size={18} />
              {cargando ? 'Guardando...' : 'Guardar Evaluación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
