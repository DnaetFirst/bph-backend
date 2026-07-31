# Control BPH — Frontend

React 19 + Vite + Zustand SPA para el sistema de control de inspección BPH.

## Desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. El frontend se conecta al backend local en `http://localhost:3001/api/v1` (configurado en `.env.local`).

## Build

```bash
npm run build
```

Genera archivos estáticos en `dist/`, desplegables a Cloudflare Pages.

## Configuración

| Variable | Dev (`.env.local`) | Producción (`.env.production`) |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001/api/v1` | `https://bph-backend-1.onrender.com/api/v1` |

## Estructura

```
frontend/src/
├── api/
│   └── client.js          # cliente Axios con interceptor JWT
├── components/ui/
│   ├── Badge.jsx
│   ├── KpiCard.jsx
│   ├── ProgressRow.jsx
│   ├── MiniBarChart.jsx
│   ├── EmptyState.jsx
│   ├── ErrorState.jsx
│   ├── LoadingState.jsx
│   ├── PageHeader.jsx
│   └── ProgressRing.jsx
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── EvaluacionForm.jsx
│   └── Trabajadores.jsx
├── store/
│   ├── authStore.js       # JWT auth + usuario
│   ├── uiStore.js         # toasts + estado UI
│   ├── trabajadoresStore.js
│   └── evaluacionesStore.js
├── App.jsx                # rutas + navbar
├── index.css              # design system (HSL vars, componentes)
└── main.jsx
```

## Deploy en Cloudflare Pages

```bash
npm run build
npx wrangler deploy
```

O vincinalo a un repositorio en Cloudflare Pages — el build command es `npm run build` y el directorio de salida es `dist/`.
