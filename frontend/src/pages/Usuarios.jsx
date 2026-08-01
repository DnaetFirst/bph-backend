import { useEffect, useState, useMemo } from 'react';
import {
  Users, UserCheck, UserX, Edit,
  MapPin, Save, Plus, ChevronLeft, ChevronRight, Key,
  Search, X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useUiStore } from '../store/uiStore';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import Badge from '../components/ui/Badge';
import Tooltip from '../components/ui/Tooltip';

const ROLES = [
  { value: 'evaluador', label: 'Evaluador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'administrador', label: 'Administrador' },
];

export default function Usuarios() {
  const mostrarToast = useUiStore((state) => state.mostrarToast);

  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [mostrarFormUsuario, setMostrarFormUsuario] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [formDataUsuario, setFormDataUsuario] = useState({ nombre: '', rol: 'evaluador' });

  const [mostrarFormArea, setMostrarFormArea] = useState(false);
  const [editandoArea, setEditandoArea] = useState(null);
  const [formDataArea, setFormDataArea] = useState({ nombre: '' });

  const [procesando, setProcesando] = useState(false);

  const [mostrarModalPin, setMostrarModalPin] = useState(false);
  const [usuarioEditandoPin, setUsuarioEditandoPin] = useState(null);
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinNuevoConfirm, setPinNuevoConfirm] = useState('');
  const [pinError, setPinError] = useState('');

  const [searchUsuarios, setSearchUsuarios] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [paginaUsuarios, setPaginaUsuarios] = useState(1);
  const porPagina = 10;

  useEffect(() => {
    const handler = setTimeout(() => setSearchDebounced(searchUsuarios), 300);
    return () => clearTimeout(handler);
  }, [searchUsuarios]);

  useEffect(() => {
    setPaginaUsuarios(1);
  }, [searchDebounced]);

  const fetchUsuarios = async () => {
    setCargando(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/admin/usuarios', {
        headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      });
      setUsuarios(data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  };

  const fetchAreas = async () => {
    try {
      const { data } = await apiClient.get('/admin/areas', {
        headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      });
      setAreas(data || []);
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    }
  };

  const cargarTodo = () => { fetchUsuarios(); fetchAreas(); };

  useEffect(() => {
    cargarTodo();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    if (!searchDebounced) return usuarios;
    const lower = searchDebounced.toLowerCase();
    return usuarios.filter((u) =>
      u.nombre.toLowerCase().includes(lower) ||
      u.rol.toLowerCase().includes(lower)
    );
  }, [usuarios, searchDebounced]);

  const usuariosActivos = useMemo(
    () => usuariosFiltrados.filter((u) => u.activo),
    [usuariosFiltrados]
  );
  const usuariosInactivos = useMemo(
    () => usuariosFiltrados.filter((u) => !u.activo),
    [usuariosFiltrados]
  );

  const totalPaginas = Math.max(1, Math.ceil(usuariosActivos.length / porPagina));
  const activosPaginados = usuariosActivos.slice(
    (paginaUsuarios - 1) * porPagina,
    paginaUsuarios * porPagina
  );
  const inactivosPaginados = usuariosInactivos.slice(
    (paginaUsuarios - 1) * porPagina,
    paginaUsuarios * porPagina
  );

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      await apiClient.post('/admin/usuarios', formDataUsuario);
      await fetchUsuarios();
      mostrarToast({ tipo: 'success', titulo: 'Usuario creado', mensaje: `Usuario "${formDataUsuario.nombre}" creado. PIN por defecto: 000000` });
      setFormDataUsuario({ nombre: '', rol: 'evaluador' });
      setMostrarFormUsuario(false);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo crear', mensaje: err.response?.data?.error || 'Error al crear usuario' });
    } finally {
      setProcesando(false);
    }
  };

  const handleEditarUsuario = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      await apiClient.put(`/admin/usuarios/${editandoUsuario.id}`, {
        nombre: formDataUsuario.nombre,
        rol: formDataUsuario.rol,
      });
      await fetchUsuarios();
      mostrarToast({ tipo: 'success', titulo: 'Usuario actualizado', mensaje: `Usuario "${formDataUsuario.nombre}" actualizado.` });
      setEditandoUsuario(null);
      setFormDataUsuario({ nombre: '', rol: 'evaluador' });
      setMostrarFormUsuario(false);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo actualizar', mensaje: err.response?.data?.error || 'Error al actualizar usuario' });
    } finally {
      setProcesando(false);
    }
  };

  const validarPin = (pin) => {
    if (pin.length < 6) return 'El PIN debe tener al menos 6 caracteres.';
    if (!/\d/.test(pin)) return 'El PIN debe contener al menos un número.';
    return '';
  };

  const openModalPin = (u) => {
    setUsuarioEditandoPin(u);
    setPinNuevo('');
    setPinNuevoConfirm('');
    setPinError('');
    setMostrarModalPin(true);
  };

  const closeModalPin = () => {
    setMostrarModalPin(false);
    setUsuarioEditandoPin(null);
    setPinNuevo('');
    setPinNuevoConfirm('');
    setPinError('');
  };

  const handleCambiarPin = async (e) => {
    e.preventDefault();
    if (!usuarioEditandoPin) return;

    const err = validarPin(pinNuevo);
    if (err) {
      setPinError(err);
      return;
    }
    if (pinNuevo !== pinNuevoConfirm) {
      setPinError('Los PIN no coinciden.');
      return;
    }
    setPinError('');
    setProcesando(true);

    try {
      await apiClient.put(`/admin/usuarios/${usuarioEditandoPin.id}/reset-pin`, {
        pinNuevo: pinNuevo,
      });
      mostrarToast({ tipo: 'success', titulo: 'PIN actualizado', mensaje: `El PIN de "${usuarioEditandoPin.nombre}" fue actualizado.` });
      closeModalPin();
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo actualizar', mensaje: err.response?.data?.error || 'Error al actualizar PIN' });
    } finally {
      setProcesando(false);
    }
  };

  const handleDesactivarUsuario = async (id) => {
    if (!confirm('¿Desactivar este usuario?')) return;
    try {
      await apiClient.put(`/admin/usuarios/${id}`, { activo: false });
      await fetchUsuarios();
      mostrarToast({ tipo: 'success', titulo: 'Usuario desactivado', mensaje: 'El usuario fue desactivado correctamente.' });
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo desactivar', mensaje: err.response?.data?.error || 'Error al desactivar' });
    }
  };

  const handleActivarUsuario = async (id) => {
    try {
      await apiClient.put(`/admin/usuarios/${id}`, { activo: true });
      await fetchUsuarios();
      mostrarToast({ tipo: 'success', titulo: 'Usuario activado', mensaje: 'El usuario fue activado correctamente.' });
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo activar', mensaje: err.response?.data?.error || 'Error al activar' });
    }
  };

  const openEditarUsuario = (u) => {
    setEditandoUsuario(u);
    setFormDataUsuario({ nombre: u.nombre, rol: u.rol });
    setMostrarFormUsuario(true);
  };

  const openCrearUsuario = () => {
    setEditandoUsuario(null);
    setFormDataUsuario({ nombre: '', rol: 'evaluador' });
    setMostrarFormUsuario(true);
  };

  const cancelarUsuario = () => {
    setEditandoUsuario(null);
    setFormDataUsuario({ nombre: '', rol: 'evaluador' });
    setMostrarFormUsuario(false);
  };

  const handleCrearArea = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      await apiClient.post('/admin/areas', formDataArea);
      await fetchAreas();
      mostrarToast({ tipo: 'success', titulo: 'Área creada', mensaje: `Área "${formDataArea.nombre}" creada.` });
      setFormDataArea({ nombre: '' });
      setMostrarFormArea(false);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo crear', mensaje: err.response?.data?.error || 'Error al crear área' });
    } finally {
      setProcesando(false);
    }
  };

  const handleEditarArea = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      await apiClient.put(`/admin/areas/${editandoArea.id}`, formDataArea);
      await fetchAreas();
      mostrarToast({ tipo: 'success', titulo: 'Área actualizada', mensaje: `Área "${formDataArea.nombre}" actualizada.` });
      setEditandoArea(null);
      setFormDataArea({ nombre: '' });
      setMostrarFormArea(false);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo actualizar', mensaje: err.response?.data?.error || 'Error al actualizar área' });
    } finally {
      setProcesando(false);
    }
  };

  const openEditarArea = (a) => {
    setEditandoArea(a);
    setFormDataArea({ nombre: a.nombre });
    setMostrarFormArea(true);
  };

  const openCrearArea = () => {
    setEditandoArea(null);
    setFormDataArea({ nombre: '' });
    setMostrarFormArea(true);
  };

  const cancelarArea = () => {
    setEditandoArea(null);
    setFormDataArea({ nombre: '' });
    setMostrarFormArea(false);
  };

  return (
    <div className="animate-fade-in page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Gestión de usuarios y áreas</h1>
          <p className="page-subtitle">
            Administra cuentas de usuarios con sus roles (evaluador, supervisor, administrador) y define las áreas de trabajo.
          </p>
        </div>
      </header>

      {/* === SECCIÓN: CREAR / EDITAR USUARIO */}
      {mostrarFormUsuario && (
        <section className="section-card">
          <div className="section-card-body">
            <h2 className="section-title">{editandoUsuario ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            <p className="section-subtitle">
              {editandoUsuario ? 'Modifica los datos del usuario.' : 'Crea una nueva cuenta de acceso al sistema.'}
              {!editandoUsuario && (
                <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.8rem', color: 'hsl(var(--color-warning))' }}>
                  El PIN por defecto será 000000 y deberá cambiarse en el primer ingreso.
                </span>
              )}
            </p>

            <form onSubmit={editandoUsuario ? handleEditarUsuario : handleCrearUsuario}>
              <div className="form-grid-2" style={{ gap: '1rem' }}>
                <div>
                  <label className="label">Nombre de usuario</label>
                  <input
                    className="input-field"
                    type="text"
                    value={formDataUsuario.nombre}
                    onChange={(e) => setFormDataUsuario({ ...formDataUsuario, nombre: e.target.value.toUpperCase() })}
                    placeholder="Ingresa el nombre..."
                    required
                    disabled={procesando}
                  />
                </div>
                <div>
                  <label className="label">Rol</label>
                  <select
                    className="input-field"
                    value={formDataUsuario.rol}
                    onChange={(e) => setFormDataUsuario({ ...formDataUsuario, rol: e.target.value })}
                    required
                    disabled={procesando}
                  >
                    <option value="">Seleccionar rol...</option>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="action-group" style={{ marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" disabled={procesando}>
                  <Save size={18} />
                  {procesando ? 'Guardando...' : editandoUsuario ? 'Actualizar' : 'Crear'}
                </button>
                <button type="button" className="btn btn-outline" onClick={cancelarUsuario} disabled={procesando}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* === SECCIÓN: CREAR / EDITAR ÁREA */}
      {mostrarFormArea && (
        <section className="section-card">
          <div className="section-card-body">
            <h2 className="section-title">{editandoArea ? 'Editar área' : 'Nueva área'}</h2>
            <p className="section-subtitle">
              {editandoArea ? 'Modifica el nombre del área.' : 'Define un nuevo área de trabajo.'}
            </p>

            <form onSubmit={editandoArea ? handleEditarArea : handleCrearArea}>
              <div>
                <label className="label">Nombre del área</label>
                <input
                  className="input-field"
                  type="text"
                  value={formDataArea.nombre}
                  onChange={(e) => setFormDataArea({ nombre: e.target.value })}
                  placeholder="Ej: Cárnicos, MAP, Panificación..."
                  required
                  disabled={procesando}
                />
              </div>

              <div className="action-group" style={{ marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" disabled={procesando}>
                  <Save size={18} />
                  {procesando ? 'Guardando...' : editandoArea ? 'Actualizar' : 'Crear'}
                </button>
                <button type="button" className="btn btn-outline" onClick={cancelarArea} disabled={procesando}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* === TABLAS === */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Tabla de usuarios */}
        <section className="section-card">
          <div className="section-card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="section-title">Usuarios</h2>
              <button className="btn btn-primary btn-small" onClick={openCrearUsuario}>
                <Plus size={14} /> Nuevo usuario
              </button>
            </div>

            {error && <ErrorState error={error} onRetry={fetchUsuarios} />}

            <div style={{ position: 'relative', width: '100%', maxWidth: '320px', marginBottom: '1rem' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--color-text-secondary))' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Buscar por nombre o rol..."
                value={searchUsuarios}
                onChange={(e) => setSearchUsuarios(e.target.value)}
                style={{ paddingLeft: '2.5rem', width: '100%' }}
              />
            </div>

            {cargando ? (
              <LoadingState mensaje="Cargando usuarios..." />
            ) : usuariosActivos.length === 0 && usuariosInactivos.length === 0 ? (
              <EmptyState titulo="Sin usuarios" mensaje="No hay usuarios registrados." icono={Users} />
            ) : (
              <>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="th-nombre">Usuario</th>
                        <th className="th-area">Rol</th>
                        <th className="hide-mobile">Creado</th>
                        <th>Estado</th>
                        <th className="th-actions">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activosPaginados.map((u) => (
                        <tr key={u.id}>
                          <td className="td-nombre" style={{ fontWeight: 600 }}>{u.nombre}</td>
                          <td className="td-area">
                            <Badge variant={u.rol === 'administrador' ? 'info' : u.rol === 'supervisor' ? 'warning' : 'neutral'}>
                              {u.rol}
                            </Badge>
                          </td>
                          <td className="hide-mobile" style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.85rem' }}>
                            {new Date(u.creadoEn).toLocaleDateString('es-AR')}
                          </td>
                          <td>
                            <Badge variant="success">Activo</Badge>
                          </td>
                          <td className="td-actions">
                             <div className="btn-group-actions">
                               <Tooltip text="Editar usuario">
                                 <button className="btn-ghost btn-small" onClick={() => openEditarUsuario(u)} title="Editar">
                                   <Edit size={14} /> Editar
                                 </button>
                               </Tooltip>
                               <Tooltip text="Cambiar PIN del usuario">
                                 <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-warning))' }} onClick={() => openModalPin(u)} title="Cambiar PIN">
                                   <Key size={14} /> PIN
                                 </button>
                               </Tooltip>
                               <Tooltip text="Desactivar usuario">
                                 <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-danger))' }} onClick={() => handleDesactivarUsuario(u.id)} title="Desactivar" disabled={procesando}>
                                   <UserX size={14} /> Desactivar
                                 </button>
                               </Tooltip>
                             </div>
                          </td>
                        </tr>
                      ))}

                      {inactivosPaginados.map((u) => (
                        <tr key={u.id}>
                          <td className="td-nombre" style={{ fontWeight: 600, opacity: 0.75 }}>{u.nombre}</td>
                          <td className="td-area">
                            <Badge variant={u.rol === 'administrador' ? 'info' : u.rol === 'supervisor' ? 'warning' : 'neutral'}>
                              {u.rol}
                            </Badge>
                          </td>
                          <td className="hide-mobile" style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.85rem' }}>
                            {new Date(u.creadoEn).toLocaleDateString('es-AR')}
                          </td>
                          <td>
                            <Badge variant="danger">Inactivo</Badge>
                          </td>
                          <td className="td-actions">
                             <div className="btn-group-actions">
                               <Tooltip text="Activar usuario">
                                 <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-success))' }} onClick={() => handleActivarUsuario(u.id)} title="Activar" disabled={procesando}>
                                   <UserCheck size={14} /> Activar
                                 </button>
                               </Tooltip>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPaginas > 1 && (
                  <div className="pagination-footer">
                    <button className="btn btn-outline btn-small" disabled={paginaUsuarios <= 1} onClick={() => setPaginaUsuarios((p) => p - 1)}>
                      <ChevronLeft size={16} />
                    </button>
                    <span className="pagination-info">
                      Pág. {paginaUsuarios} de {totalPaginas}
                    </span>
                    <button className="btn btn-outline btn-small" disabled={paginaUsuarios >= totalPaginas} onClick={() => setPaginaUsuarios((p) => p + 1)}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Tabla de áreas */}
        <section className="section-card">
          <div className="section-card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="section-title">Áreas</h2>
              <button className="btn btn-primary btn-small" onClick={openCrearArea}>
                <Plus size={14} /> Nueva área
              </button>
            </div>

            {cargando ? (
              <LoadingState mensaje="Cargando áreas..." />
            ) : areas.length === 0 ? (
              <EmptyState titulo="Sin áreas" mensaje="No hay áreas registradas." icono={MapPin} />
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th className="th-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.nombre}</td>
                        <td className="td-actions">
                          <button className="btn-ghost btn-small" onClick={() => openEditarArea(a)} title="Editar">
                            <Edit size={14} /> Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </section>
        </div>

        {/* === MODAL: CAMBIAR PIN === */}
        {mostrarModalPin && usuarioEditandoPin && (
          <div className="modal-overlay" onClick={closeModalPin}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Cambiar PIN de "{usuarioEditandoPin.nombre}"</h3>
                <button type="button" className="btn-ghost btn-small" onClick={closeModalPin}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Ingresa un nuevo PIN de al menos 6 caracteres (debe contener números). El usuario deberá cambiarlo en su primer ingreso.
                </p>
                <form id="form-cambiar-pin" onSubmit={handleCambiarPin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="label">Nuevo PIN</label>
                    <input
                      className="input-field"
                      type="password"
                      placeholder="Mínimo 6 caracteres, con números..."
                      value={pinNuevo}
                      onChange={(e) => { setPinNuevo(e.target.value); setPinError(''); }}
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
                      placeholder="Repite el nuevo PIN..."
                      value={pinNuevoConfirm}
                      onChange={(e) => { setPinNuevoConfirm(e.target.value); setPinError(''); }}
                      disabled={procesando}
                      minLength={6}
                      required
                    />
                  </div>
                  {pinError && (
                    <div style={{ color: 'hsl(var(--color-danger))', fontSize: '0.8rem' }}>{pinError}</div>
                  )}
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-small" onClick={closeModalPin} disabled={procesando}>
                  Cancelar
                </button>
                <button type="submit" form="form-cambiar-pin" className="btn btn-primary btn-small" disabled={procesando || !pinNuevo || !pinNuevoConfirm}>
                  {procesando ? 'Guardando...' : 'Guardar PIN'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
