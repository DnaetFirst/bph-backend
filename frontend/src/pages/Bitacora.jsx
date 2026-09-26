import { useEffect, useState, useRef } from 'react';
import { Calendar, User, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '../api/client';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';

export default function Bitacora() {
  const solicitudRef = useRef(0);
  const [eventos, setEventos] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [pagina, setPagina] = useState(1);
  const porPagina = 20;

  useEffect(() => {
    const handler = setTimeout(() => setSearchDebounced(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setPagina(1);
  }, [searchDebounced]);

  const fetchBitacora = async (params = {}) => {
    const { pagina: pag = 1, search = searchDebounced } = params;
    const solicitud = ++solicitudRef.current;
    setCargando(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('pagina', pag);
      queryParams.append('porPagina', porPagina);
      if (search) queryParams.append('q', search);

      const { data } = await apiClient.get(`/admin/bitacora?${queryParams.toString()}`);
      if (solicitud !== solicitudRef.current) return;
      setEventos(data.eventos || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (solicitud !== solicitudRef.current) return;
      setEventos([]);
      setTotal(0);
      setError(err.response?.data?.error || 'No se pudo cargar la bitácora. Intenta nuevamente.');
    } finally {
      if (solicitud === solicitudRef.current) setCargando(false);
    }
  };

  useEffect(() => {
    fetchBitacora({ pagina, search: searchDebounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, searchDebounced]);

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  return (
    <div className="animate-fade-in page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Bitácora de auditoría</h1>
          <p className="page-subtitle">
            Registro completo de acciones realizadas en el sistema.
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => fetchBitacora({ pagina })} disabled={cargando}>
          <RefreshCw size={16} />
          {cargando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      <div style={{ position: 'relative', width: '100%', maxWidth: '320px', marginBottom: 'var(--space-3)' }}>
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

      {error && <ErrorState error={error} onRetry={() => fetchBitacora({ pagina })} />}

      {error ? null : cargando ? (
        <LoadingState mensaje="Cargando bitácora..." />
      ) : eventos.length === 0 ? (
        <div className="empty-state">
          <p style={{ color: 'hsl(var(--color-text-secondary))' }}>No hay eventos para mostrar.</p>
        </div>
      ) : (
        <>
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
                {eventos.map((evento) => (
                  <tr key={evento.id}>
                    <td className="td-nombre" style={{ whiteSpace: 'nowrap', color: 'hsl(var(--color-text-secondary))', fontSize: '0.875rem' }}>
                      <Calendar size={14} style={{ display: 'inline', marginRight: 'var(--space-1)' }} />
                      {new Date(evento.fecha).toLocaleString('es-AR')}
                    </td>
                    <td style={{ fontWeight: 500 }}>{evento.accion}</td>
                    <td>
                      <User size={13} style={{ display: 'inline', marginRight: 'var(--space-1)' }} />
                      {evento.usuario}
                    </td>
                    <td>{evento.rol}</td>
                    <td style={{ color: 'hsl(var(--color-text-secondary))' }}>{evento.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="pagination-footer">
              <button className="btn btn-outline btn-small" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-info">
                Pág. {pagina} de {totalPaginas}
              </span>
              <button className="btn btn-outline btn-small" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
