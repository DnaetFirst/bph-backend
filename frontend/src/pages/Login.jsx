import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import ErrorState from '../components/ui/ErrorState';
import { apiClient } from '../api/client';

const validarPin = (pin) => {
  if (pin.length < 6) return 'El PIN debe tener al menos 6 caracteres.';
  if (!/\d/.test(pin)) return 'El PIN debe contener al menos un número.';
  return '';
};

export default function Login() {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const { login, cargando, error } = useAuthStore();
  const [localError, setLocalError] = useState('');

  const [modoRecuperacion, setModoRecuperacion] = useState(false);
  const [recNombre, setRecNombre] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recPin, setRecPin] = useState('');
  const [recPinConfirm, setRecPinConfirm] = useState('');
  const [recError, setRecError] = useState('');
  const [recProcesando, setRecProcesando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!nombre.trim() || !pin.trim()) {
      setLocalError('Por favor, ingresa tu usuario y PIN.');
      return;
    }

    try {
      await login(nombre, pin);
    } catch {
      // Error global manejado en store
    }
  };

  const handleRecuperarPin = async (e) => {
    e.preventDefault();
    setRecError('');

    const err = validarPin(recPin);
    if (err) {
      setRecError(err);
      return;
    }
    if (recPin !== recPinConfirm) {
      setRecError('Los PIN no coinciden.');
      return;
    }
    if (!recNombre.trim()) {
      setRecError('Ingresa tu nombre de usuario.');
      return;
    }
    if (!recEmail.trim()) {
      setRecError('Ingresa tu correo electrónico.');
      return;
    }

    setRecProcesando(true);
    try {
      await apiClient.post('/auth/recuperar-pin', {
        nombre: recNombre.toUpperCase(),
        email: recEmail,
        pinNuevo: recPin,
      });
      setRecNombre('');
      setRecEmail('');
      setRecPin('');
      setRecPinConfirm('');
      setRecError('');
      setModoRecuperacion(false);
      setLocalError('');
      setNombre(recNombre.toUpperCase());
      alert('PIN restablecido correctamente. Ahora puedes iniciar sesión con el nuevo PIN.');
    } catch (err) {
      setRecError(err.response?.data?.error || 'Error al restablecer el PIN.');
    } finally {
      setRecProcesando(false);
    }
  };

  if (modoRecuperacion) {
    return (
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', margin: '12vh auto', padding: '2.25rem' }}>
        <div style={{ display: 'grid', justifyItems: 'center', gap: '1rem', marginBottom: '1.6rem' }}>
          <img src="/LogoNexocorp.png" alt="Nexocorp" style={{ height: '120px', width: 'auto' }} />
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.55rem', marginBottom: '0.35rem', color: 'hsl(var(--color-text-primary))' }}>Recuperar PIN</h2>
            <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.92rem' }}>
              Ingresa tu usuario, correo y un nuevo PIN para recuperar el acceso.
            </p>
          </div>
        </div>

        {recError && <ErrorState error={recError} />}

        <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleRecuperarPin}>
          <div>
            <label className="label">Usuario</label>
            <input
              className="input-field"
              type="text"
              placeholder="Ingresa tu usuario..."
              value={recNombre}
              onChange={(e) => setRecNombre(e.target.value.toUpperCase())}
              disabled={recProcesando}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Correo electrónico</label>
            <input
              className="input-field"
              type="email"
              placeholder="tu@email.com"
              value={recEmail}
              onChange={(e) => setRecEmail(e.target.value)}
              disabled={recProcesando}
              required
            />
          </div>
          <div>
            <label className="label">Nuevo PIN (mínimo 6 caracteres, con números)</label>
            <input
              className="input-field"
              type="password"
              placeholder="Nuevo PIN..."
              value={recPin}
              onChange={(e) => { setRecPin(e.target.value); setRecError(''); }}
              disabled={recProcesando}
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="label">Confirmar nuevo PIN</label>
            <input
              className="input-field"
              type="password"
              placeholder="Confirma el nuevo PIN..."
              value={recPinConfirm}
              onChange={(e) => { setRecPinConfirm(e.target.value); setRecError(''); }}
              disabled={recProcesando}
              minLength={6}
              required
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: '0.25rem' }}
            disabled={recProcesando || !recNombre || !recEmail || !recPin || !recPinConfirm}
            type="submit"
          >
            {recProcesando ? 'Procesando...' : 'Restablecer PIN'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            style={{ justifyContent: 'center' }}
            onClick={() => { setModoRecuperacion(false); setRecError(''); setRecNombre(''); setRecEmail(''); setRecPin(''); setRecPinConfirm(''); }}
            disabled={recProcesando}
          >
            Volver al inicio de sesión
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', margin: '12vh auto', padding: '2.25rem' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: '1rem', marginBottom: '1.6rem' }}>
        <img src="/LogoNexocorp.png" alt="Nexocorp" style={{ height: '120px', width: 'auto' }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.55rem', marginBottom: '0.35rem', color: 'hsl(var(--color-text-primary))' }}>Iniciar sesión</h2>
          <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.92rem' }}>
            Accede al sistema de control BPH con tu cuenta corporativa.
          </p>
        </div>
      </div>

      {(error || localError) && (
        <ErrorState error={error || localError} />
      )}

      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleSubmit}>
        <div>
          <label className="label">Usuario</label>
          <input
            className="input-field"
            type="text"
            placeholder="Ingresa tu usuario..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value.toUpperCase())}
            disabled={cargando}
            autoFocus
          />
        </div>
        <div>
          <label className="label">PIN</label>
          <input
            className="input-field"
            type="password"
            placeholder="Ingresa tu PIN..."
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={cargando}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: '0.25rem' }}
          disabled={cargando}
          type="submit"
        >
          {cargando ? 'Comprobando...' : 'Ingresar'}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-small"
          style={{ justifyContent: 'center', marginTop: '-0.25rem' }}
          onClick={() => setModoRecuperacion(true)}
          disabled={cargando}
        >
          ¿Olvidaste tu PIN?
        </button>
      </form>
    </div>
  );
}
