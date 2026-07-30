import { create } from 'zustand';
import { apiClient } from '../api/client';
import { shallow } from 'zustand/shallow';

export const useTrabajadoresStore = create((set, get) => ({
  trabajadores: [],
  areas: [],
  cargando: false,
  error: null,

  fetchTrabajadores: async () => {
    console.log('[DEBUG STORE] fetchTrabajadores iniciado');
    set({ cargando: true, error: null });
    try {
      // Obtener todos los trabajadores (activos e inactivos)
      // Agregamos timestamp para evitar caché de Cloudflare Workers
      const timestamp = Date.now();
      const url = `/trabajadores?activos=false&_t=${timestamp}`;
      console.log('[DEBUG STORE] URL con timestamp:', url);
      const { data } = await apiClient.get(url);
      console.log('[DEBUG STORE] fetchTrabajadores recibió datos:', data.trabajadores);
      console.log('[DEBUG STORE] Total trabajadores:', data.trabajadores.length);
      console.log('[DEBUG STORE] Trabajadores activos:', data.trabajadores.filter(t => t.activo).length);
      console.log('[DEBUG STORE] Trabajadores inactivos:', data.trabajadores.filter(t => !t.activo).length);
      console.log('[DEBUG STORE] Referencia del array recibido:', data.trabajadores === get().trabajadores);
      console.log('[DEBUG STORE] Actualizando estado de trabajadores');
      set({ trabajadores: data.trabajadores, cargando: false });
      console.log('[DEBUG STORE] Estado actualizado, verificando...');
      const estadoActual = get().trabajadores;
      console.log('[DEBUG STORE] Estado después de actualizar:', estadoActual.length, 'trabajadores');
      console.log('[DEBUG STORE] Activos en estado:', estadoActual.filter(t => t.activo).length);
      console.log('[DEBUG STORE] Inactivos en estado:', estadoActual.filter(t => !t.activo).length);
      console.log('[DEBUG STORE] Referencia del array actualizado:', estadoActual === data.trabajadores);
    } catch (err) {
      console.error('[DEBUG STORE] Error en fetchTrabajadores:', err);
      set({ 
        error: err.response?.data?.error || 'Error al cargar trabajadores', 
        cargando: false 
      });
    }
  },

  fetchAreas: async () => {
    try {
      const { data } = await apiClient.get('/areas');
      set({ areas: data });
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    }
  },

  crearTrabajador: async (datos) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.post('/trabajadores', datos);
      // Refrescar la lista completa desde el servidor para asegurar sincronización
      await get().fetchTrabajadores();
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Error al crear trabajador'
      });
      throw err;
    } finally {
      set({ cargando: false });
    }
  },

  actualizarTrabajador: async (id, datos) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.put(`/trabajadores/${id}`, datos);
      // Refrescar la lista completa desde el servidor para asegurar sincronización
      await get().fetchTrabajadores();
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Error al actualizar trabajador'
      });
      throw err;
    } finally {
      set({ cargando: false });
    }
  },

  desactivarTrabajador: async (id) => {
    console.log('[DEBUG STORE] Iniciando desactivarTrabajador, id:', id);
    set({ cargando: true, error: null });
    try {
      console.log('[DEBUG STORE] Enviando PATCH a /trabajadores/${id}/desactivar');
      const patchResponse = await apiClient.patch(`/trabajadores/${id}/desactivar`);
      console.log('[DEBUG STORE] PATCH exitoso, respuesta:', patchResponse.data);
      
      console.log('[DEBUG STORE] Iniciando fetchTrabajadores para refrescar');
      await get().fetchTrabajadores();
      console.log('[DEBUG STORE] fetchTrabajadores completado');
    } catch (err) {
      console.error('[DEBUG STORE] Error en desactivarTrabajador:', err);
      console.error('[DEBUG STORE] Error response:', err.response);
      console.error('[DEBUG STORE] Error message:', err.message);
      set({ 
        error: err.response?.data?.error || 'Error al desactivar trabajador'
      });
      throw err;
    } finally {
      console.log('[DEBUG STORE] Finally block, reseteando cargando');
      set({ cargando: false });
    }
  },

  activarTrabajador: async (id) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.patch(`/trabajadores/${id}/activar`);
      // Refrescar la lista completa desde el servidor para asegurar sincronización
      await get().fetchTrabajadores();
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Error al activar trabajador'
      });
      throw err;
    } finally {
      set({ cargando: false });
    }
  },

  eliminarTrabajador: async (id) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.delete(`/trabajadores/${id}`);
      // Refrescar la lista completa desde el servidor para asegurar sincronización
      await get().fetchTrabajadores();
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Error al eliminar trabajador'
      });
      throw err;
    } finally {
      set({ cargando: false });
    }
  },

  obtenerTrabajadoresActivos: () => {
    return get().trabajadores.filter(t => t.activo);
  },

  obtenerTrabajadoresPorArea: (areaId) => {
    return get().trabajadores.filter(t => t.areaId === areaId && t.activo);
  },
}));
