import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

// URL del backend: se configura desde la variable de entorno VITE_API_URL.
// En producción, crear un archivo .env.production o .env en el frontend con:
//   VITE_API_URL=https://bph-backend-1.onrender.com/api/v1
//
// En desarrollo local el backend Node corre en localhost:3001.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export const apiClient = axios.create({
  baseURL,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token desde localStorage como fallback
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores globales (ej. desloguear si token expiró)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isSilentAuthCheck = error.config?.headers?.['X-Silent-Auth-Check'] === 'true';

    if (error.response?.status === 401) {
      const authState = useAuthStore.getState();
      authState.limpiarSesion(!isSilentAuthCheck);
    }

    return Promise.reject(error);
  }
);
