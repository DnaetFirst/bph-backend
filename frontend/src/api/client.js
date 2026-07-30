import axios from 'axios';

// URL del backend: se configura desde la variable de entorno VITE_API_URL.
// En producción, crear un archivo .env.production o .env en el frontend con:
//   VITE_API_URL=https://bph-backend.<tu-account>.workers.dev/api/v1
//
// En desarrollo local el backend corre en localhost:8787 (wrangler dev).
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api/v1';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true, // Necesario para enviar la cookie HTTP-Only 'token'
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token desde localStorage como fallback
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores globales (ej. desloguear si token expiró)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar cualquier estado de sesión y redirigir al login
      // (el store lo maneja en la capa de componente)
      localStorage.removeItem('auth_token');
      console.warn('Sesión expirada o no autorizada');
    }
    return Promise.reject(error);
  }
);
