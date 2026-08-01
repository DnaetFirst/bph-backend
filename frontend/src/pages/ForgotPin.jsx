import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { apiClient } from '../api/client';
import ErrorState from '../components/ui/ErrorState';

export default function ForgotPin() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setExito(false);

    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.');
      return;
    }

    setProcesando(true);
    try {
      await apiClient.post('/auth/forgot-pin', { email });
      setExito(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar el enlace de recuperación.');
    } finally {
      setProcesando(false);
    }
  };

  if (exito) {
    return (
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', margin: '12vh auto', padding: '2.25rem' }}>
        <div style={{ display: 'grid', justifyItems: 'center', gap: '1rem', marginBottom: '1.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'hsla(var(--color-success), 0.18)' }}>
            <Mail size={32} style={{ color: 'hsl(var(--color-success))' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.55rem', marginBottom: '0.35rem', color: 'hsl(var(--color-text-primary))' }}>¡Email enviado!</h2>
            <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.92rem' }}>
              Si el correo está registrado, recibirás un enlace para restablecer tu PIN en breve.
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => navigate('/login')}
        >
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', margin: '12vh auto', padding: '2.25rem' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: '1rem', marginBottom: '1.6rem' }}>
        <img src="/LogoNexocorp.png" alt="Nexocorp" style={{ height: '120px', width: 'auto' }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.55rem', marginBottom: '0.35rem', color: 'hsl(var(--color-text-primary))' }}>¿Olvidaste tu PIN?</h2>
          <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.92rem' }}>
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu PIN.
          </p>
        </div>
      </div>

      {error && <ErrorState error={error} />}

      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleSubmit}>
        <div>
          <label className="label">Correo electrónico</label>
          <input
            className="input-field"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={procesando}
            required
            autoFocus
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: '0.25rem' }}
          disabled={procesando || !email.trim()}
          type="submit"
        >
          {procesando ? 'Enviando...' : 'Enviar enlace de recuperación'}
        </button>

        <Link to="/login" className="btn btn-ghost btn-small" style={{ justifyContent: 'center' }}>
          Volver al inicio de sesión
        </Link>
      </form>
    </div>
  );
}
