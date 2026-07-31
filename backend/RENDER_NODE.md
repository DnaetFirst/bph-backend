# Deploy del backend Node en Render

Esta guía despliega el backend Node estable usando la carpeta `backend/` y el entrypoint `src-node/server.js`.

## 1. Crear el servicio

En Render:

- New +
- Web Service
- conectar el repositorio

Si Render detecta `render.yaml`, puedes usarlo directamente.

## 2. Configuración manual recomendada

- **Root Directory**: `backend`
- **Environment**: `Node`
- **Build Command**:

```bash
npm install && npm run build:node
```

- **Start Command**:

```bash
npm run start:node
```

- **Health Check Path**:

```text
/api/v1/health
```

## 3. Variables de entorno en Render

Configura estas variables:

### Requeridas

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`

### Recomendadas

- `NODE_ENV=production`
- `JWT_EXPIRATION_SECONDS=28800`
- `LOGIN_MAX_INTENTOS=5`
- `LOGIN_BLOQUEO_SEGUNDOS=30`

## 4. Valor de FRONTEND_URL

Mientras tu frontend siga en Cloudflare Workers/Pages, usa el origen público real. Ejemplo:

```env
FRONTEND_URL=https://frontend.bph-backend-esqueleto.workers.dev
```

Si luego agregas otro frontend o dominio propio, puedes permitir varios separados por coma:

```env
FRONTEND_URL=https://frontend.bph-backend-esqueleto.workers.dev,https://app.tudominio.com
```

## 5. Probar el deploy

Una vez desplegado, prueba:

### Health

```bash
curl https://TU-SERVICIO.onrender.com/api/v1/health
```

### Login

```bash
curl -X POST https://TU-SERVICIO.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nombre":"EVA MORALES","pin":"000000"}'
```

## 6. Actualizar el frontend

Cuando tengas la URL pública del backend en Render, configura en el frontend:

```env
VITE_API_URL=https://TU-SERVICIO.onrender.com/api/v1
```

## 7. Recomendación importante

Antes del cambio final del frontend a producción, prueba este flujo completo contra Render:

- login
- me
- listar trabajadores
- crear
- editar
- desactivar
- activar
- eliminar

Si todo responde bien, el frontend ya puede dejar de apuntar al Worker.
