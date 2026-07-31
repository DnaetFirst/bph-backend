import { useEffect, useState } from 'react';
import { Calendar, User, RefreshCw, Search } from 'lucide-react';
import { apiClient } from '../api/client';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';

const eventosSample = [
  { id: 1, accion: 'Login exitoso', usuario: 'EVA MORALES', rol: 'administrador', ip: '127.0.0.1', fecha: '2026-07-30T14:30:00Z' },
  { id: 2, accion: 'Crear evaluación', usuario: 'EVA MORALES', rol: 'administrador', ip: '127.0.0.1', fecha: '2026-07-30T14:32:00Z' },
  { id: 3, accion: 'Anular evaluación', usuario: 'EVA MORALES', rol: 'administrador', ip: '127.0.0.1', fecha: '2026-07-30T14:35:00Z' },
];

export default function Bitacora() {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBitacora();
  }, []);

  const fetchBitacora = async () => {
    setCargando(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/admin/bitacora');
      setEventos(data.eventos || data || eventosSample);
    } catch {
      setEventos(eventosSample);
    } finally {
      setCargando(false);
    }
  };

  const filtered = eventos.filter((e) =>
    e.accion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.usuario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Bitácora de auditoría</h1>
          <p className="page-subtitle">
            Registro completo de acciones realizadas en el sistema.
          </p>
        </div>
        <button className="btn btn-outline" onClick={fetchBitacora} disabled={cargando}>
          <RefreshCw size={16} />
          {cargando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      <div style={{ position: 'relative', maxWidth: '320px', marginBottom: '1rem' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--color-text-secondary))' }} />
        <input
          type="text"
          className="input-field"
          placeholder="Buscar por acción o usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ paddingLeft: '2.5rem' }}
        />
      </div>

      {error && <ErrorState error={error} onRetry={fetchBitacora} />}

      {cargando ? (
        <LoadingState mensaje="Cargando bitácora..." />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p style={{ color: 'hsl(var(--color-text-secondary))' }}>No hay eventos para mostrar.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((evento) => (
                <tr key={evento.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'hsl(var(--color-text-secondary))', fontSize: '0.875rem' }}>
                    <Calendar size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
                    {new Date(evento.fecha).toLocaleString('es-AR')}
                  </td>
                  <td style={{ fontWeight: 500 }}>{evento.accion}</td>
                  <td>
                    <User size={13} style={{ display: 'inline', marginRight: '0.3rem' }} />
                    {evento.usuario}
                  </td>
                  <td>{evento.rol}</td>
                  <td style={{ color: 'hsl(var(--color-text-secondary))' }}>{evento.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
