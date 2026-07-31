import { create } from 'zustand';
import { apiClient } from '../api/client.js';
import { useUiStore } from './uiStore.js';

export const useAuthStore = create((set) => ({
  usuario: null,
  cargando: true,
  error: null,
  sesionExpirada: false,

  limpiarSesion: (sesionExpirada = true) => {
    localStorage.removeItem('auth_token');
    set({ usuario: null, cargando: false, error: null, sesionExpirada });
  },

  resetearSesionExpirada: () => set({ sesionExpirada: false }),

  verificarSesion: async () => {
    set({ cargando: true, error: null });
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ usuario: null, cargando: false, sesionExpirada: false });
      return;
    }

    try {
      const { data } = await apiClient.get('/auth/me', {
        headers: {
          'X-Silent-Auth-Check': 'true',
        },
      });
      set({ usuario: data.usuario, cargando: false, sesionExpirada: false });
    } catch {
      localStorage.removeItem('auth_token');
      set({ usuario: null, cargando: false, sesionExpirada: true });
    }
  },

  login: async (nombre, pin) => {
    set({ cargando: true, error: null, sesionExpirada: false });
    try {
      const { data } = await apiClient.post('/auth/login', { nombre, pin });
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      set({ usuario: data.usuario, cargando: false, sesionExpirada: false });
      useUiStore.getState().mostrarToast({ tipo: 'success', titulo: 'Sesión iniciada', mensaje: `Bienvenido, ${data.usuario.nombre}. Ya puedes continuar con tus operaciones.` });
      return data.usuario;
    } catch (err) {
      set({
        error: err.response?.data?.error || 'Error de conexión',
        cargando: false,
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('auth_token');
      set({ usuario: null, cargando: false, error: null, sesionExpirada: false });
      useUiStore.getState().mostrarToast({ tipo: 'info', titulo: 'Sesión cerrada', mensaje: 'Tu sesión se cerró correctamente.' });
    }
  }
}));
