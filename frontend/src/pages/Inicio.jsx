import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, Users, LayoutDashboard, History, Settings } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const ROLES = { administrador: 'Administrador', supervisor: 'Supervisor', evaluador: 'Evaluador' };

export default function Inicio() {
  const usuario = useAuthStore(state => state.usuario);
  const canManage = ['administrador', 'supervisor'].includes(usuario?.rol);
  const opciones = [
    { to: '/dashboard', icon: LayoutDashboard, titulo: 'Evaluaciones y resultados', texto: 'Consulta indicadores, gráficos y el historial de evaluaciones.' },
    ...(canManage ? [
      { to: '/trabajadores', icon: Users, titulo: 'Trabajadores', texto: 'Registra personal y actualiza sus datos y áreas de trabajo.' },
      { to: '/bitacora', icon: History, titulo: 'Bitácora', texto: 'Consulta las acciones realizadas y su registro de auditoría.' },
    ] : []),
    ...(usuario?.rol === 'administrador' ? [
      { to: '/usuarios', icon: Settings, titulo: 'Usuarios y áreas', texto: 'Administra las cuentas, los permisos y las áreas de trabajo.' },
    ] : []),
  ];

  return (
    <div className="home-page animate-fade-in">
      <header className="home-header">
        <div className="home-heading">
          <p className="home-eyebrow">CONTROL BPH · CEPROD</p>
          <h1 className="home-title">Bienvenido, {usuario?.nombre || 'usuario'}</h1>
          <p className="home-description">Realiza una evaluación o consulta la información de tu equipo.</p>
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
