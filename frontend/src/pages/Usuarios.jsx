import { useEffect, useState, useMemo } from 'react';
import {
  Users, UserCheck, UserX, Edit,
  MapPin, Save, Plus, ChevronLeft, ChevronRight, Key,
  Search, X, ChevronDown, Trash2,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useUiStore } from '../store/uiStore';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import Badge from '../components/ui/Badge';

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
  const [formDataUsuario, setFormDataUsuario] = useState({ nombre: '', email: '', rol: 'evaluador', pin: '', pinConfirm: '' });

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
  const [dropdownOpenId, setDropdownOpenId] = useState(null);
  const porPagina = 10;

  useEffect(() => {
    const handler = setTimeout(() => setSearchDebounced(searchUsuarios), 300);
    return () => clearTimeout(handler);
  }, [searchUsuarios]);

  useEffect(() => {
    setPaginaUsuarios(1);
  }, [searchDebounced]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownOpenId && !e.target.closest('.dropdown-actions')) {
        setDropdownOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpenId]);

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
      console.error('Error al cargar areas:', err);
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
      (u.email || '').toLowerCase().includes(lower) ||
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
      const err = validarPin(formDataUsuario.pin);
      if (err) {
        mostrarToast({ tipo: 'error', titulo: 'PIN invalido', mensaje: err });
        setProcesando(false);
        return;
      }
      if (formDataUsuario.pin && formDataUsuario.pin !== formDataUsuario.pinConfirm) {
        mostrarToast({ tipo: 'error', titulo: 'PIN invalido', mensaje: 'Los PIN no coinciden.' });
        setProcesando(false);
        return;
      }

      await apiClient.post('/admin/usuarios', {
        nombre: formDataUsuario.nombre,
        email: formDataUsuario.email,
        rol: formDataUsuario.rol,
        pin: formDataUsuario.pin || undefined,
      });
      await fetchUsuarios();
      const pinMsg = formDataUsuario.pin ? ' con PIN personalizado' : ' con PIN por defecto: 000000';
      mostrarToast({ tipo: 'success', titulo: 'Usuario creado', mensaje: ' Usuario "' + formDataUsuario.nombre + '" creado' + pinMsg + '.' });
      setFormDataUsuario({ nombre: '', email: '', rol: 'evaluador', pin: '', pinConfirm: '' });
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
      await apiClient.put('/admin/usuarios/' + editandoUsuario.id, {
        nombre: formDataUsuario.nombre,
        email: formDataUsuario.email,
        rol: formDataUsuario.rol,
      });
      await fetchUsuarios();
      mostrarToast({ tipo: 'success', titulo: 'Usuario actualizado', mensaje: 'Usuario "' + formDataUsuario.nombre + '" actualizado.' });
      setEditandoUsuario(null);
      setFormDataUsuario({ nombre: '', email: '', rol: 'evaluador', pin: '', pinConfirm: '' });
      setMostrarFormUsuario(false);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo actualizar', mensaje: err.response?.data?.error || 'Error al actualizar usuario' });
    } finally {
      setProcesando(false);
    }
  };

  const validarPin = (pin) => {
    if (pin.length < 6) return 'El PIN debe tener al menos 6 caracteres.';
    if (!/[0-9]/.test(pin)) return 'El PIN debe contener al menos un numero.';
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
      await apiClient.put('/admin/usuarios/' + usuarioEditandoPin.id + '/reset-pin', {
        pinNuevo: pinNuevo,
      });
      mostrarToast({ tipo: 'success', titulo: 'PIN actualizado', mensaje: 'El PIN de "' + usuarioEditandoPin.nombre + '" fue actualizado.' });
      closeModalPin();
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo actualizar', mensaje: err.response?.data?.error || 'Error al actualizar PIN' });
    } finally {
      setProcesando(false);
    }
  };

  const handleDesactivarUsuario = async (id) => {
    if (!confirm('Desactivar este usuario?')) return;
    try {
      await apiClient.put('/admin/usuarios/' + id, { activo: false });
      await fetchUsuarios();
      mostrarToast({ tipo: 'success', titulo: 'Usuario desactivado', mensaje: 'El usuario fue desactivado correctamente.' });
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo desactivar', mensaje: err.response?.data?.error || 'Error al desactivar' });
    }
  };

  const handleActivarUsuario = async (id) => {
    try {
      await apiClient.put('/admin/usuarios/' + id, { activo: true });
      await fetchUsuarios();
      mostrarToast({ tipo: 'success', titulo: 'Usuario activado', mensaje: 'El usuario fue activado correctamente.' });
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo activar', mensaje: err.response?.data?.error || 'Error al activar' });
    }
  };

  const handleEliminarUsuario = async (u) => {
    if (confirm('Seguro que deseas desactivar al usuario ' + u.nombre + '? (soft delete)')) {
      try {
        await apiClient.delete('/admin/usuarios/' + u.id);
        await fetchUsuarios();
        mostrarToast({ tipo: 'success', titulo: 'Usuario desactivado', mensaje: 'Usuario "' + u.nombre + '" desactivado (soft delete).' });
      } catch (err) {
        mostrarToast({ tipo: 'error', titulo: 'No se pudo desactivar', mensaje: err.response?.data?.error || 'Error al desactivar usuario' });
      }
    }
  };

  const openEditarUsuario = (u) => {
    setEditandoUsuario(u);
    setFormDataUsuario({ nombre: u.nombre, email: u.email || '', rol: u.rol });
    setMostrarFormUsuario(true);
  };

  const openCrearUsuario = () => {
    setEditandoUsuario(null);
    setFormDataUsuario({ nombre: '', email: '', rol: 'evaluador', pin: '', pinConfirm: '' });
    setMostrarFormUsuario(true);
  };

  const cancelarUsuario = () => {
    setEditandoUsuario(null);
    setFormDataUsuario({ nombre: '', email: '', rol: 'evaluador', pin: '', pinConfirm: '' });
    setMostrarFormUsuario(false);
  };

  const handleCrearArea = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      await apiClient.post('/admin/areas', formDataArea);
      await fetchAreas();
      mostrarToast({ tipo: 'success', titulo: 'Area creada', mensaje: 'Area "' + formDataArea.nombre + '" creada.' });
      setFormDataArea({ nombre: '' });
      setMostrarFormArea(false);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo crear', mensaje: err.response?.data?.error || 'Error al crear area' });
    } finally {
      setProcesando(false);
    }
  };

  const handleEditarArea = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      await apiClient.put('/admin/areas/' + editandoArea.id, formDataArea);
      await fetchAreas();
      mostrarToast({ tipo: 'success', titulo: 'Area actualizada', mensaje: 'Area "' + formDataArea.nombre + '" actualizada.' });
      setEditandoArea(null);
      setFormDataArea({ nombre: '' });
      setMostrarFormArea(false);
    } catch (err) {
      mostrarToast({ tipo: 'error', titulo: 'No se pudo actualizar', mensaje: err.response?.data?.error || 'Error al actualizar area' });
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

  const renderUserActions = (u, isActive) => (
    <td className="td-actions">
      <div className="dropdown-actions">
        <button
          type="button"
          className="dropdown-trigger btn-ghost btn-small"
          onClick={(e) => { e.stopPropagation(); setDropdownOpenId(dropdownOpenId === u.id ? null : u.id); }}
        >
          <ChevronDown size={14} />
        </button>
        {dropdownOpenId === u.id && (
          <div className="dropdown-menu-actions" onClick={(e) => e.stopPropagation()}>
            <button className="btn-ghost btn-small" onClick={() => { setDropdownOpenId(null); openEditarUsuario(u); }}>
              <Edit size={14} /> Editar
            </button>
            {isActive ? (
              <>
                <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-warning))' }} onClick={() => { setDropdownOpenId(null); openModalPin(u); }}>
                  <Key size={14} /> Cambiar PIN
                </button>
                <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-danger))' }} onClick={() => { setDropdownOpenId(null); handleDesactivarUsuario(u.id); }}>
                  <UserX size={14} /> Desactivar
                </button>
              </>
            ) : (
              <>
                <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-success))' }} onClick={() => { setDropdownOpenId(null); handleActivarUsuario(u.id); }}>
                  <UserCheck size={14} /> Activar
                </button>
                <button className="btn-ghost btn-small" style={{ color: 'hsl(var(--color-danger))' }} onClick={() => { setDropdownOpenId(null); handleEliminarUsuario(u); }}>
                  <Trash2 size={14} /> Eliminar
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </td>
  );

  return (
    <div className="animate-fade-in page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Gesti�n de Usuarios</h1>
          <p className="page-subtitle">
            Administra cuentas de usuarios con sus roles (evaluador, supervisor, administrador) y define las �reas de trabajo.
          </p>
        </div>
      </header>

      {mostrarFormUsuario && (
        <section className="section-card">
          <div className="section-card-body">
            <h2 className="section-title">{editandoUsuario ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            <p className="section-subtitle">
              {editandoUsuario ? 'Modifica los datos del usuario.' : 'Crea una nueva cuenta de acceso al sistema.'}
              {!editandoUsuario && (
                <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.8rem', color: 'hsl(var(--color-warning))' }}>
                  El PIN por defecto sera 000000 y debera cambiarse en el primer ingreso.
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
                  <label className="label">Correo electronico</label>
                  <input
                    className="input-field"
                    type="email"
                    value={formDataUsuario.email}
                    onChange={(e) => setFormDataUsuario({ ...formDataUsuario, email: e.target.value.toLowerCase() })}
                    placeholder="usuario@ejemplo.com"
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

              {!editandoUsuario && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="label">PIN inicial (opcional)</label>
                    <p style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '0.25rem' }}>
                      Minimo 6 caracteres, con al menos un numero. Si lo dejas vacio, se usara 000000.
                    </p>
                    <input
                      className="input-field"
                      type="password"
                      placeholder="Ej: 123456"
                      value={formDataUsuario.pin}
                      onChange={(e) => setFormDataUsuario({ ...formDataUsuario, pin: e.target.value })}
                      disabled={procesando}
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="label">Confirmar PIN</label>
                    <input
                      className="input-field"
                      type="password"
                      placeholder="Repite el PIN..."
                      value={formDataUsuario.pinConfirm}
                      onChange={(e) => setFormDataUsuario({ ...formDataUsuario, pinConfirm: e.target.value })}
                      disabled={procesando}
                      minLength={6}
                    />
                  </div>
                </div>
              )}

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

      {mostrarFormArea && (
        <section className="section-card">
          <div className="section-card-body">
            <h2 className="section-title">{editandoArea ? 'Editar area' : 'Nueva area'}</h2>
            <p className="section-subtitle">
              {editandoArea ? 'Modifica el nombre del area.' : 'Define un nuevo area de trabajo.'}
            </p>

            <form onSubmit={editandoArea ? handleEditarArea : handleCrearArea}>
              <div>
                <label className="label">Nombre del area</label>
                <input
                  className="input-field"
                  type="text"
                  value={formDataArea.nombre}
                  onChange={(e) => setFormDataArea({ nombre: e.target.value })}
                  placeholder="Ej: Carnicos, MAP, Panificacion..."
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

      <div className="tables-grid">
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
                placeholder="Buscar por nombre, email o rol..."
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
                        <th className="th-email">Email</th>
                        <th>Rol</th>
                        <th className="hide-mobile">Creado</th>
                        <th>Estado</th>
                        <th className="th-actions">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activosPaginados.map((u) => (
                        <tr key={u.id}>
                          <td className="td-nombre" style={{ fontWeight: 600 }}>{u.nombre}</td>
                          <td className="td-email" style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.85rem' }}>{u.email}</td>
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
                          {renderUserActions(u, true)}
                        </tr>
                      ))}

                      {inactivosPaginados.map((u) => (
                        <tr key={u.id}>
                          <td className="td-nombre" style={{ fontWeight: 600, opacity: 0.75 }}>{u.nombre}</td>
                          <td className="td-email" style={{ color: 'hsl(var(--color-text-secondary))', fontSize: '0.85rem' }}>{u.email}</td>
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
                          {renderUserActions(u, false)}
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
                      Pag. {paginaUsuarios} de {totalPaginas}
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

        <section className="section-card">
          <div className="section-card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="section-title">Areas</h2>
              <button className="btn btn-primary btn-small" onClick={openCrearArea}>
                <Plus size={14} /> Nueva area
              </button>
            </div>

            {cargando ? (
              <LoadingState mensaje="Cargando areas..." />
            ) : areas.length === 0 ? (
              <EmptyState titulo="Sin areas" mensaje="No hay areas registradas." icono={MapPin} />
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
                Ingresa un nuevo PIN de al menos 6 caracteres (debe contener numeros).
              </p>
              <form id="form-cambiar-pin" onSubmit={handleCambiarPin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="label">Nuevo PIN</label>
                  <input
                    className="input-field"
                    type="password"
                    placeholder="Minimo 6 caracteres, con numeros..."
                    value={pinNuevo}
                    onChange={(e) => { setPinNuevo(e.target.value); setPinError(''); }}
                    disabled={procesando}
                    minLength={6}
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
