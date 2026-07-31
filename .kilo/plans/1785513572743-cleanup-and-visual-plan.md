# Plan: Backend Cleanup (Hyperdrive→Node) + Frontend Visual Uniformity

## Stack objetivo

| Componente | Tecnología | Deploy |
|---|---|---|
| Backend | Node.js + Express + Prisma 5 + Neon PostgreSQL | Render.com (`render.yaml`) |
| Frontend | React 19 + Vite + Zustand + Tailwind CSS (HSL vars) | Cloudflare Pages (`wrangler.jsonc`) |
| DB | Neon PostgreSQL | — |

**Código legacy a eliminar:** Cloudflare Worker stack (`backend/src/`, `wrangler.toml`, Hyperdrive, KV namespaces, R2 bucket, Cron triggers).

---

## PARTE A — Limpieza backend (Hyperdrive/Worker → Node/Render)

### A.1 Archivos/directorios a BORRAR

| Ruta | Razón |
|---|---|
| `backend/src/` (directorio completo) | Worker code reemplazado por `src-node/`. Incluye `worker.js`, `app.js`, `routes/{auth,evaluaciones,trabajadores,respaldos,admin}.js`, `services/`, `middlewares/`, `utils/`, `validators/` |
| `backend/wrangler.toml` | Config Worker (KV, R2, Hyperdrive, cron) |
| `backend/.dev.vars`, `backend/.dev.vars.example` | Secrets Worker locales |
| `backend/.wrangler/` | Cache Wrangler |
| `backend/prisma/schema.prisma` | Schema Worker (`previewFeatures=["driverAdapters"]`). **Mantener** `schema.node.prisma`. |
| `bph-backend-esqueleto/backend-node/` | Placeholder vacío |
| `backend/debug-delete-trabajador.js` | Script debug no versionado |
| `backend/diagnosticar-usuario.js` | Script debug no versionado |
| `backend/verificar-pin.js` | Script debug no versionado |
| `backend/consultar-trabajadores.js` | Script debug no versionado |
| `prod_cookies.txt` | Cookies test (en `.gitignore`) |
| `Seguir/ControlBPH_CEPROD.html` | HTML legacy localStorage ✅ **BORRAR** (referencia visual pasada a React) |

### A.2 Archivos a MODIFICAR

#### `backend/package.json`
- **Eliminar deps:** `@neondatabase/serverless`, `@prisma/adapter-neon`, `@prisma/extension-accelerate`, `jose`
- **Eliminar devDeps:** `wrangler`, `dotenv-cli`
- **Eliminar scripts:** `dev` (wrangler), `deploy` (wrangler), `prisma:generate` (usa schema Worker default)
- **Mantener/actualizar:** `dev:node`, `start:node`, `build:node`, `prisma:generate:node`, `prisma:migrate:*:node`, `seed`

#### `.gitignore` (root)
- Las líneas `.wrangler/` y `.dev.vars` ya están presentes — **mantener** (entradas defensivas, inofensivas)
- `prod_cookies.txt` ya está listado — mantener
- `backend/generated/` ya está listado — mantener

#### `backend/README.md`
- Reemplazar secciones de Cloudflare Workers/Wrangler por instrucciones de Render
- Actualizar estructura de archivos (solo `src-node/`, no `src/`)

### A.3 Funcionalidad MORIRÁ si se borra sin migrar (CRÍTICO)

Al borrar `backend/src/`, se pierde definitivamente:

| Feature | Worker (`src/`) | Node (`src-node/`) | Acción requerida |
|---|---|---|---|
| **Gestión de usuarios** (CRUD + reset PIN + roles) | ✅ `routes/admin.js` | ❌ NO existe | **MIGRAR** a `src-node/routes/admin.js` |
| **Gestión de áreas** (CRUD) | ✅ `routes/admin.js` | ❌ NO existe (solo seed) | **MIGRAR** a `src-node/routes/admin.js` |
| **Verificación de integridad** | ✅ `routes/evaluaciones.js` (`GET /integridad/verificar`, admin-only) | ❌ NO existe en Node | **MIGRAR** a `src-node/routes/evaluaciones.js` |
| **Backup AES-GCM → R2** | ✅ `routes/respaldos.js` + `services/respaldoService.js` | ❌ NO existe | **DEFERIDO** (post-producción) |
| **Export CSV** | ✅ `reporteService.js` | ❌ NO existe (Node tiene Excel export) | **MIGRAR** — usuario quiere CSV + Excel |

> ⚠️ **El usuario confirmó: la gestión de usuarios con 3 roles (evaluador/supervisor/administrador) es obligatoria.** El `admin.js` Worker define los endpoints `/admin/usuarios` (list, create, update, reset-pin), `/admin/areas` (list, create, update), todos protegidos con `authorize('administrador')`.

### A.4 Migración de admin.js a Node (CAMPO A CAMPO)

#### `backend/src-node/middlewares/authorize.js` (NUEVO)
```js
// Copiar desde backend/src/middlewares/authorize.js (16 líneas)
// Requiere: roles permitidos como parámetros, verifica req.usuario.rol
```

#### `backend/src-node/routes/admin.js` (NUEVO)
> **Notar migración Worker→Express:**
> - Worker usa `new Router()` (custom) → Node usa `import { Router } from 'express'`
> - Worker usa `req.prisma` (inyectado por middleware Worker) → Node importa `prisma` desde `../prisma.js` (inyectar como `req.prisma` o usar import directo)
> - Worker usa `res.headers.set()` → Node usa `res.set()` (patrón ya establecido en `src-node/routes/evaluaciones.js:72,176`)
> - Worker importa schemas desde `../validators/schemas.js` → Node reutiliza `utils/schemas.js` (**YA EXISTE** con `crearUsuarioSchema`, `actualizarUsuarioSchema`, `areaSchema`, y `validar()`)
>
> - `GET /admin/usuarios` — lista usuarios (id, nombre, rol, activo, creadoEn, bloqueadoHasta)
> - `POST /admin/usuarios` — crea usuario (nombre, rol; PIN default "000000", requiereCambioPin=true)
> - `PUT /admin/usuarios/:id` — actualiza rol/activo
> - `PUT /admin/usuarios/:id/reset-pin` — resetea PIN a "000000"
> - `GET /admin/areas` — lista áreas
> - `POST /admin/areas` — crea área
> - `PUT /admin/areas/:id` — actualiza área
> - `GET /admin/reporte/csv` — export CSV (admin-only)

#### `backend/src-node/app.js` (MODIFICAR)
```js
import adminRoutes from './routes/admin.js';  // AGREGAR
// ...
app.use('/api/v1/admin', adminRoutes);  // AGREGAR
```

#### `backend/src-node/routes/evaluaciones.js` (MODIFICAR)
- Agregar `GET /integridad/verificar` (admin-only) → usa `EvaluacionService.verificarIntegridadCompleta()`. **Importante:** ubicar la ruta ANTES de `/:id/anular` para evitar conflictos de routing (ver nota del Worker).

#### `backend/src-node/services/reporteService.js` (NUEVO)
- Migrar desde `src/services/reporteService.js` (67 líneas) — CSV con BOM UTF-8, escape de celdas, misma lógica. No depende de Web Crypto ni de bindings Worker.

#### `backend/prisma/seed.js` (MODIFICAR)
- **IMPORT PATH:** Cambiar `../src/utils/crypto.js` → `../src-node/utils/crypto.js` (line 8). Al borrar `src/`, el path Worker dejará de existir.
- **Iteration count:** Ambos archivos (Worker + Node) usan `100000` iter (línea 112 en ambos) — **NO hay mismatch**. El seed seguirá funcionando con 100k.
- **Crypto polyfill:** El seed ya settea `globalThis.crypto = crypto.webcrypto` (líneas 12-14) para Node 18. El `src-node/utils/crypto.js` usa `crypto.subtle` directamente — funciona en Node 18+ con el polyfill del seed, y Node 19+ sin él (global `crypto`).
- El Worker `src/services/authService.js` usa `req.env.JWT_SECRET` + Web Crypto. El Node `src-node/services/authService.js` usa `config.jwtSecret` + `node:crypto`. Verificar que el seed funcione con el schema de Node.

### A.5 Verificación backend
```powershell
cd backend
npm install        # instalar deps limpias
npm run build:node # prisma generate
npm run seed       # sembrar DB (verificar PIN "000000" funciona)
npm run dev:node   # node src-node/server.js
curl http://localhost:3001/api/v1/health
curl -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"nombre":"EVA MORALES","pin":"000000"}'
```

---

## PARTE B — Mejora visual unificada (Frontend)

### B.1 Estado actual

#### CSS existente (`frontend/src/index.css`) — ✅ YA IMPLEMENTADO
Variables HSL, `glass-panel`, `page-shell`, `page-header`, `page-title`, `page-subtitle`, `section-card`, `section-card-body`, `section-title`, `section-subtitle`, `info-banner`, `empty-state`/`error-state`/`loading-state`, `action-group`, `btn` familia, `input-field`, `label`, `data-table`, `animate-fade-in`, `layout-container`, scrollbar.

#### `App.css` — ❌ BORRAR
Boilerplate del template Vite (`counter`, `hero`, `docs`, `#next-steps`, `.ticks`). **No se usa** en la app real.

#### `backend/src-node/services/authService.js` — notar diferencia
El Worker (`src/services/authService.js`) incluye try/catch alrededor de cada llamada Prisma y el `ErrorAuth` exportado. El Node (`src-node/services/authService.js`) es más limpio y ya usa `ErrorAuth`. No necesita migración, solo delete.

### B.2 Inconsistencias detectadas (priorizadas)

| # | Inconsistencia | Archivo | Severidad |
|---|---|---|---|
| 1 | ~30 `style={{}}` inline en Dashboard | `Dashboard.jsx` | Alta |
| 2 | Título Dashboard usa `--color-primary` (rosa) vs `page-title` (gris) | `Dashboard.jsx:282` | Media |
| 3 | Badges inline (EstadoBadge, ClasificacionBadge) | `Dashboard.jsx:44-80` | Alta |
| 4 | KPI cards, charts, progress bars inline | `Dashboard.jsx:82-130` | Alta |
| 5 | `btn-small` usado pero no definido en CSS | `Trabajadores.jsx:220,223,265,268` | Media |
| 6 | Labels inline en Dashboard filtros | `Dashboard.jsx:317,327,337,347,356,366,371` | Media |
| 7 | Navbar con estilos inline | `App.jsx:17-27` | Media |
| 8 | Error states inline duplicados | `Dashboard.jsx`, `EvaluacionForm.jsx`, `Trabajadores.jsx` | Media |
| 9 | Login form usa `style={{display:'flex',gap}}` | `Login.jsx:53` | Baja |
| 10 | Items de lista Trabajadores inline styles | `Trabajadores.jsx:199-211,244-256` | Media |
| 11 | `SeccionParametros` inline styles | `EvaluacionForm.jsx:95-119` | Media |
| 12 | `hsl(var(--color-text))` **undefined** variable in Navbar links | `App.jsx:22-24` | Alta |

### B.3 Componentes UI a CREAR (`frontend/src/components/ui/`)

| Componente | Props | Reemplaza en |
|---|---|---|
| `Badge.jsx` | `{ variant: 'success'\|'warning'\|'danger'\|'info'\|'neutral', icon?: Icon, children }` | `Dashboard.jsx: EstadoBadge, ClasificacionBadge, color badge inline` |
| `KpiCard.jsx` | `{ icon: Icon, titulo, valor, subtitulo, color? }` | `Dashboard.jsx: KpiCard inline (line 82-95)` |
| `ProgressRow.jsx` | `{ label, value, color? }` | `Dashboard.jsx: ProgressRow inline (line 117-130)` |
| `MiniBarChart.jsx` | `{ data, color? }` | `Dashboard.jsx: MiniBarChart inline (line 97-115)` |
| `EmptyState.jsx` | `{ titulo, mensaje, icon?: Icon, actionLabel?, onAction? }` | `Dashboard.jsx:510` empty state; `Trabajadores` empty |
| `ErrorState.jsx` | `{ error, onRetry? }` | `Dashboard.jsx:496` error; `EvaluacionForm.jsx:137` error; `Trabajadores.jsx:128` error |
| `LoadingState.jsx` | `{ mensaje }` | `Dashboard.jsx:505`; `Trabajadores` loading |
| `PageHeader.jsx` | `{ titulo, subtitulo?, acciones?: ReactNode }` | Patrón común en todas las páginas |
| `FormParametroRow.jsx` | `{ parametro, valor, onChange }` | `EvaluacionForm.jsx:95-119` — segmentados control + label |
| `ProgressRing.jsx` | `{ porcentaje, color }` | Mini bar inside KPI cards and form summary |
| `Drawer.jsx` | `{ isOpen, onClose, titulo, children }` | Trabajadores "+ Nuevo" (opcional)

### B.3.1 CSS a AGREGAR en `index.css`

```css
/* Badges */
.badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; }
.badge-success { background: hsla(142, 71%, 45%, 0.15); color: hsl(142, 71%, 35%); }
.badge-warning  { background: hsla(38, 92%, 50%, 0.15);  color: hsl(38, 92%, 40%); }
.badge-danger   { background: hsla(348, 83%, 47%, 0.15);  color: hsl(348, 83%, 45%); }
.badge-info      { background: hsla(221, 83%, 53%, 0.15);  color: hsl(221, 83%, 40%); }

/* Small buttons */
.btn-small { padding: 0.45rem 0.8rem; font-size: 0.8rem; }
.btn-ghost { background: transparent; border: none; color: hsl(var(--color-text-secondary)); padding: 0.25rem 0.4rem; cursor: pointer; }
.btn-ghost:hover { color: hsl(var(--color-text-primary)); }

/* Segmented control (form resultados) */
.segmented { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.segmented-btn { padding: 0.35rem 0.7rem; font-size: 0.8rem; border-radius: var(--radius-full); }
.segmented-btn.active { opacity: 1; }
.segmented-btn.inactive { opacity: 0.4; }

/* Navbar */
.navbar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: hsla(var(--color-surface), 0.88); backdrop-filter: blur(10px); border-bottom: 1px solid hsla(var(--color-primary), 0.10); box-shadow: 0 6px 24px rgba(75, 76, 244, 0.05); }
.navbar-left { display: flex; align-items: center; gap: 0.8rem; }
.navbar-brand { height: 34px; width: auto; }
.navbar-nav a { text-decoration: none; color: hsl(var(--color-text-primary)); font-size: 0.9rem; font-weight: 500; }
.navbar-user { display: flex; align-items: center; gap: 1rem; }
```

### B.4 Rediseño UI/UX por pantalla

#### 1. Dashboard.jsx — Arquitectura visual mejorada

**Problemas actuales:** Mezcla de `glass-panel` y `section-card`, header con color rosa en lugar de gris, 30 inline styles, sin acciones en tabla, badges sin consistencia.

**Diseño propuesto (mejora al ASCII):**

```
┌─ PAGE SHELL ───────────────────────────────────────────────────┐
│  page-header: [Dashboard title + subtitle]   [Nuevo Eval] [Export]  │
├────────────────────────────────────────────────────────────────┤
│  ┌─ KPIs (section-card) ───────────────────────────────────────┐ │
│  │  4 cards en grid: Total | Promedio | Cumplimiento Color | Deficientes │ │
│  └────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│  ┌─ FILTROS (section-card, collapsible) ───┬─ ÁREA (section-card) ─┐ │
│  │  Trabajador ▼  Área ▼  Estado ▼       │  Bar chart horizontal  │ │
│  │  Fecha desde  Fecha hasta  Limpiar      │  por área              │ │
│  └────────────────────────────────────────┴───────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│  ┌─ RENDIMIENTO ──┬─ CALIDAD ──┬─ TOP 5 ───────────────────────┐ │
│  │  Tendencia    │  Progress   │  Bar chart                   │ │
│  │  (últimas 6)  │  rows       │  top performers              │ │
│  └───────────────┴─────────────┴──────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│  TABLA: Nombre | Área | Fecha | Estado | Clasif. | Color | [⋯]  │
│  [ Pagination: « 1 de 5 ›› ]                                    │
│  (empty: "Crear primera evaluación" → botón primario)           │
└────────────────────────────────────────────────────────────────┘
```

**Principios UX aplicados:**
- **Consistencia visual:** todas las secciones usan `section-card` (no mezclar con `glass-panel`)
- **Visual hierarchy clara:** H1 → H2 (KPIs, Filtros, Tabla) → labels → valores
- **Acciones contextuales:** cada fila de tabla tiene menú de tres puntos (⋯) para anular/ver detalle
- **Progressive disclosure:** filtros colapsables (`CollapsibleFilters`) para no abrumar
- **Empty state accionable:** botón primario "Nueva evaluación" con icono
- **Badges con iconos:** estado (✅/⚠️), clasificación (color + porcentaje)

**Componentes a extraer:**
- `<DashboardKpi />` — 4 variantes: total, percentage, trend, count
- `<DashboardFilters />` — collapsible, 6 campos, botón limpiar
- `<AreaChart />` — reemplaza `MiniBarChart` para "Volumen por área"
- `<TrendChart />` — reemplaza tendencia con sparkline
- `<PerformanceBars />` — reemplaza `ProgressRow` con colores consistentes
- `<TopPerformers />` — tabla compacta con rankings
- `<EvaluacionesTable />` — tabla con acciones por fila, paginación integrada, estados

**Tabla rediseñada:**
| Nombre | Área | Fecha | Estado | General | Color | Acciones |
|---|---|---|---|---|---|---|
| Usar `<Badge>` para estado (✅/⚠️) y clasificación (color + %) | Mostrar color esperado vs observado: si coinciden → verde check ✓, si no → rojo X ✗ | `⋯` dropdown: Ver detalle, Anular (solo supervisor/admin) |

#### 2. EvaluacionForm.jsx — Rediseño UX del formulario

**Problemas actuales:** Botones de resultado individuales (Cumple/No cumple/No aplica) pocos intuitivos; grid de datos base sin visual grouping; error state inline.

**Diseño propuesto:**

```
┌─ PAGE SHELL ───────────────────────────────────────────────────┐
│  ← Volver  page-header: "Nueva evaluación BPH" + subtitle     │
├────────────────────────────────────────────────────────────────┤
│  ┌─ DATOS BASE (section-card) ────────────────────────────────┐ │
│  │  [Fecha] [Trabajador ▼]  ← grid 2-col                    │ │
│  │  [Área ▼]  [Evaluador (readonly)]                          │ │
│  └────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│  ┌─ HIGIENE PERSONAL (section-card) ──────────────────────────┐ │
│  │  [✓] Manos limpias y lavado correcto        ○ ● ○         │ │
│  │  [✓] Uñas cortas, limpias, sin esmalte      ● ● ○         │ │
│  │  ...                                                        │ │
│  │  ──────────────────────────────────────────────────────── │ │
│  │  Higiene: 85% (5/7 cumplen)                              │ │
│  └────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│  ┌─ UNIFORME (section-card) ─────────────────────────────────┐ │
│  │  [✓] Uniforme completo, limpio...           ○ ● ○         │ │
│  │  ...                                                        │ │
│  │  ──────────────────────────────────────────────────────── │ │
│  │  Uniforme: 66% (2/3 cumplen)                              │ │
│  └────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│  ┌─ CONTROL DE COLOR (info-banner) ───────────────────────────┐ │
│  │  [Color esperado: Rojo (lunes)] [Color observado ▼]       │ │
│  └────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│  ┌─ OBSERVACIONES (section-card) ─────────────────────────────┐ │
│  │  [Textarea 500 chars max, contador en vivo]               │ │
│  └────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│  RESUMEN: Higiene 85% | Uniforme 66% | General 75% → Excelente │
│  [Cancelar] [Guardar evaluación]  ← action-group alineado right │
└────────────────────────────────────────────────────────────────┘

**UI/UX mejorado:**
1. **Selector de resultado visual:** En vez de 3 botones por fila, usar un selector tipo "segmented control": `● Cumple / ○ No cumple / ○ No aplica` — clic directo en la etiqueta o en el círculo
2. **Indicador de progreso en vivo:** Porcentaje por categoría al final de cada sección, actualizado en tiempo real
3. **Contador de caracteres** para observaciones (500/500)
4. **Resumen visual** antes de guardar: barra de porcentaje + clasificación
5. **Formulario desactivado** si no hay trabajador/área seleccionados (estado skeleton)
6. **Keyboard UX:** Enter en input → siguiente, Escape → cancelar

#### 3. Trabajadores.jsx — Rediseño de lista/cards

**Problemas actuales:** Items de lista con inline styles, `btn-small` no definido, sin estado vacío consistente.

**Diseño propuesto:**
```
┌─ PAGE SHELL ───────────────────────────────────────────────────┐
│  page-header: "Gestionar trabajadores" + [+ Nuevo]           │
├────────────────────────────────────────────────────────────────┤
│  ┌─ BUSCADOR (input con icono lupa) ──────────────────────────┐ │
│  │  Filtra por nombre...                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│  TABLAS SEPARADAS:
│  ┌─ ACTIVOS (section-card) ──────────────────────────────────┐ │
│  │  Tabla: Nombre | Área | Acciones [Editar] [Desactivar]   │ │
│  │  (empty: "No hay trabajadores activos")                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌─ INACTIVOS (section-card) ────────────────────────────────┐ │
│  │  Tabla: Nombre | Área | Acciones [Activar] [Eliminar]    │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**UI/UX mejorado:**
1. **Tabla en vez de cards:** Mejor para scaneo horizontal de múltiples trabajadores
2. **Buscar en tiempo real:** filtro por nombre con debounce
3. **Acciones en tabla:** columna de acciones con iconos claros (✏️ editar, ✅ activar, ⚫ desactivar)
4. **Empty state:** mensaje claro + botón primario
5. **Opcional (post-MVP):** "+ Nuevo" abre un drawer (panel lateral) en vez de formulario inline

#### 4. Login.jsx — Pulido final

**Cambios mínimos:**
- Error state → usar `<ErrorState>` component (no inline)
- Form buttons → `action-group` (ya casi OK)
- Ya usa `glass-panel`, `input-field`, `btn btn-primary` ✅
- **Opcional:** checkbox "Recordar sesión" + link "¿Olvidaste tu PIN?" (requiere backend reset-flow — marcar como post-MVP)

#### 5. App.jsx Navbar — Componente extracción

**Diseño:**
```html
<NavBar>
  <NavBarLeft><Logo> BPH Control</NavBarLeft>
  <NavBarNav>[Dashboard] [Evaluar] [Trabajadores]</NavBarNav>
  <NavBarUser>
    <UserMenu>
      👤 EVA MORALES (Admin)
      [Cambiar PIN] [Cerrar sesión]
    </UserMenu>
  </NavBarUser>
</NavBar>
```

**CSS classes:**
```css
.navbar { ... }          /* ya definido arriba */
.navbar-brand { ... }
.navbar-nav { ... }
.navbar-user { ... }
.dropdown { position: relative; }
.dropdown-toggle { cursor: pointer; }
.dropdown-menu { position: absolute; right: 0; ... }
.dropdown:hover .dropdown-menu { display: block; }
```
**CRÍTICO:** Fix bug `hsl(var(--color-text))` → `hsl(var(--color-text-primary))` en los links de Navbar (App.jsx:22-24). **`--color-text` es indefinido** en CSS, los enlaces Navbar renderizan invisible.

### B.5 Orden de ejecución (visual)

| Paso | Acción | Archivos |
|---|---|---|
| 1 | Agregar clases CSS faltantes | `index.css` |
| 2 | Borrar `App.css` | `App.css` |
| 3 | Crear componentes UI base | `components/ui/` |
| 4 | Refactorizar Dashboard (badges, KPIs, charts, estados) | `Dashboard.jsx` |
| 5 | Refactorizar Login | `Login.jsx` |
| 6 | Refactorizar Trabajadores | `Trabajadores.jsx` |
| 7 | Refactorizar EvaluacionForm | `EvaluacionForm.jsx` |
| 8 | Extraer Navbar | `App.jsx` |

### B.6 Verificación visual
- `npm run dev` (frontend) — revisar cada pantalla en responsive (mobile/desktop)
- `npm run lint` (oxlint) — cero warnings
- Flujo end-to-end: Login → Dashboard → Crear evaluación → Ver en tabla → Exportar Excel
- `test-node-flow.ps1` → **CREAR** (no existe aún) — basarse en `test-render-flow.ps1` pero apuntar a `http://localhost:3001/api/v1` y probar admin endpoints (`/admin/usuarios`, `/admin/areas`, `/admin/reporte/csv`)

---

## ORDEN DE EJECUCIÓN GLOBAL (full-stack)

| Fase | Prioridad | Acción |
|---|---|---|
| **A.4** | 🔴 Crítica | Crear `src-node/routes/admin.js` + `authorize.js` + `reporteService.js` + integridad en evaluaciones |
| **A.1** | 🔴 Crítica | Borrar `backend/src/` (Worker) — **después de A.4 completado y testeado** |
| **A.5** | 🟡 Alta | Verificar `npm run dev:node` funciona (seed + login + endpoints) |
| **A.2** | 🟡 Alta | Limpiar `package.json`, `.gitignore`, `README.md` |
| **B.1** | 🟢 Media | CSS base (`.badge`, `.btn-small`, `.btn-ghost`, `.segmented`) + borrar `App.css` |
| **B.3** | 🟢 Media | Componentes UI reutilizables (`Badge`, `KpiCard`, `ErrorState`, etc.) |
| **B.4-D** | 🟢 Media | Dashboard → Login → Trabajadores → EvaluacionForm → Navbar |
| **Verificación** | 🔴 Crítica | `npm run seed` (login con PIN), `test-node-flow.ps1`, `test-render-flow.ps1`, lint, dev server |

> **Regla de oro:** No borrar `backend/src/` hasta que `src-node/routes/admin.js` esté funcionando y testeado. El Worker puede servir como referencia durante la migración.

---

## DECISIONES RESUELTAS

| # | Pregunta | Respuesta | Acción |
|---|---|---|---|
| 1 | ¿Borrar `Seguir/ControlBPH_CEPROD.html`? | "si es referencia visual, puedes eliminarla" | ✅ **Borrar** — HTML legacy, estilos migrados a React |
| 2 | ¿Migrar `GET /admin/reporte/csv`? | "si ambos para tener" | ✅ **Migrar** — `reporteService.js` a `src-node/services/` (67 líneas, no depende de Worker) |
| 3 | ¿Migrar backup AES-GCM? | "dejamos para el final, post-producción" | ✅ **Deferred** — backup no es prioridad para MVP
