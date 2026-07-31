import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key] || !process.env[key].trim()) {
    throw new Error(`Falta la variable de entorno requerida: ${key}`);
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET.trim(),
  jwtExpirationSeconds: Number.parseInt(process.env.JWT_EXPIRATION_SECONDS || '28800', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173,https://frontend.bph-backend-esqueleto.workers.dev,https://frontend-auto.bph-backend-esqueleto.workers.dev',
  loginMaxIntentos: Number.parseInt(process.env.LOGIN_MAX_INTENTOS || '5', 10),
  loginBloqueoSegundos: Number.parseInt(process.env.LOGIN_BLOQUEO_SEGUNDOS || '300', 10),
};

export function getAllowedOrigins() {
  return config.frontendUrl
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
