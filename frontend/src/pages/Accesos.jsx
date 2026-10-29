import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import Modal from '../components/ui/Modal';
import '../modules/bajas/bajas.css';

export default function Accesos({ embedded = false }) {
  const [rows, setRows] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [row, setRow] = useState(null), [motivo, setMotivo] = useState(''), [busy, setBusy] = useState(false);
  const sending = useRef(false);
  async function cargar() { setLoading(true); try { setRows((await apiClient.get('/bajas/accesos')).data); setError(''); } catch(e) { setError(e.response?.data?.error || 'No se pudieron cargar los accesos'); } finally { setLoading(false); } }
  useEffect(() => { cargar(); }, []);

  const content = (
    <div className="section-card-body">
      {!embedded && <h1 className="page-title">Accesos a módulos</h1>}
      {embedded ? (
        <div className="section-heading-row" style={{ marginBottom: 'var(--space-3)' }}>
          <h2 className="section-title">Accesos a módulos</h2>
          <button className="btn btn-outline btn-small" onClick={cargar} disabled={loading}>Actualizar</button>
        </div>
      ) : null}
      <p className="page-subtitle" style={{ marginBottom: 'var(--space-3)' }}>
        El acceso habilita Bajas; el rol del usuario determina qué puede hacer. Los administradores tienen acceso automáticamente.
      </p>
      {error && <p role="alert" className="bajas-error">{error}</p>}
      {loading ? (
        <p role="status">Cargando accesos…</p>
      ) : (
        <>
          {!embedded && <button className="btn btn-outline" onClick={cargar}>Actualizar</button>}
          <ul className="bajas-list">
            {rows.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.nombre}</strong>
                  <p>{u.rol} · Bajas: {u.acceso ? 'Habilitado' : 'Sin acceso'}</p>
                </div>
                {u.rol !== 'administrador' && (
                  <button className="btn btn-outline btn-small" onClick={() => { setRow(u); setMotivo(''); setError(''); }}>
                    {u.acceso ? 'Retirar acceso' : 'Habilitar Bajas'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {row && (
        <Modal label="Cambiar acceso a Bajas" busy={busy} onClose={() => !busy && setRow(null)}>
          <form className="modal-content bajas-dialog" onSubmit={async (e) => {
            e.preventDefault(); if (sending.current) return; sending.current = true; setBusy(true);
            try {
              await apiClient.put(`/bajas/accesos/${row.id}`, { activo: !row.acceso, version: row.version, motivo });
              setRow(null); await cargar();
            } catch (e) {
              setError(e.response?.data?.error || 'No se pudo actualizar el acceso');
            } finally {
              setBusy(false); sending.current = false;
            }
          }}>
            <h2>{row.acceso ? 'Retirar acceso' : 'Habilitar Bajas'} · {row.nombre}</h2>
            <label>Motivo<textarea className="input-field" required minLength={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={busy} /></label>
            {error && <p role="alert" className="bajas-error">{error}</p>}
            <div className="bajas-actions">
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setRow(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={busy}>Confirmar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );

  return embedded ? content : <section className="section-card bajas-page">{content}</section>;
}
