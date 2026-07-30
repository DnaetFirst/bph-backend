import { create } from 'zustand';
import { apiClient } from '../api/client.js';

// Parámetros de fallback para cuando la API no está disponible
const PARAMETROS_FALLBACK = [
  { id: 1, categoria: 'higiene', texto: 'Manos limpias y lavado correcto', orden: 1 },
  { id: 2, categoria: 'higiene', texto: 'Uñas cortas, limpias, sin esmalte', orden: 2 },
  { id: 3, categoria: 'higiene', texto: 'Sin joyas ni accesorios en manos/muñecas', orden: 3 },
  { id: 4, categoria: 'higiene', texto: 'Cabello recogido y cubierto', orden: 4 },
  { id: 5, categoria: 'higiene', texto: 'Sin heridas expuestas o cubiertas correctamente', orden: 5 },
  { id: 6, categoria: 'higiene', texto: 'No come, bebe ni fuma en el área', orden: 6 },
  { id: 7, categoria: 'higiene', texto: 'Higiene personal general adecuada', orden: 7 },
  { id: 8, categoria: 'uniforme', texto: 'Uniforme completo, limpio y en buen estado', orden: 1 },
  { id: 9, categoria: 'uniforme', texto: 'Cofia o gorro correctamente colocado', orden: 2 },
  { id: 10, categoria: 'uniforme', texto: 'Calzado cerrado, limpio y exclusivo del área', orden: 3 },
];

const AREAS_FALLBACK = [
  { id: 1, nombre: 'Cárnicos' },
  { id: 2, nombre: 'MAP' },
  { id: 3, nombre: 'FFVV' },
  { id: 4, nombre: 'Panificación' }
];

export const useEvaluacionesStore = create((set, get) => ({
  evaluaciones: [],
  total: 0,
  cargando: false,
  error: null,

  areas: [],
  parametros: [],

  fetchEvaluaciones: async (filtros = { pagina: 1, porPagina: 20 }) => {
    set({ cargando: true, error: null });
    try {
      const { data } = await apiClient.get('/evaluaciones', { params: filtros });
      set({ evaluaciones: data.items || [], total: data.total || 0, cargando: false });
    } catch (err) {
      set({
        error: err.response?.data?.error || 'No se pudieron cargar las evaluaciones.',
        cargando: false,
        evaluaciones: []
      });
    }
  },

  fetchDependenciasFormulario: async () => {
    // Cargar áreas y parámetros desde la API real.
    // Se usa /areas (público, accesible para evaluador/supervisor/administrador)
    // en lugar de /admin/areas, que está restringido solo a administradores
    // y devolvía 403 para el resto de los roles al llenar el formulario.
    // Si falla (backend no disponible), usa los valores de fallback.
    const fetchAreas = apiClient.get('/areas')
      .then(r => r.data)
      .catch(() => AREAS_FALLBACK);

    const fetchParametros = apiClient.get('/parametros')
      .then(r => r.data)
      .catch(() => PARAMETROS_FALLBACK);

    const [areas, parametros] = await Promise.all([fetchAreas, fetchParametros]);
    set({ areas, parametros });
  },

  crearEvaluacion: async (datos) => {
    set({ cargando: true, error: null });
    try {
      const { data } = await apiClient.post('/evaluaciones', datos);
      set({ cargando: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detalles
        ? `Datos inválidos: ${JSON.stringify(err.response?.data?.detalles?.fieldErrors || {})}`
        : 'Error al guardar la evaluación';
      set({ error: msg, cargando: false });
      throw err;
    }
  },

  anularEvaluacion: async (id, motivo) => {
    set({ cargando: true, error: null });
    try {
      await apiClient.post(`/evaluaciones/${id}/anular`, { motivo });
      // Recargar la lista para reflejar el cambio de estado
      await get().fetchEvaluaciones();
    } catch (err) {
      set({
        error: err.response?.data?.error || 'Error al anular la evaluación',
        cargando: false
      });
      throw err;
    }
  },
}));
