import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import ErrorState from '../components/ui/ErrorState';

const VALIDACIONES = [
  { test: (v) => v.length >= 6, msg: 'Mínimo 6 caracteres' },
  { test: (v) => /\d/.test(v), msg: 'Al menos un número' },
];

const validarPin = (pin) => {
  for (const { test, msg } of VALIDACIONES) {
    if (!test(pin)) return msg;
  }
  return '';
};

export default function ResetPin() {
  const [token, setToken] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinNuevoConfirm, setPinNuevoConfirm] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token') || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');

    const tokenAUsar = token || tokenFromUrl;
    if (!tokenAUsar) {
      setError('No se proporcionó el token de recuperación.');
      return;
    }

    const err = validarPin(pinNuevo);
    if (err) {
      setError(err);
      return;
    }
    if (pinNuevo !== pinNuevoConfirm) {
      setError('Los PIN no coinciden.');
      return;
    }

    setProcesando(true);
    try {
      await apiClient.post('/auth/reset-pin', { token: tokenAUsar, pinNuevo });
      setExito('PIN restablecido correctamente. Ya puedes iniciar sesión.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al restablecer el PIN.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', margin: '12vh auto', padding: '2.25rem' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: '1rem', marginBottom: '1.6rem' }}>
        <img src="/LogoNexocorp.png" alt="Nexocorp" style={{ height: '120px', width: 'auto' }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.55rem', marginBottom: '0.35rem', color: 'hsl(var(--color-text-primary))' }}>Nuevo PIN</h2>
          <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.92rem' }}>
            Ingresa un nuevo PIN de al menos 6 caracteres (con números). El enlace expira en 15 minutos.
          </p>
        </div>
      </div>

      {(error || exito) && (
        <div style={{ marginBottom: '1rem' }}>
          {error && <ErrorState error={error} />}
          {exito && (
            <div style={{ background: 'hsla(var(--color-success), 0.18)', border: '1px solid hsla(var(--color-success), 0.42)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'hsl(var(--color-success))', fontSize: '0.875rem' }}>
              {exito}
            </div>
          )}
        </div>
      )}

      {!tokenFromUrl && !exito && (
        <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleSubmit}>
          <div>
            <label className="label">Token de recuperación</label>
            <input
              className="input-field"
              type="text"
              placeholder="Pega el token del email aquí..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={procesando}
              required
            />
          </div>
          <div>
            <label className="label">Nuevo PIN</label>
            <input
              className="input-field"
              type="password"
              placeholder="Mínimo 6 caracteres, con números..."
              value={pinNuevo}
              onChange={(e) => { setPinNuevo(e.target.value); setError(''); }}
              disabled={procesando}
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="label">Confirmar PIN</label>
            <input
              className="input-field"
              type="password"
              placeholder="Confirma el nuevo PIN..."
              value={pinNuevoConfirm}
              onChange={(e) => { setPinNuevoConfirm(e.target.value); setError(''); }}
              disabled={procesando}
              minLength={6}
              required
            />
          </div>

          <button className="btn btn-primary" disabled={procesando || !pinNuevo || !pinNuevoConfirm} type="submit">
            {procesando ? 'Restableciendo...' : 'Restablecer PIN'}
          </button>
          <Link to="/login" className="btn btn-ghost btn-small" style={{ justifyContent: 'center' }}>
            Volver al inicio de sesión
          </Link>
        </form>
      )}

      {tokenFromUrl && !exito && (
        <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleSubmit}>
          <div>
            <label className="label">Nuevo PIN</label>
            <input
              className="input-field"
              type="password"
              placeholder="Mínimo 6 caracteres, con números..."
              value={pinNuevo}
              onChange={(e) => { setPinNuevo(e.target.value); setError(''); }}
              disabled={procesando}
              minLength={6}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Confirmar PIN</label>
            <input
              className="input-field"
              type="password"
              placeholder="Confirma el nuevo PIN..."
              value={pinNuevoConfirm}
              onChange={(e) => { setPinNuevoConfirm(e.target.value); setError(''); }}
              disabled={procesando}
              minLength={6}
              required
            />
          </div>

          <button className="btn btn-primary" disabled={procesando || !pinNuevo || !pinNuevoConfirm} type="submit">
            {procesando ? 'Restableciendo...' : 'Restablecer PIN'}
          </button>
          <Link to="/login" className="btn btn-ghost btn-small" style={{ justifyContent: 'center' }}>
            Volver al inicio de sesión
          </Link>
        </form>
      )}
    </div>
  );
}
