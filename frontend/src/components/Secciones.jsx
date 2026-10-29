import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function Secciones() {
  const {pathname,search}=useLocation(), usuario=useAuthStore(s=>s.usuario);
  useEffect(()=>{if(usuario && ['/analytics/bajas','/analytics/evaluaciones'].includes(pathname)) { try { sessionStorage.setItem(`consulta:${usuario.id}:${pathname}`,search); } catch { /* almacenamiento no disponible */ } }},[pathname,search,usuario]);
  const [bajas,setBajas]=useState(null);
  useEffect(()=>{let vigente=true;setBajas(null);if(usuario)apiClient.get('/bajas/sesion').then(({data})=>vigente&&setBajas(data)).catch(()=>{});return()=>{vigente=false;};},[usuario,pathname]);
  const admin=pathname.startsWith('/administracion'), analytics=pathname.startsWith('/analytics'), auditoria=pathname.startsWith('/auditoria');
  if(!usuario||(!admin&&!analytics&&!auditoria))return null;
  const gestor=['administrador','supervisor'].includes(usuario.rol), esAdmin=usuario.rol==='administrador';
  const links=auditoria ? (gestor ? [['/auditoria/bph','BPH','Acciones sobre evaluaciones, personal y configuración.'],...(bajas?.gestionar?[['/auditoria/bajas','Bajas','Registros, catálogos y cambios auditados.']]:[])] : []) : admin ? [
    ...(gestor&&bajas?.gestionar?[['/administracion/catalogos-bajas','Catálogos de bajas','Categorías, productos y opciones de registro.']]:[]),
    ...(gestor?[['/administracion/trabajadores','Trabajadores','Personal y asignación de áreas.']]:[]),
    ...(esAdmin?[['/administracion/areas','Áreas','Áreas de trabajo de BPH.'],['/administracion/usuarios','Usuarios','Cuentas y roles.'],['/administracion/accesos','Accesos a módulos','Habilitación individual de Bajas.']]:[]),
  ] : [['/analytics/evaluaciones','Evaluaciones BPH','Indicadores, historial y resultados de evaluaciones.'],...(bajas?.acceso?[['/analytics/bajas','Bajas de productos','Indicadores, historial y exportaciones de bajas.']]:[])];
  const raiz=pathname===(admin?'/administracion':auditoria?'/auditoria':'/analytics');
  const destino=to=>{try{return to + (to.startsWith('/analytics/') ? sessionStorage.getItem(`consulta:${usuario.id}:${to}`) || '' : '');}catch{return to;}};
  return <section className="section-navigation">
    {raiz ? <><h1 className="page-title">{admin?'Administración':auditoria?'Auditoría':'Analytics'}</h1><p>{admin?'Selecciona qué deseas gestionar.':'Selecciona el módulo que deseas consultar.'}</p><div className="home-grid">{links.map(([to,label,desc])=><Link className="home-card" key={to} to={destino(to)}><span><strong>{label}</strong><p>{desc}</p></span></Link>)}</div></> : <nav className="section-tabs" aria-label={admin?'Administración':auditoria?'Auditoría':'Analytics'}>{links.map(([to,label])=><NavLink key={to} to={destino(to)}>{label}</NavLink>)}</nav>}
  </section>;
}
