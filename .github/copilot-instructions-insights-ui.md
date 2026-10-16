# CCE Insights UI — AI Agent Instructions

## What Is This Service?

The **Insights UI** is a React analytics dashboard that consumes the **CCE Insights Service REST APIs** (33 endpoints) to provide compliance analytics, deviation trends, event volume metrics, facility rankings, patient risk analysis, and ingestion pipeline monitoring. It replaces ad-hoc Grafana dashboards with a purpose-built, operational intelligence interface.

This is the **Analytics UI** referenced in the CCE Solution Design §7.2.5. It reads from the Insights Service (port 8084) via the CCE Gateway. The Insights Service is a read-only analytics backend that queries the shared PostgreSQL database.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  Insights UI    │────▶│ CCE Gateway  │────▶│ Insights Service    │
│  (React 18)     │     │  (port 8060) │     │  (port 8084)        │
│  port 3001      │     │  OAuth +     │     │  REST APIs (33)     │
│                 │     │  routing     │     │  /v1/insights/...   │
└─────────────────┘     └──────────────┘     └─────────────────────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │ PostgreSQL   │
                                                │ cce_collector│
                                                │ (read-only)  │
                                                └──────────────┘
```

**Demo mode**: The UI can connect directly to the Insights Service (bypassing the gateway) using an environment variable. No OAuth token is needed in demo mode.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.x | UI framework |
| **TypeScript** | 5.x | Type safety |
| **Vite** | 6.x | Build tool + dev server |
| **React Router** | 7.x | Client-side routing |
| **TanStack Query** | 5.x | Server state management, caching, auto-refresh |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **Heroicons** | 2.x | Icon set |
| **date-fns** | 4.x | Date formatting and computation |
| **Recharts** | 2.x | Charts — bar, line, area, pie, funnel, heatmap |

## Key Conventions

- **No component libraries** (no MUI, Ant, Chakra) — Tailwind utility classes only
- **No Redux or Zustand** — TanStack Query handles all server state; React context for minimal UI state (sidebar, date range, selected filters)
- **No authentication in demo mode** — set `VITE_AUTH_ENABLED=false` (default)
- **Every API call goes through `src/api/` module** — typed fetch wrappers per resource
- **All dates displayed in local timezone** with UTC tooltip on hover
- **Polling for live data** — TanStack Query `refetchInterval` on dashboard views (configurable, default 60s)
- **Responsive layout** — desktop-first, usable on tablet
- **Global date range filter** — persistent across pages via React context; defaults to last 90 days
- **Global facility filter** — optional facility selector in header; when set, scoped to all API calls
- **Cursor-based pagination** — follows CCE `{ data: [...], pagination: { limit, next_cursor, has_more } }` envelope
- **Response envelope handling** — all API responses wrapped in `{ "data": ... }`; API client unwraps automatically
- **Color-coded compliance categories everywhere**:
  - `on_track` → green
  - `at_risk` → amber/orange
  - `non_compliant` → red
- **Color-coded step states**:
  - `PENDING` → gray, `DUE` → blue, `OVERDUE` → amber, `MISSED` → red, `COMPLETED` → green, `SKIPPED` → slate
- **Color-coded deviation types**:
  - `OVERDUE` → amber/warning, `MISSED` → red/critical
- **Color-coded processing statuses**:
  - `MATCHED` → green, `ZERO_MATCH` → amber, `DUPLICATE` → gray

## Pages (11 routes)

| Route | Page | Primary APIs | Purpose |
|---|---|---|---|
| `/` | Dashboard | Multiple summary endpoints | Overview metrics, quick navigation |
| `/compliance` | Compliance Overview | `GET /v1/insights/protocols/{id}/compliance-summary`, `GET /v1/insights/facilities/{id}/compliance-summary` | Protocol/facility compliance rates |
| `/compliance/protocols/:id` | Protocol Analytics | `GET /v1/insights/protocols/{id}/step-analytics`, `/completion-funnel`, `/outcome-distribution`, `/enrollment-trends` | Deep-dive protocol performance |
| `/compliance/patients` | Patient List | `GET /v1/insights/protocols/{id}/patients`, `GET /v1/insights/patients/at-risk-hotspots` | Patient compliance status, risk hotspots |
| `/compliance/patients/:patientId` | Patient Detail | `GET /v1/insights/patients/{id}/compliance-timeline`, `/protocol-tracking`, `/events`, `/deviations` | Individual patient journey & events |
| `/deviations` | Deviations | `GET /v1/insights/deviations`, `/trends`, `/by-action`, `/resolution-rate`, `/v1/insights/intelligence/summary` | Deviation analytics & trends |
| `/events` | Event Volume | `GET /v1/insights/events/summary`, `/trends`, `/by-resource-type`, `/by-facility`, `/by-practitioner`, `/by-source` | Clinical event metrics |
| `/events/source-comparison` | Source Comparison | `GET /v1/insights/events/source-comparison` | Compare two source systems |
| `/facilities` | Facility Analytics | `GET /v1/insights/facilities/ranking`, `GET /v1/insights/patients/at-risk-hotspots` | Facility leaderboard & patient risk |
| `/ingestion` | Ingestion Pipeline | `GET /v1/insights/ingestion/funnel`, `/rejections`, `/source-quality`, `/pipeline-loss` | Ingestion health monitoring |
| `/exports` | Exports | `GET /v1/insights/exports/compliance-report` | Data export (CSV/JSON) |

## Project Structure (~60 files)

```
src/
├── api/                              # Typed API client layer
│   ├── client.ts                     # Base fetch wrapper (base URL, headers, error handling)
│   ├── compliance.ts                 # Compliance summary & patient compliance APIs
│   ├── deviations.ts                 # Deviation analytics APIs
│   ├── events.ts                     # Event volume & source comparison APIs
│   ├── facilities.ts                 # Facility ranking API
│   ├── ingestion.ts                  # Ingestion pipeline analytics APIs
│   ├── patients.ts                   # Patient risk analytics APIs
│   ├── protocols.ts                  # Protocol analytics APIs
│   ├── exports.ts                    # Export API
│   └── types.ts                      # Shared API response types (~30 DTOs)
├── components/                       # Reusable UI components
│   ├── layout/
│   │   ├── AppLayout.tsx             # Sidebar + header + main content shell
│   │   ├── Sidebar.tsx               # Navigation sidebar with section groups
│   │   ├── Header.tsx                # Top bar with date range & facility filters
│   │   └── FilterBar.tsx             # Global date range + facility filter context
│   ├── common/
│   │   ├── StateBadge.tsx            # Step state color chip
│   │   ├── ComplianceBadge.tsx       # on_track / at_risk / non_compliant badge
│   │   ├── DeviationTypeBadge.tsx    # OVERDUE (amber) / MISSED (red) badge
│   │   ├── ProcessingStatusBadge.tsx # MATCHED / ZERO_MATCH / DUPLICATE badge
│   │   ├── MetricCard.tsx            # Stat card with label, value, trend indicator
│   │   ├── TrendSparkline.tsx        # Inline mini chart for metric trends
│   │   ├── DateDisplay.tsx           # Local date with UTC tooltip
│   │   ├── DateRangePicker.tsx       # Date range selector (presets + custom)
│   │   ├── PercentageBar.tsx         # Horizontal stacked percentage bar
│   │   ├── DataTable.tsx             # Generic paginated table with sort/filter
│   │   ├── CursorPagination.tsx      # Cursor-based pagination controls
│   │   ├── EmptyState.tsx            # No data placeholder
│   │   └── LoadingSpinner.tsx        # Loading indicator
│   ├── charts/
│   │   ├── ComplianceRateChart.tsx   # Bar chart — compliance rates by protocol
│   │   ├── DeviationTrendChart.tsx   # Area chart — deviation trends over time
│   │   ├── EventVolumeTrendChart.tsx # Stacked area — event volume by resource type
│   │   ├── CompletionFunnelChart.tsx # Funnel chart — step drop-off
│   │   ├── OutcomeDistributionChart.tsx # Pie/donut — protocol outcomes
│   │   ├── FacilityRankingChart.tsx  # Horizontal bar — facility leaderboard
│   │   ├── ProcessingQualityChart.tsx # Stacked bar — MATCHED/ZERO_MATCH/DUPLICATE
│   │   ├── IngestionFunnelChart.tsx  # Funnel — accepted/rejected/duplicate
│   │   ├── RiskHeatmapChart.tsx      # Heatmap — at-risk hotspots by facility
│   │   └── EnrollmentTrendChart.tsx  # Line chart — enrollments over time
│   └── patient/
│       ├── ComplianceTimeline.tsx    # Vertical timeline of patient events & steps
│       ├── ProtocolTrackingCard.tsx  # Protocol instance summary card
│       ├── StepInstanceTable.tsx     # Table of step instances with state badges
│       └── PatientDeviationList.tsx  # Patient deviation history
├── pages/
│   ├── DashboardPage.tsx             # Overview metrics + quick navigation
│   ├── ComplianceOverviewPage.tsx    # Protocol & facility compliance summaries
│   ├── ProtocolAnalyticsPage.tsx     # Step analytics, funnel, outcomes, trends
│   ├── PatientListPage.tsx           # Patients by compliance status + risk hotspots
│   ├── PatientDetailPage.tsx         # Timeline, tracking, events, deviations
│   ├── DeviationsPage.tsx            # Trends, by-action, resolution rate
│   ├── EventVolumePage.tsx           # Event metrics + source comparison sub-tab
│   ├── SourceComparisonPage.tsx      # Source comparison detail
│   ├── FacilityAnalyticsPage.tsx     # Facility ranking + risk hotspots
│   ├── IngestionPage.tsx             # Ingestion funnel, rejections, quality, loss
│   └── ExportsPage.tsx               # Export configuration and download
├── hooks/
│   ├── useComplianceSummary.ts       # Protocol + facility compliance summaries
│   ├── useProtocolAnalytics.ts       # Step analytics, funnel, outcomes, enrollment trends
│   ├── usePatientCompliance.ts       # Timeline, tracking, events, deviations
│   ├── useDeviations.ts             # Deviation list, trends, by-action, resolution
│   ├── useEventVolume.ts            # Event summary, trends, by-dimension
│   ├── useFacilityRanking.ts        # Facility leaderboard
│   ├── useIngestionAnalytics.ts     # Ingestion funnel, rejections, quality, loss
│   ├── usePatientRisk.ts            # At-risk hotspots, repeat deviations
│   ├── useExport.ts                 # Export trigger
│   └── useGlobalFilters.ts          # Date range + facility context hook
├── context/
│   └── FilterContext.tsx             # Global date range + facility filter state
├── utils/
│   ├── dates.ts                      # Date formatting helpers
│   ├── colors.ts                     # State/category → Tailwind color mapping
│   ├── compliance.ts                 # Compliance rate helpers, category classification
│   ├── formatters.ts                 # Number, percentage, rate formatting
│   └── pagination.ts                 # Cursor pagination helpers
├── config.ts                         # Constants, defaults, demo presets
├── App.tsx                           # Router setup + providers
├── main.tsx                          # React entry point
├── index.css                         # Tailwind imports
└── vite-env.d.ts                     # Vite type declarations
```

## Critical Design Patterns

### 1. API Client Layer
All API calls go through typed wrappers. Never call `fetch` directly from components.
```typescript
// src/api/client.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8084';

export async function apiGet<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}/v1/insights${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    });
  }
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (import.meta.env.VITE_AUTH_ENABLED === 'true') {
    const token = sessionStorage.getItem('access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ code: 'UNKNOWN', message: `HTTP ${res.status}` }));
    throw new ApiError(res.status, body);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}
```

### 2. Global Filter Context
Date range and facility filters persist across page navigation:
```typescript
// src/context/FilterContext.tsx
interface FilterState {
  startDate: string | undefined;  // ISO 8601
  endDate: string | undefined;    // ISO 8601
  facilityId: string | undefined;
}
```
All hooks receive filter state and pass values to API calls. Changing the global filter triggers TanStack Query cache invalidation.

### 3. Compliance Category Colors
```typescript
export const COMPLIANCE_COLORS = {
  on_track:      { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  at_risk:       { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  non_compliant: { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
} as const;
```

### 4. Step State Colors
```typescript
export const STATE_COLORS = {
  pending:   { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400'   },
  due:       { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  overdue:   { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  missed:    { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
  completed: { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  skipped:   { bg: 'bg-slate-100',  text: 'text-slate-500',  dot: 'bg-slate-400'  },
} as const;
```

### 5. Cursor Pagination Pattern
The Insights Service uses cursor-based pagination:
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: { limit: number; next_cursor: string | null; has_more: boolean };
}
```

### 6. Interval Selector Pattern
Many endpoints support `interval` (daily/weekly/monthly). Use a shared `IntervalSelector` component that updates the query parameter and triggers a refetch.

## Insights Service API Endpoints Used (33)

| UI Feature | Endpoint | Notes |
|---|---|---|
| Dashboard metrics | `GET /v1/insights/events/summary` | Total events, status breakdown |
| Dashboard metrics | `GET /v1/insights/intelligence/summary` | Deviation summary |
| Protocol compliance | `GET /v1/insights/protocols/{id}/compliance-summary` | Protocol adherence rates |
| Facility compliance | `GET /v1/insights/facilities/{id}/compliance-summary` | Facility-level compliance |
| Patient list | `GET /v1/insights/protocols/{id}/patients` | Patients by compliance status |
| Patient timeline | `GET /v1/insights/patients/{id}/compliance-timeline` | Chronological compliance view |
| Patient protocols | `GET /v1/insights/patients/{id}/protocol-tracking` | All enrollments |
| Patient protocol detail | `GET /v1/insights/patients/{id}/protocol-tracking/{piId}` | Steps + deviations |
| Patient events | `GET /v1/insights/patients/{id}/events` | Clinical event history |
| Patient deviations | `GET /v1/insights/patients/{id}/deviations` | Cross-protocol deviations |
| Deviation list | `GET /v1/insights/deviations` | Paginated deviations |
| Deviation trends | `GET /v1/insights/deviations/trends` | Time-bucketed trends |
| Intelligence summary | `GET /v1/insights/intelligence/summary` | Deviation counts by type |
| Deviations by action | `GET /v1/insights/deviations/by-action` | Most-deviated steps |
| Resolution rate | `GET /v1/insights/deviations/resolution-rate` | OVERDUE→COMPLETED vs MISSED |
| Event summary | `GET /v1/insights/events/summary` | Composite event volume |
| Event trends | `GET /v1/insights/events/trends` | Volume over time |
| Events by resource type | `GET /v1/insights/events/by-resource-type` | Resource type breakdown |
| Events by facility | `GET /v1/insights/events/by-facility` | Facility event counts |
| Events by practitioner | `GET /v1/insights/events/by-practitioner` | Practitioner activity |
| Events by source | `GET /v1/insights/events/by-source` | Source system counts |
| Source comparison | `GET /v1/insights/events/source-comparison` | Overlap detection |
| Step analytics | `GET /v1/insights/protocols/{id}/step-analytics` | Per-step performance |
| Completion funnel | `GET /v1/insights/protocols/{id}/completion-funnel` | Drop-off analysis |
| Outcome distribution | `GET /v1/insights/protocols/{id}/outcome-distribution` | Terminal status breakdown |
| Enrollment trends | `GET /v1/insights/protocols/{id}/enrollment-trends` | Adoption over time |
| Facility ranking | `GET /v1/insights/facilities/ranking` | Leaderboard |
| Processing quality | `GET /v1/insights/events/processing-quality` | MATCHED/ZERO_MATCH/DUPLICATE |
| At-risk hotspots | `GET /v1/insights/patients/at-risk-hotspots` | Patient risk by facility |
| Repeat deviations | `GET /v1/insights/patients/repeat-deviations` | High-risk patients |
| Ingestion funnel | `GET /v1/insights/ingestion/funnel` | Pipeline status |
| Ingestion rejections | `GET /v1/insights/ingestion/rejections` | Rejection reason analytics |
| Source quality | `GET /v1/insights/ingestion/source-quality` | Source reliability |
| Pipeline loss | `GET /v1/insights/ingestion/pipeline-loss` | Lost event detection |
| Export | `GET /v1/insights/exports/compliance-report` | CSV/JSON export |

## Build & Run

```bash
npm install
npm run dev          # Dev server on port 3001
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8084` | Insights Service base URL (or Gateway URL) |
| `VITE_AUTH_ENABLED` | `false` | Enable OAuth (demo mode = false) |
| `VITE_POLLING_INTERVAL` | `60000` | Auto-refresh interval in ms (0 to disable) |
| `VITE_DEFAULT_DATE_RANGE_DAYS` | `90` | Default date range for dashboard (days back from today) |

## Testing

| Type | Tool | Purpose |
|---|---|---|
| Component tests | Vitest + Testing Library | Render components with mock data |
| API layer tests | Vitest + MSW (Mock Service Worker) | Mock Insights API responses |
| E2E tests | Playwright (future) | Full browser tests against running services |

## Scope Exclusions

- **No user authentication UI** — demo mode bypasses OAuth; production auth is future
- **No data mutation** — this UI is read-only; all data sources are from the Insights Service
- **No real-time WebSocket** — polling via TanStack Query is sufficient
- **No multi-language / i18n** — English only
- **No offline support / PWA** — always-connected environment
- **No Compliance Service dependency** — reads exclusively from the Insights Service
