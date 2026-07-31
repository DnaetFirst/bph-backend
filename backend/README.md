# Control BPH — Backend (Node.js + Express + Prisma + Neon)

Guía paso a paso para levantar este proyecto desde cero. Seguí las fases en orden — cada una depende de la anterior.

---

## Fase 0 — Cuentas y recursos base

1. **Render.com**: crear cuenta si no tenés.
2. **Neon**: crear cuenta y un proyecto PostgreSQL. Anotar:
   - La connection string (ej. `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/bph?sslmode=require`)

---

## Fase 1 — Instalar dependencias y preparar la base

Editá `backend/.env` y configurá la URL de conexión a Neon:

```env
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/bph?sslmode=require"
JWT_SECRET="dev-secret-1234567890abcdefghijklmnopqrstuv"
SEED_ADMIN_PIN="000000"
```

Luego ejecutá:

```bash
cd backend
npm install
npm run build:node
npm run seed
```

Esto crea las tablas, siembra las 4 áreas (Cárnicos, MAP, FFVV, Panificación), los 10 parámetros vigentes (7 de higiene + 3 de uniforme, ya sin los ítems eliminados), y un usuario administrador inicial (`EVA MORALES`, PIN `000000` con `requiereCambioPin: true`).

---

## Fase 2 — Probar en local

```bash
npm run dev:node
```

Esto levanta el servidor Node/Express en `http://localhost:3001`.

Probá el endpoint de salud:

```bash
curl http://localhost:3001/api/v1/health
```

Y el login con el usuario sembrado:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nombre":"EVA MORALES","pin":"000000"}'
```

---

## Fase 3 — Dominios y despliegue en Render

1. Creá un **Web Service** en Render.com conectado a tu repositorio.
2. Configurá las siguientes **environment variables** en el panel de Render:
   - `DATABASE_URL` — connection string de Neon
   - `JWT_SECRET` — string aleatorio de al menos 32 chars
   - `SEED_ADMIN_PIN` — PIN inicial del admin (solo para seed)
3. Build command: `npm install && npm run build:node`
4. Start command: `npm run start:node`
5. Deployá desde el panel o vía GitHub.

### Frontend (Cloudflare Pages)

El frontend (React + Vite) se despliega en Cloudflare Pages o cualquier hosting de estáticos. Configurá en `.env.production`:

```
VITE_API_URL=https://bph-backend-1.onrender.com/api/v1
```

---

## Verificación final

- [ ] `GET https://bph-backend-1.onrender.com/api/v1/health` responde `{ ok: true }`
- [ ] Login funciona y devuelve un token JWT
- [ ] `GET /api/v1/admin/usuarios` (como administrador) devuelve la lista de usuarios
- [ ] `GET /api/v1/evaluaciones/integridad/verificar` (como administrador) devuelve `{ ok: true, problemas: [] }`
- [ ] `GET /api/v1/admin/reporte/csv` genera un CSV con BOM UTF-8

---

## Estructura de archivos de este backend

```
backend/
├── prisma/
│   ├── schema.node.prisma   # modelo de datos para Node/Render
│   └── seed.js              # áreas + 10 parámetros + admin inicial
├── src-node/
│   ├── server.js            # entrypoint HTTP (http.createServer)
│   ├── app.js               # app Express (CORS, helmet, rutas)
│   ├── config.js            # variables de entorno
│   ├── prisma.js            # PrismaClient singleton
│   ├── services/
│   │   ├── authService.js       # JWT HMAC + PBKDF2 (node:crypto)
│   │   ├── evaluacionService.js # cálculo de %, hash encadenado
│   │   ├── trabajadorService.js # CRUD trabajadores
│   │   └── reporteService.js    # export CSV
│   ├── middlewares/
│   │   ├── authenticate.js  # verifica JWT en header Authorization
│   │   └── authorize.js     # chequea roles (admin/user)
│   ├── routes/
│   │   ├── auth.js          # login, me, cambiar PIN
│   │   ├── trabajadores.js  # CRUD trabajadores (activar/desactivar/eliminar)
│   │   ├── evaluaciones.js  # listado, crear, anular, exportar Excel, integridad
│   │   └── admin.js         # gestión de usuarios + áreas + CSV report
│   └── utils/
│       ├── crypto.js        # SHA-256, PBKDF2, AES-GCM
│       └── schemas.js       # validación Zod (login, evaluaciones, usuarios, áreas)
├── render.yaml
├── package.json
└── .env                     # (gitignoreado) variables locales
```

## Pendiente para las próximas fases

- Script de migración de datos desde el HTML con localStorage.
- AES-GCM backup (definido pero postergado a post-producción).
