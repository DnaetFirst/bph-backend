# Control BPH — Backend (Cloudflare Workers + Supabase)

Guía paso a paso para levantar este proyecto desde cero. Seguí las fases en orden — cada una depende de la anterior.

---

## Fase 0 — Cuentas y recursos base

1. **Cloudflare**: crear cuenta si no tenés. Agregar tu **dominio propio** (ej. `tudominio.com`) a Cloudflare — es necesario para que las cookies de sesión funcionen bien entre el frontend (Pages) y el backend (Workers). Sin dominio propio, vas a tener el mismo problema de cookies cross-site que con cualquier combinación de dos proveedores distintos.
2. **Supabase**: crear cuenta y un proyecto nuevo. Anotar:
   - La connection string **directa** (puerto `5432`) desde `Project Settings → Database`.
3. Instalar el CLI de Wrangler y loguearte:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

---

## Fase 1 — Instalar dependencias y preparar la base

Antes de seguir, necesitás una base PostgreSQL accesible desde tu máquina. La opción recomendada es Supabase.

Si no tenés una base aún, creá un proyecto nuevo en Supabase y copiá la connection string directa (puerto 5432) desde Project Settings → Database.

Luego editá [backend/.env](backend/.env) y reemplazá la URL por esa connection string.

Ejemplo:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
SEED_ADMIN_PIN="000000"
```

Después ejecutá:

```bash
cd backend
npm install
npx prisma generate
```

```bash
cd backend
npm install
```

Copiá los archivos de ejemplo de variables:

```bash
cp .env.example .env
cp .dev.vars.example .dev.vars
```

Editá `.env` con la connection string directa de Supabase, y `.dev.vars` con secretos aleatorios para desarrollo local. Para generar un secreto random rápido desde la terminal:

```bash
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

---

## Fase 2 — Crear los recursos de Cloudflare (Hyperdrive, KV, R2)

**Hyperdrive** (pool de conexiones hacia Supabase):

```bash
wrangler hyperdrive create bph-hyperdrive --connection-string="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres"
```

Copiá el `id` que te devuelve y pegalo en `wrangler.toml`, en el bloque `[[hyperdrive]]`.

**KV** (rate limiting de login):

```bash
wrangler kv namespace create RATE_LIMIT
```

Copiá el `id` devuelto al bloque `[[kv_namespaces]]` de `wrangler.toml`.

**R2** (almacenamiento de respaldos cifrados):

```bash
wrangler r2 bucket create bph-respaldos
```

(El binding ya está declarado en `wrangler.toml`, solo hace falta que el bucket exista con ese nombre.)

---

## Fase 3 — Esquema de base de datos y seed

Con el `.env` ya apuntando a la conexión directa de Supabase:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
```

Esto crea las tablas, siembra las 4 áreas (Cárnicos, MAP, FFVV, Panificación), los 10 parámetros vigentes (7 de higiene + 3 de uniforme, ya sin los ítems eliminados), y un usuario administrador inicial (`EVA MORALES`, PIN definido en `SEED_ADMIN_PIN` de tu `.env`, con `requiereCambioPin: true` para forzar el cambio en el primer login).

---

## Fase 4 — Secretos de producción

Estos se configuran una sola vez en Cloudflare (nunca van en `wrangler.toml` ni en ningún archivo commiteado):

```bash
wrangler secret put JWT_SECRET
wrangler secret put BACKUP_ENCRYPTION_KEY
wrangler secret put CRON_TOKEN
```

Para generar `BACKUP_ENCRYPTION_KEY`, podés usar la función `generarClaveAESBase64()` de `src/utils/crypto.js` en un script rápido, o el mismo comando de `node -e` de la Fase 1.

También agregá, en el mismo panel o vía `wrangler secret put`, la variable `COOKIE_DOMAIN` con el valor `.tudominio.com` (con el punto adelante) una vez que tengas el dominio configurado.

---

## Fase 5 — Probar en local

```bash
npm run dev
```

Esto levanta el Worker con `wrangler dev`, simulando el entorno de producción (incluyendo los bindings de Hyperdrive, KV y R2 reales — Wrangler los conecta a los recursos reales que creaste en la Fase 2, no hay "modo local" separado para estos servicios).

Probá el endpoint de salud:

```bash
curl http://localhost:8787/api/v1/health
```

Y el login con el usuario sembrado:

```bash
curl -i -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nombre":"EVA MORALES","pin":"000000"}'
```

---

## Fase 6 — Dominios y despliegue

1. Configurá el **custom domain** del Worker (`api.tudominio.com`) — panel de Cloudflare, sección Workers → tu Worker → Settings → Domains & Routes. Alternativamente, descomentá el bloque `routes` en `wrangler.toml`.
2. Ajustá `FRONTEND_URL` en `wrangler.toml` (bloque `[vars]`) al dominio real de tu frontend (`https://app.tudominio.com`).
3. Desplegá:
   ```bash
   npm run deploy
   ```
4. En producción, corré las migraciones contra Supabase (si hiciste cambios de esquema desde el último deploy):
   ```bash
   npx prisma migrate deploy
   ```

---

## Fase 7 — Verificación final

- [ ] `GET https://api.tudominio.com/api/v1/health` responde `{ ok: true }`
- [ ] Login funciona y la cookie queda seteada con `Domain=.tudominio.com`
- [ ] El Cron Trigger corrió al menos una vez (revisar en el panel de Cloudflare → Workers → tu Worker → Triggers → Cron) y aparece un archivo en el bucket R2
- [ ] `GET /api/v1/evaluaciones/integridad/verificar` (como administrador) devuelve `{ ok: true, problemas: [] }` con la base recién sembrada

---

## Estructura de archivos de este backend

```
backend/
├── prisma/
│   ├── schema.prisma       # modelo de datos corregido (driverAdapters, índices)
│   └── seed.js             # áreas + 10 parámetros vigentes + admin inicial
├── src/
│   ├── worker.js           # entrypoint real (httpServerHandler + scheduled)
│   ├── app.js              # construcción de la app Express
│   ├── services/
│   │   ├── authService.js       # bcryptjs + jose
│   │   ├── evaluacionService.js # cálculo de %, hash encadenado
│   │   ├── auditoriaService.js  # hash encadenado de auditoría
│   │   ├── respaldoService.js   # AES-GCM + R2
│   │   └── reporteService.js    # export CSV
│   ├── middlewares/
│   │   ├── authenticate.js
│   │   ├── authorize.js
│   │   └── rateLimit.js         # basado en KV
│   ├── routes/
│   │   ├── auth.js
│   │   ├── evaluaciones.js
│   │   └── respaldos.js
│   ├── validators/
│   │   └── schemas.js           # Zod
│   └── utils/
│       ├── crypto.js            # Web Crypto: hash chain + AES-GCM
│       └── prismaClient.js      # Prisma vía binding de Hyperdrive
├── wrangler.toml
├── package.json
├── .env.example        # copiar a .env (solo para el CLI de Prisma)
└── .dev.vars.example   # copiar a .dev.vars (para wrangler dev)
```

## Pendiente para las próximas fases (no incluido en este esqueleto)

- Rutas de administración de usuarios y áreas (`src/routes/admin.js`) — mismo patrón que `evaluaciones.js`, protegido con `authorize('administrador')`.
- Script de migración de datos desde el HTML con localStorage (ver la sección 8 de la revisión del plan: PIN temporal + reconciliación de `anuladoPorLegado`).
- Frontend (React + Vite + Cloudflare Pages) — estructura de carpetas ya definida en el plan original, pendiente de armar el cliente Axios, el store de Zustand y las páginas.
