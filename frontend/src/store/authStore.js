import { create } from 'zustand';
import { apiClient } from '../api/client.js';

export const useAuthStore = create((set, get) => ({
  usuario: null,
  cargando: true,
  error: null,

  // Verifica si el usuario ya está logueado al cargar la app
  verificarSesion: async () => {
    set({ cargando: true, error: null });
    try {
      const { data } = await apiClient.get('/auth/me');
      set({ usuario: data.usuario, cargando: false });
    } catch (err) {
      set({ usuario: null, cargando: false });
    }
  },

  login: async (nombre, pin) => {
    set({ cargando: true, error: null });
    try {
      const { data } = await apiClient.post('/auth/login', { nombre, pin });
      // Guardar token en localStorage como fallback para cuando las cookies no funcionen
      // Nota: El backend no devuelve el token en la respuesta, pero las cookies deberían funcionar
      // Este es un sistema híbrico para manejar problemas de cookies entre subdominios
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      set({ usuario: data.usuario, cargando: false });
      return data.usuario;
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Error de conexión', 
        cargando: false 
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('auth_token');
      set({ usuario: null });
    }
  }
}));
