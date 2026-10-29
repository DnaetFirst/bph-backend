import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { ArrowRight, ClipboardList, LayoutDashboard, History, Settings } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const ROLES = { administrador: 'Administrador', supervisor: 'Supervisor', evaluador: 'Evaluador' };

export default function Inicio() {
  const usuario = useAuthStore(state => state.usuario);
  const [accesoBajas, setAccesoBajas] = useState(false);
  useEffect(() => {
    let vigente = true;
    setAccesoBajas(false);
    apiClient.get('/bajas/sesion').then(({ data }) => vigente && setAccesoBajas(data.acceso)).catch(() => {});
    return () => { vigente = false; };
  }, [usuario]);
  const canManage = ['administrador', 'supervisor'].includes(usuario?.rol);
  const opciones = [
    ...(accesoBajas ? [{ to: '/bajas', icon: ClipboardList, titulo: 'Registrar baja', texto: 'Selecciona una categoría y registra la baja de productos.' }] : []),
    { to: '/analytics', icon: LayoutDashboard, titulo: 'Analytics', texto: 'Consulta evaluaciones BPH o bajas en sus secciones independientes.' },
    ...(canManage ? [
      { to: '/administracion', icon: Settings, titulo: 'Administración', texto: 'Gestiona catálogos, personal y configuración según tus permisos.' },
      { to: '/auditoria', icon: History, titulo: 'Auditoría', texto: 'Consulta las acciones realizadas en cada módulo.' },
    ] : []),
  ];

  return (
    <div className="home-page animate-fade-in">
      <header className="home-header">
        <div className="home-heading">
          <p className="home-eyebrow">CEPROD</p>
          <h1 className="home-title">Bienvenido, {usuario?.nombre || 'usuario'}</h1>
          <p className="home-description">Registra operaciones, consulta resultados o administra la información.</p>
        </div>
        <span className="home-role">{ROLES[usuario?.rol] || usuario?.rol}</span>
      </header>

      <Link to="/evaluar" className="home-primary">
        <span className="home-primary-icon"><ClipboardList size={28} aria-hidden="true" /></span>
        <span className="home-primary-copy">
          <span className="home-primary-title">Nueva evaluación BPH</span>
          <span className="home-primary-description">Revisa los criterios de higiene y uniforme de un trabajador.</span>
        </span>
        <span className="home-primary-action">Comenzar <ArrowRight size={18} aria-hidden="true" /></span>
      </Link>

      <section className="home-section" aria-labelledby="home-access-title">
        <div className="home-section-heading">
          <h2 id="home-access-title">Accesos rápidos</h2>
          <p>Selecciona la sección que necesitas.</p>
        </div>
        <div className={`home-grid home-grid--${opciones.length}`}>
          {opciones.map(({ to, icon: Icon, titulo, texto }) => (
            <Link key={to} to={to} className="home-card">
              <span className="home-card-icon"><Icon size={23} aria-hidden="true" /></span>
              <span className="home-card-copy">
                <span className="home-card-title">{titulo}</span>
                <span className="home-card-description">{texto}</span>
              </span>
              <ArrowRight size={19} className="home-card-arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
