import { create } from 'zustand';
import { apiClient } from '../api/client.js';
import { useUiStore } from './uiStore.js';

let ultimaSolicitud = 0;

export const useEvaluacionesStore = create((set, get) => ({
  evaluaciones: [],
  total: 0,
  resumen: null,
  evaluadores: [],
  ultimosFiltros: {},
  dependenciasCargando: false,
  dependenciasError: null,
  cargando: false,
  error: null,

  areas: [],
  parametros: [],

  fetchEvaluaciones: async (filtros = { pagina: 1, porPagina: 20 }) => {
    const solicitud = ++ultimaSolicitud;
    set({ cargando: true, error: null, ultimosFiltros: filtros });
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '' && v != null));
      const [listado, indicadores] = await Promise.all([
        apiClient.get('/evaluaciones', { params }),
        apiClient.get('/evaluaciones/resumen', { params }),
      ]);
      if (solicitud !== ultimaSolicitud) return;
      set({ evaluaciones: listado.data.items || [], total: listado.data.total || 0,
        resumen: indicadores.data.resumen, evaluadores: indicadores.data.evaluadores || [], cargando: false });
    } catch (err) {
      if (solicitud !== ultimaSolicitud) return;
      set({ error: err.response?.data?.error || 'No se pudieron cargar las evaluaciones.',
        cargando: false, evaluaciones: [], total: 0, resumen: null });
    }
  },

  fetchDependenciasFormulario: async () => {
    set({ dependenciasCargando: true, dependenciasError: null, areas: [], parametros: [] });
    try {
      const [areas, parametros] = await Promise.all([apiClient.get('/areas'), apiClient.get('/parametros')]);
      set({ areas: areas.data, parametros: parametros.data, dependenciasCargando: false });
    } catch (err) {
      set({ dependenciasCargando: false, dependenciasError: err.response?.data?.error || 'No se pudieron cargar las áreas y los parámetros. Reintenta antes de evaluar.' });
    }
  },

  crearEvaluacion: async (datos) => {
    set({ cargando: true, error: null });
    try {
      const { data } = await apiClient.post('/evaluaciones', datos);
      set({ cargando: false });
      useUiStore.getState().mostrarToast({ tipo: 'success', titulo: 'Evaluación guardada', mensaje: 'La evaluación se registró correctamente en el sistema.' });
      return data;
    } catch (err) {
      if (err.response?.status === 401) {
        set({ cargando: false });
        throw err;
      }
      const msg = err.response?.data?.error || 'Error al guardar la evaluación';
      set({ error: msg, cargando: false });
      throw err;
    }
  },

  obtenerEvaluacion: async (id) => {
    const { data } = await apiClient.get(`/evaluaciones/${id}`);
    return data;
  },

  editarEvaluacion: async (id, datos) => {
    set({ cargando: true, error: null });
    try {
      const { data } = await apiClient.put(`/evaluaciones/${id}`, datos);
      set({ cargando: false });
      useUiStore.getState().mostrarToast({
        tipo: 'success',
        titulo: 'Evaluación actualizada',
        mensaje: 'Los cambios se guardaron y la integridad fue recalculada.',
      });
      return data;
    } catch (err) {
      if (err.response?.status === 401) {
        set({ cargando: false });
        throw err;
      }
      set({
        error: err.response?.data?.error || 'Error al actualizar la evaluación',
        cargando: false,
      });
      throw err;
    }
  },

  anularEvaluacion: async (id, motivo) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.post(`/evaluaciones/${id}/anular`, { motivo });
      await get().fetchEvaluaciones(get().ultimosFiltros);
      useUiStore.getState().mostrarToast({ tipo: 'success', titulo: 'Evaluación anulada', mensaje: 'La evaluación fue anulada correctamente y el listado ya se actualizó.' });
    } catch (err) {
      if (err.response?.status === 401) {
        set({ cargando: false });
        throw err;
      }
      set({
        error: err.response?.data?.error || 'Error al anular la evaluación',
        cargando: false
      });
      throw err;
    }
  },

  borrarEvaluacion: async (id) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.delete('/evaluaciones/' + id);
      await get().fetchEvaluaciones(get().ultimosFiltros);
      useUiStore.getState().mostrarToast({ tipo: 'success', titulo: 'Evaluación eliminada', mensaje: 'La evaluación fue eliminada permanentemente y el listado ya se actualizó.' });
    } catch (err) {
      if (err.response?.status === 401) {
        set({ cargando: false });
        throw err;
      }
      set({
        error: err.response?.data?.error || 'Error al eliminar la evaluación',
        cargando: false
      });
      throw err;
    }
  },
}));
