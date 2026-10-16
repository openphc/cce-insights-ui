# Developer Setup & Configuration

> **CCE Insights UI** — Local development guide  
> **Version**: 1.0.0 | **Last Updated**: 2026-06-30

---

## 1. Prerequisites

| Tool | Version | Required | Purpose |
|---|---|---|---|
| **Node.js** | 24 (CI standard; ≥20 works locally) | Yes | JavaScript runtime |
| **npm** | 10+ | Yes | Package manager (bundled with Node) |
| **Git** | 2.x | Yes | Version control |
| **Docker** | 24+ | Recommended | Run backend dependencies |
| **Docker Compose** | 2.x | Recommended | Orchestrate infrastructure |

### Backend Dependencies

The Insights UI requires the **CCE Insights Service** running and connected to a populated PostgreSQL database. The full stack setup:

```
PostgreSQL (cce_collector) ← Collector Service + Compliance Service (write data)
                           ← Insights Service (read-only, port 8084)
                           ← Insights UI (this app, port 3001)
```

---

## 2. Quick Start

### 2.1 Start Backend Infrastructure

```bash
# Option A: Start everything via the Collector Service compose
cd /path/to/cce-collector-service
docker compose up -d

# Start the Insights Service
cd /path/to/cce-insights-service
./gradlew bootRun
# Verify: curl http://localhost:8084/actuator/health

# Option B: If Insights Service is also containerized
cd /path/to/cce-insights-service
docker compose up -d
```

> **Seed data:** The Insights UI needs populated tables to display meaningful analytics. Run the demo event submission workflow (via the Emitter Adaptor or Postman collection) to seed patient data, protocol enrollments, and clinical events.

### 2.2 Clone & Install

```bash
git clone <repository-url>
cd cce-insights-ui

npm install
```

### 2.3 Configure Environment

```bash
cp .env.example .env
```

Default `.env` (mirrors `.env.example`):
```bash
# Leave empty for local dev so the Vite proxy handles /v1/insights/
VITE_API_BASE_URL=

# Authentication (Keycloak / OIDC) — off for local dev
VITE_AUTH_ENABLED=false
VITE_KEYCLOAK_URL=
VITE_KEYCLOAK_REALM=cce
VITE_KEYCLOAK_CLIENT_ID=cce-insights-ui
VITE_AUTH_TOKEN=

VITE_POLLING_INTERVAL=60000
VITE_DEFAULT_DATE_RANGE_DAYS=90
```

### 2.4 Start Development Server

```bash
npm run dev
```

Open http://localhost:3001 in your browser.

### 2.5 Verify Connection

The dashboard should load metrics from the Insights Service. If you see "Cannot reach Insights Service" errors:

1. Check that the Insights Service is running: `curl http://localhost:8084/actuator/health`
2. Check that the database has data: `curl http://localhost:8084/v1/insights/events/summary`
3. Check CORS: if using direct connection (not Vite proxy), ensure the Insights Service allows `http://localhost:3001`

---

## 3. Environment Variables

Build once, configure per deployment. Values are baked in at build time and can be overridden
at container start; the first non-empty value wins (`src/env.ts` → `getEnv`):

1. **Runtime** — the container's environment (docker-compose `environment:` / k8s `env:`).
   `docker/entrypoint.sh` writes them into `/srv/env-config.js` (`window._env_`, loaded by
   `index.html` from `/insights/env-config.js`) at container start — a restart applies a change,
   no rebuild. Unset variables are written empty, so the baked value still applies; never give one
   a non-empty default in `entrypoint.sh`.
2. **Build time** — Vite inlines `VITE_*` into the bundle: `.env` for `npm run build`, `--build-arg`
   for the Docker image (see §8; CI sets them in
   `BuildAndPushGHCR-demo-rw.yml`).
3. Otherwise the default below.

`VITE_ROUTER_BASE` (asset paths + router basename) and `VITE_AUTH_TOKEN` are build-time only.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | _(empty)_ | Insights Service URL. Leave empty for local dev so the Vite proxy handles `/v1/insights/`; same-origin (ingress) in deployed envs. |
| `VITE_AUTH_ENABLED` | `false` | Enable Keycloak OIDC login (Authorization Code + PKCE). When `false`, the auth path is inert and the app runs unauthenticated. |
| `VITE_KEYCLOAK_URL` | _(empty)_ | Keycloak base URL. When empty, derived from `window.location.origin + '/auth'`. Set only to point at a remote/fixed Keycloak. |
| `VITE_KEYCLOAK_REALM` | `cce` | Keycloak realm. |
| `VITE_KEYCLOAK_CLIENT_ID` | `cce-insights-ui` | Public Keycloak client id. |
| `VITE_AUTH_TOKEN` | _(empty)_ | Static Bearer token fallback for local testing without an interactive login. |
| `VITE_ROUTER_BASE` | `/` (dev) | SPA router base path (`src/main.tsx`). The Docker image bakes `/insights`. |
| `VITE_POLLING_INTERVAL` | `60000` | Auto-refresh interval in milliseconds. `0` to disable. |
| `VITE_DEFAULT_DATE_RANGE_DAYS` | `90` | Default date range for dashboard (days back from today). |

---

## 4. Project Initialization (from scratch)

If scaffolding a new project:

```bash
npm create vite@latest cce-insights-ui -- --template react-ts
cd cce-insights-ui

# Core dependencies
npm install react-router-dom @tanstack/react-query recharts date-fns @heroicons/react

# Dev dependencies
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom msw
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    proxy: {
      '/v1/insights': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
    },
  },
});
```

### Tailwind Setup

```css
/* src/index.css */
@import "tailwindcss";
```

---

## 5. Project Structure

```
cce-insights-ui/
├── docker/
│   └── entrypoint.sh           # Writes /srv/env-config.js from VITE_* env at container start
├── public/
│   └── env-config.js           # Empty runtime-config placeholder for npm run dev
├── src/
│   ├── api/                    # Typed API client (12 endpoint modules + client.ts + types.ts)
│   │   ├── client.ts           # buildUrl, authHeaders (Keycloak token), handleResponse, apiGet, apiGetPaginated
│   │   ├── types.ts            # All TypeScript types (incl. ProtocolLookup)
│   │   ├── compliance.ts       # Protocol/facility/all-protocols compliance + patients
│   │   ├── dashboard.ts        # Dashboard overview + compliance summary
│   │   ├── deviations.ts       # Deviations, KPIs, trends, by-action, intelligence-summary
│   │   ├── events.ts           # Event volume, trends, by-facility, KPIs, processing quality
│   │   ├── exports.ts          # Export URL builder
│   │   ├── facilities.ts       # Facility ranking, activity-summary, reference, adoption KPIs
│   │   ├── ingestion.ts        # Ingestion funnel, rejections, quality, loss
│   │   ├── intelligence.ts     # Intelligence delivery-pipeline summary
│   │   ├── lookups.ts          # Protocol, facility, practitioner, patient lookups
│   │   ├── patients.ts         # Patient timeline, tracking, events, deviations, risk, intelligence-deliveries
│   │   ├── practitioners.ts    # Practitioner ranking
│   │   └── protocols.ts        # Step analytics, funnel, outcomes, enrollment
│   ├── auth/
│   │   └── keycloak.ts         # Keycloak OIDC init (PKCE), auto-refresh token
│   ├── assets/                 # Static images (RI-67: rwanda-moh-logo-full.png), imported via ESM
│   ├── components/
│   │   ├── layout/             # Sidebar
│   │   ├── shared/             # Card, MetricCard, StatusBadge, PageHeader, ErrorAlert,
│   │   │                       # DateRangeFilter, FacilityFilter, ProtocolFilter,
│   │   │                       # PagePagination, TableRangePagination, CursorPagination,
│   │   │                       # EmptyState, LoadingSpinner
│   │   ├── facilities/         # EbuzimaAdoptionCard, FacilityHighlightsCard, FacilityRankingCard
│   │   └── charts/             # Recharts wrapper components
│   ├── pages/                  # 12 page components (lazy-loaded)
│   ├── hooks/                  # 13 TanStack Query hooks
│   ├── context/                # FilterContext (global date range + facility)
│   ├── utils/                  # dates, colors, formatters, compliance, pagination, errors, facilityDisplay
│   ├── config.ts               # UI constants and defaults; APP_TIMEZONE (VITE_TIMEZONE)
│   ├── env.ts                  # getEnv: runtime window._env_ → build-time VITE_* → fallback
│   ├── App.tsx                 # Router + layout shell
│   ├── main.tsx                # Entry point (React 18 + providers)
│   ├── index.css               # Tailwind imports
│   └── vite-env.d.ts
├── .env.example
├── .dockerignore
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── Dockerfile
├── Caddyfile
└── docker-compose.yml
```

---

## 6. npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start dev server on port 3001 |
| `build` | `tsc -b && vite build` | Type-check + production build |
| `preview` | `vite preview` | Preview production build locally |
| `test` | `vitest` | Run tests in watch mode |
| `test:run` | `vitest run` | Run tests once (CI) |
| `lint` | `eslint .` | Lint all files |

---

## 7. Testing Setup

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

### Test Setup

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
```

### Mock Service Worker (MSW)

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/v1/insights/events/summary', () => {
    return HttpResponse.json({
      data: {
        totalEvents: 12480,
        processingStatusBreakdown: { matched: 9820, zeroMatch: 2540, duplicate: 120 },
        byResourceType: [{ resourceType: 'Encounter', count: 4200 }],
        byFacility: [{ facilityId: '0002', count: 3200 }],
        bySource: [{ source: 'rhie-mediator', count: 8400 }],
      },
    });
  }),
  // ... add handlers for all endpoints
];
```

### Test File Location Convention

```
src/
├── api/
│   └── __tests__/
│       └── client.test.ts
├── components/
│   └── common/
│       └── __tests__/
│           └── StateBadge.test.tsx
├── hooks/
│   └── __tests__/
│       └── useEventVolume.test.ts
├── pages/
│   └── __tests__/
│       └── DashboardPage.test.tsx
└── utils/
    └── __tests__/
        ├── colors.test.ts
        ├── dates.test.ts
        └── compliance.test.ts
```

---

## 8. Docker Build

### Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .

# Build-time config (Vite inlines VITE_* into the bundle). Pass per-environment via --build-arg.
ARG VITE_API_BASE_URL=""
ARG VITE_AUTH_ENABLED="false"
ARG VITE_KEYCLOAK_URL=""
ARG VITE_KEYCLOAK_REALM="cce"
ARG VITE_KEYCLOAK_CLIENT_ID="cce-insights-ui"
ARG VITE_ROUTER_BASE="/insights"
ARG VITE_TIMEZONE="UTC"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_AUTH_ENABLED=$VITE_AUTH_ENABLED \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID \
    VITE_ROUTER_BASE=$VITE_ROUTER_BASE \
    VITE_TIMEZONE=$VITE_TIMEZONE
RUN npm run build

# Production stage
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
# Writes /srv/env-config.js from the container's VITE_* env, then starts Caddy
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
COPY --from=build /app/dist /srv
EXPOSE 3001
CMD ["/entrypoint.sh"]
```

> **Build args are defaults, not the only option.** The values baked by `--build-arg` apply when
> the container sets nothing; any of them except `VITE_ROUTER_BASE` / `VITE_AUTH_TOKEN` can be
> overridden at container start via `environment:` / k8s `env:`, without a rebuild.

### Caddyfile

```caddyfile
:3001 {
    encode zstd gzip

    handle /v1/insights/* {
        reverse_proxy cce-insights-service:8084
    }

    handle {
        root * /srv
        @assets path /assets/*
        header @assets Cache-Control "public, max-age=31536000, immutable"

        # Runtime config is regenerated at every container start — never cache it.
        @envconfig path /env-config.js
        header @envconfig Cache-Control "no-cache"
        try_files {path} /index.html
        file_server
    }

    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  cce-insights-ui:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: cce-insights-ui
    ports:
      - "3001:3001"
    networks:
      - cce-net
    environment:
      - VITE_AUTH_ENABLED=true
      - VITE_KEYCLOAK_URL=http://keycloak.local:8189/auth
      - VITE_KEYCLOAK_REALM=cce
      - VITE_KEYCLOAK_CLIENT_ID=cce-insights-ui
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  cce-net:
    external: true
    name: deploy-scripts_cce-net
```

> **Note:** The UI container joins the existing `deploy-scripts_cce-net` Docker network where
> `cce-insights-service` is already running. No gateway required for local development.
>
> The `environment:` block above takes effect at container start (`docker/entrypoint.sh` →
> `/srv/env-config.js`) and overrides the values baked in with `--build-arg`; leave a variable out
> to keep the baked value.

### Build & Run

```bash
# Gateway-less (no auth) — fine for local/demo
docker build -t cce-insights-ui:latest .

# Auth-enabled image (Keycloak + gateway) — pass build args:
docker build -t cce-insights-ui:latest \
  --build-arg VITE_AUTH_ENABLED=true \
  --build-arg VITE_KEYCLOAK_REALM=cce \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=cce-insights-ui \
  .

docker run -p 3001:3001 cce-insights-ui:latest
```

---

## 9. Demo Workflow

Step-by-step sequence for a live demo:

1. **Start infrastructure**: `docker compose up -d` (PostgreSQL + Kafka)
2. **Start Collector Service**: `./gradlew bootRun` (port 8081)
3. **Start Compliance Service**: `./gradlew bootRun` (port 8080)
4. **Load protocol definitions**: Run the protocol loading Postman collection
5. **Submit clinical events**: Use the Emitter Adaptor or Postman to submit patient events
6. **Wait for compliance processing**: Events flow through Kafka → Compliance Service → PostgreSQL
7. **Start Insights Service**: `./gradlew bootRun` (port 8084)
8. **Start Insights UI**: `npm run dev` (port 3001)
9. **Open dashboard**: http://localhost:3001
10. **Navigate**: Dashboard → Compliance → Protocol Analytics → Deviations → Events → Facilities → Ingestion

### Key Demo Scenarios

| Scenario | Navigation |
|----------|------------|
| Protocol compliance overview | `/compliance` → select protocol |
| Step-level performance bottleneck | `/compliance/protocols/{id}` → step analytics + funnel |
| Patient at-risk identification | `/compliance/patients` → filter by `non_compliant` |
| Individual patient journey | `/compliance/patients/{id}` → timeline + events |
| Deviation trend analysis | `/deviations` → trends chart + by-action table |
| Event volume by resource type | `/events` → By Resource Type tab |
| Facility performance comparison | `/facilities` → ranking chart |
| Ingestion health check | `/ingestion` → funnel + rejection reasons |
| Data export | `/exports` → configure + download |
