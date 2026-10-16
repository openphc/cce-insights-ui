# CCE Insights UI

**Analytics dashboard** for the Clinical Care Engine (CCE) platform. Consumes REST endpoints from the CCE Insights Service to provide compliance analytics, deviation trends, event volume metrics, facility rankings, practitioner analytics, intelligence delivery monitoring, and ingestion pipeline monitoring. Compliance categories are binary: **Compliant** (`on_track`) and **Non-Compliant** (`non_compliant`). Default date range: **90 days** (`VITE_DEFAULT_DATE_RANGE_DAYS`).

## Architecture

```
# Demo (local Docker — no gateway)
Browser → :3001 → Caddy (cce-insights-ui container)
                    ├── static assets (React SPA)
                    └── /v1/insights/* → proxy → cce-insights-service:8084 → PostgreSQL (read-only)

# Production (with gateway)
Browser → :3001 → CCE Gateway (OAuth, :8060) → Insights Service (:8084) → PostgreSQL (read-only)
```

| Component | Technology |
|-----------|------------|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 6 |
| Routing | React Router 7 |
| Server State | TanStack Query 5 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 2 |
| Icons | Heroicons 2 |
| Dates | date-fns 4 |
| Auth | Keycloak OIDC (keycloak-js, PKCE) → Bearer token |
| Testing | Vitest + Testing Library + MSW |

## Quick Start

```bash
# Prerequisites: Insights Service running on port 8084
npm install
npm run dev          # http://localhost:3001
```

## Pages (13 routes)

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Dashboard | Overview metrics (Tracked Cohort, Compliant/Non-Compliant Care Journeys), trend sparklines |
| `/compliance` | Compliance Overview | Protocol compliance summary, vertical timeline (Service Workflow Compliance), patient list |
| `/compliance/protocols/:id` | Protocol Analytics | Step analytics, completion funnel, outcomes, enrollment trends |
| `/compliance/patients` | Patient List | Patients by compliance status (Compliant/Non-Compliant only) |
| `/compliance/patients/:id` | Patient Detail | Timeline, protocol journey with source color-coded pills, events, deviations |
| `/deviations` | Deviations | Trends, most-deviated steps, resolution rate |
| `/events` | Event Volume | Volume by resource type, facility, practitioner, source |
| `/events/source-comparison` | Source Comparison | Compare two source systems for overlap |
| `/facilities` | Facility Analytics | Facility rankings, color-coded compliance, non-compliant hotspots |
| `/practitioners` | Practitioner Analytics | Practitioner compliance table with color-coded legend |
| `/intelligence` | Intelligence | Action instances, delivery status donut, destinations, adaptors, actions table |
| `/ingestion` | Ingestion Pipeline | Funnel, rejections, source quality, pipeline loss |
| `/exports` | Exports | Download compliance data as CSV/JSON |

## Insights Service Endpoints Consumed

| Group | Endpoints | Path Prefix |
|-------|-----------|-------------|
| Dashboard | 2 | `/v1/insights/dashboard/` |
| Compliance Summaries | 3 | `/v1/insights/protocols/`, `/v1/insights/facilities/` |
| Patient Compliance | 5 | `/v1/insights/patients/` |
| Deviations & Intelligence | 5 | `/v1/insights/deviations/`, `/v1/insights/intelligence/` |
| Event Volume | 8 | `/v1/insights/events/` |
| Protocol Analytics | 5 | `/v1/insights/protocols/{id}/` |
| Facility Analytics | 1 | `/v1/insights/facilities/ranking` |
| Practitioner Analytics | 1 | `/v1/insights/practitioners/` |
| Ingestion Analytics | 4 | `/v1/insights/ingestion/` |
| Lookups | 5 | `/v1/insights/lookups/` |
| Export | 1 | `/v1/insights/exports/` |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Overview](docs/architecture-overview.md) | System context, tech stack, data flow, routing |
| [Pages & Wireframes](docs/pages-and-wireframes.md) | ASCII wireframes for all 11 pages |
| [API Integration](docs/api-integration.md) | TypeScript types, API modules, TanStack Query hooks |
| [Developer Setup](docs/developer-setup.md) | Prerequisites, quick start, Docker, testing |
| [Deployment Guide](docs/deployment-guide.md) | Docker build, Caddy config, network, troubleshooting |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | _(empty — relative)_ | Insights Service base URL. Empty = relative URLs (Caddy proxy). Set `http://localhost:8084` for local dev without Docker. |
| `VITE_AUTH_ENABLED` | `false` | Keycloak login + Bearer token (demo mode = false) |
| `VITE_KEYCLOAK_URL` | _(empty)_ | Empty = same origin + `/auth` |
| `VITE_KEYCLOAK_REALM` | `cce` | Keycloak realm |
| `VITE_KEYCLOAK_CLIENT_ID` | `cce-insights-ui` | Public OIDC client (PKCE S256) |
| `VITE_AUTH_TOKEN` | _(empty)_ | Static Bearer token fallback for local testing |
| `VITE_POLLING_INTERVAL` | `60000` | Auto-refresh interval (ms) |
| `VITE_DEFAULT_DATE_RANGE_DAYS` | `90` | Default dashboard date range |
| `VITE_TIMEZONE` | `UTC` | IANA display timezone (e.g. `Africa/Kigali`) |

In Docker every variable except `VITE_AUTH_TOKEN` can be overridden at container start, without a rebuild — see the [Deployment Guide](docs/deployment-guide.md#environment-variables).

## Build & Deploy

```bash
npm run build                       # Production build → dist/
npm run preview                     # Preview production build locally

# Docker (requires cce-insights-service on deploy-scripts_cce-net)
docker compose up -d --build        # Build + deploy → http://localhost:3001
docker compose down                 # Stop
docker compose up -d --build --force-recreate  # Rebuild after code changes
```
