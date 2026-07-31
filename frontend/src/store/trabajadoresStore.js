import { create } from 'zustand';
import { apiClient } from '../api/client';
import { useUiStore } from './uiStore';

export const useTrabajadoresStore = create((set, get) => ({
  trabajadores: [],
  areas: [],
  cargando: false,
  error: null,

  fetchTrabajadores: async () => {
    set({ cargando: true, error: null });
    try {
      const { data } = await apiClient.get('/trabajadores', {
        params: { activos: false, t: Date.now() },
        headers: {
          'Cache-Control': 'no-store, no-cache, max-age=0',
          Pragma: 'no-cache',
        },
      });
      set({ trabajadores: data.trabajadores, error: null, cargando: false });
    } catch (err) {
      console.error('Error al cargar trabajadores:', err);
      if (err.response?.status === 401) {
        set({ cargando: false, trabajadores: [], error: null });
        throw err;
      }
      set({ 
        error: err.response?.data?.error || 'Error al cargar trabajadores', 
        trabajadores: [],
        cargando: false 
      });
    }
  },

  fetchAreas: async () => {
    try {
      const { data } = await apiClient.get('/areas');
      set({ areas: data, error: null });
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    }
  },

  crearTrabajador: async (datos) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.post('/trabajadores', datos);
      await get().fetchTrabajadores();
      useUiStore.getState().mostrarToast({ tipo: 'success', titulo: 'Trabajador creado', mensaje: 'El trabajador se registró correctamente y la lista ya fue actualizada.' });
    } catch (err) {
      if (err.response?.status !== 401) {
        set({ error: err.response?.data?.error || 'Error al crear trabajador' });
      }
      throw err;
    } finally {
      set({ cargando: false });
    }
  },

  actualizarTrabajador: async (id, datos) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.put(`/trabajadores/${id}`, datos);
      await get().fetchTrabajadores();
      useUiStore.getState().mostrarToast({ tipo: 'success', titulo: 'Cambios guardados', mensaje: 'Los datos del trabajador se actualizaron correctamente.' });
    } catch (err) {
      if (err.response?.status !== 401) {
        set({ error: err.response?.data?.error || 'Error al actualizar trabajador' });
      }
      throw err;
    } finally {
      set({ cargando: false });
    }
  },

  desactivarTrabajador: async (id) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.patch(`/trabajadores/${id}/desactivar`);
      await get().fetchTrabajadores();
      useUiStore.getState().mostrarToast({ tipo: 'success', titulo: 'Trabajador desactivado', mensaje: 'El trabajador fue desactivado y ya aparece en la lista de inactivos.' });
    } catch (err) {
      console.error('Error al desactivar trabajador:', err);
      if (err.response?.status !== 401) {
        set({ error: err.response?.data?.error || 'Error al desactivar trabajador' });
      }
      throw err;
    } finally {
      set({ cargando: false });
    }
  },

  activarTrabajador: async (id) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.patch(`/trabajadores/${id}/activar`);
      await get().fetchTrabajadores();
      useUiStore.getState().mostrarToast({ tipo: 'success', titulo: 'Trabajador activado', mensaje: 'El trabajador volvió a estar activo y disponible para operar.' });
    } catch (err) {
      if (err.response?.status !== 401) {
        set({ error: err.response?.data?.error || 'Error al activar trabajador' });
      }
      throw err;
    } finally {
      set({ cargando: false });
    }
  },

  eliminarTrabajador: async (id) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.delete(`/trabajadores/${id}`);
      await get().fetchTrabajadores();
      useUiStore.getState().mostrarToast({ tipo: 'success', titulo: 'Trabajador eliminado', mensaje: 'El trabajador fue eliminado definitivamente del sistema.' });
    } catch (err) {
      if (err.response?.status !== 401) {
        set({ error: err.response?.data?.error || 'Error al eliminar trabajador' });
      }
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
