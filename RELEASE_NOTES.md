# Release Notes — CCE Insights UI v2.0.0

**Release Date:** 2026-06-02

## Unreleased

### Step groups (CCE-135)

Follows cce-insights-service's step-group change. A step group is a set of steps that belong
together, such as one visit.

- **Patient Detail → Protocol Journey:** a group's row has a **Step group** badge. Under it, each of
  its instances is listed: its number, its status (Completed, In progress, Overdue or Missed), how
  many of its steps are done, and the day it opened. Before, a group showed as a step that never
  started.
- **One visit at a time:** the steps under a group show one of its instances, the latest by default.
  Click an instance (`#1`, `#2`, …) to show that visit's steps: their status, time, SLA, practitioner
  and facility. A nested group lists only its instances inside the shown visit. Before, a step merged
  every visit, such as "Patient Visit ×2". Needs cce-insights-service's `instances[]` on journey
  rows; without it, steps merge every visit as before.
- **Which visit** (needs cce-insights-service's `groupPath`):
  - Patient Detail: each deviation says which visit it is in, such as "In Outpatient Visit #2
    (Sep 6, 2026)", with **Show this visit**. The Step Details table has a Visit column.
  - Deviations: the list has a Visit column, and the patient link opens that visit.
- Group instances are named by number and day, such as `#2 · Sep 6, 2026`.
- The header's `x/y steps` says `· all visits` when a group has more than one instance, since the
  journey shows one at a time.
- **Protocol Analytics:** the step table counts patients (**Patients Completed**) and visits
  (**Visits Completed**) apart. A new **Step Groups** card shows each group's patients, instances
  and completed instances.
- The protocol's `x/y steps` count leaves groups out.
- **Compliance → Service Workflow Compliance:** a group shows as a container labelled "step group".
  Before, a group was left out and its steps were lifted to the nearest step above them, or to the
  top level.
  - A group inside a group, such as a consultation inside a visit, is nested inside it.
  - A group's header shows how often it opened, for how many patients, and how many of those were
    completed (needs cce-insights-service's step-analytics `groups[]`).
  - A step inside a group is measured per time it was expected, with its patients alongside, such as
    `30/150 times · 21/105 patients`. A step outside every group is measured per patient, as before.
    Every count shows its unit.
  - A group's children are "Steps", a step's "Sub-actions"; their count leaves groups out.
  - A protocol without groups, such as Kenya SHA, shows as before, apart from the units.

### CCE 2.0.0 step status model

Follows cce-insights-service `release-2.0.0`, where a step carries two independent statuses —
`stepStatus` (`NOT_STARTED` / `COMPLETED`: was it recorded?) and `slaStatus` (`OVERDUE` / `MISSED` /
`MET`, null until judged: was it on time?) — in place of 1.x's single `state` and `completionStatus`.
PENDING, DUE and SKIPPED no longer exist, and EARLY / ON_TIME are both `MET`.

- **Compliance → Transactions tiles:** Due and Pending are replaced by **Not Started** (recorded
  nothing yet) and **Not Yet Judged** (no deadline fallen due). Completed's On Time / Late split reads
  `completedOnTime` / `completedLate`. Overdue and Missed are now SLA verdicts, so they include steps
  completed after the deadline; their tooltips say so.
- **Protocol Analytics → Step table:** On Time / Late read `timelinessDistribution.completedOnTime` /
  `completedLate`.
- **Patient detail:**
  - Journey: an existing, outstanding step with no breached deadline is still shown as **Pending**,
    now derived from `status: NOT_STARTED` with a `stepStatus`; an action with no step yet stays
    **Not Started**. Every journey step is still listed, as before. ON TIME / LATE badges read the
    status pair.
  - Protocol tracking table: the status badge is derived from `stepStatus` + `slaStatus`.
- `api/types.ts`: `StepState` / `CompletionStatus` → `StepStatus`, `SlaStatus` and `StepDisplayStatus`;
  timeline types lose `step_due` / `step_pending` / `step_skipped` and gain `step_not_started`.
  `STATE_COLORS` follows; the unused `COMPLETION_COLORS` is removed. `classifyComplianceCategory`
  (`utils/compliance.ts`) reads the outstanding steps' `slaStatus`.

## Overview

Major UX refresh focused on binary compliance model (Compliant / Non-Compliant only), new pages (Intelligence, Practitioner Analytics), redesigned Service Workflow Compliance as a vertical timeline, and visual polish across all views.

## Breaking Changes

- **Compliance categories are now binary**: Only `on_track` (Compliant) and `non_compliant` (Non-Compliant). The `at_risk` category has been fully removed from the UI, API types, and backend classification logic.
- **Default date range changed to 180 days** (from 30 days). Set `VITE_DEFAULT_DATE_RANGE_DAYS` to override.
- **Keycloak dependency removed** from the API client. Auth now uses `VITE_AUTH_TOKEN` or `sessionStorage('access_token')` only.

## New Features

### New Pages

- **Intelligence** (`/intelligence`) — Action instance metrics, delivery status donut chart, destinations & adaptors tables, Intelligence Actions table
- **Practitioner Analytics** (`/practitioners`) — Practitioner compliance table with color-coded badges and legend

### Compliance Overview Redesign

- **Service Workflow Compliance** section rewritten as a vertical timeline with light cards (`bg-white`, subtle shadow)
- Each parent step shows: title (from action-order API), completion %, full-width progress bar, "X of Y completed · Z missing" stats
- Child steps (sub-actions) rendered as collapsible sub-timeline graph nodes (expanded by default, togglable)
- Timeline dots: `h-4 w-4`, solid color, `shadow-md`, `ring-3 ring-white` — green=≥80%, amber=≥50%, red=<50%
- Sub-action dots are 8px with thinner progress bars (`h-1`, `w-4/5`) to reduce visual competition with parent steps

### Dashboard

- Metric cards renamed: **Tracked Cohort**, **Compliant Care Journeys**, **Non-Compliant Care Journeys**
- Chart titles no longer display "(30 days)" — they use the global date filter
- Added facility/practitioner summary cards

### Patient Detail

- **Source color-coded pills** in Protocol Journey (spice=purple, openmrs=sky, dhis2=teal, fhir=indigo, hl7=pink)
- Removed mandatory/policy badges from step indicators
- **Protocol thumbnail images** from Google Drive now display correctly (auto-converts share/uc URLs to thumbnail API)

### Facility Analytics

- Renamed "At-Risk Hotspots" → **"Non-Compliant Hotspots"**
- Compliance column now color-coded (🟢 ≥80%, 🟡 50-79%, 🔴 <50%)
- Legend added below table

### Patient List

- Only **Compliant** and **Non-Compliant** filter buttons (removed "At Risk")
- Badge labels updated to "Compliant" / "Non-Compliant"

## Technical Changes

- **Pagination normalization**: `apiGetPaginated` now handles both camelCase (`hasMore`/`nextCursor`) and snake_case (`has_more`/`next_cursor`) from the API
- **New API modules**: `dashboard.ts`, `intelligence.ts`, `practitioners.ts`
- **New hooks**: `useDashboard.ts`, `useIntelligence.ts`, `usePractitioners.ts`
- **Sidebar navigation updated**: Dashboard → Compliance → Facilities → Practitioners → Deviations → Intelligence → Patients → Events → Ingestion → Exports
- **Removed unused code**: `DonutRing` component from ComplianceOverview, unused imports

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_DEFAULT_DATE_RANGE_DAYS` | `180` | Default date range (changed from 30) |

---

---

# Release Notes — CCE Insights UI v1.0.0

**Release Date:** 2026-03-31

## Overview

Initial release of the CCE Insights UI — an analytics dashboard for the Clinical Care Engine platform. Provides compliance analytics, deviation trends, event volume metrics, facility rankings, patient risk analysis, and ingestion pipeline monitoring by consuming 38 REST endpoints (33 analytics + 5 lookup) from the CCE Insights Service.

## Features

### Pages (11 routes)

- **Dashboard** — Overview metrics (total events, active deviations, facilities tracked, pipeline loss rate), trend sparklines, quick navigation
- **Compliance Overview** — Protocol compliance summaries with status breakdown, step metrics, patient list with status filtering
- **Protocol Analytics** — Step-level analytics table, completion funnel, outcome distribution, enrollment trends with interval toggle
- **Patient List** — Patients by compliance status, risk hotspots by facility (stacked bar chart), repeat deviation patients
- **Patient Detail** — Protocol enrollments with progress bars, step-level detail, compliance timeline, deviation list, event history
- **Deviation Analytics** — Intelligence summary, deviation trends (daily/weekly/monthly), most-deviated steps, resolution rate, paginated deviation list with type filter
- **Event Volume** — Tabbed view: by resource type (bar chart), by facility, by practitioner, by source, processing quality chart
- **Source Comparison** — Compare two source systems for event overlap with sample pairs table
- **Facility Analytics** — Ranked leaderboard (by compliance rate, deviation count, or event volume), at-risk hotspot chart
- **Ingestion Pipeline** — Acceptance/rejection funnel, rejection reasons (horizontal bars), source quality, pipeline loss alert
- **Exports** — Download compliance data as CSV or JSON with protocol/facility/date filters

### Technical

- **React 18** with TypeScript 5, lazy-loaded route-based code splitting
- **TanStack Query 5** for server state with auto-polling on key dashboards
- **Tailwind CSS 4** for utility-first styling
- **Recharts 2** for charts (area, bar, pie, funnel)
- **keycloak-js** for Keycloak OIDC authentication (PKCE, auto-refresh)
- **Cursor-based pagination** throughout all paginated views
- **Global filters** (date range + facility) applied across all data queries via React Context
- **Docker deployment** — multi-stage build (node:20 → caddy:2-alpine), Caddy reverse proxy to insights-service

### API Integration

- 38 endpoints consumed across 10 API groups (9 analytics + 1 lookups)
- Centralized API client with shared URL builder, auth header injection (`VITE_AUTH_TOKEN` or `sessionStorage`), and error handling
- Lookups API (`/lookups/protocols`, `/lookups/facilities`, `/lookups/practitioners`, `/lookups/sources`, `/lookups/patients`) for populating selectors
- Relative URL support for Docker (Caddy proxy) and absolute URL support for local development

## Docker Deployment

```bash
docker compose up -d --build
# UI available at http://localhost:3001
# API proxied to cce-insights-service:8084 on deploy-scripts_cce-net
```

## Known Limitations

- Protocol and Facility IDs are entered as free text (no dropdown selection from API)
- OAuth/gateway integration is configurable (`VITE_AUTH_ENABLED=true` + `VITE_AUTH_TOKEN`) — no gateway deployed locally
- No unit tests shipped in v1.0.0 (test infrastructure is in place with Vitest + Testing Library + MSW)

---

## Bug Fixes (post-release)

### Date format mismatch (Invalid request: undefined)
All API calls failed with `Invalid request: undefined` because the UI sent dates as `YYYY-MM-DD` but the Insights Service expects ISO 8601 `OffsetDateTime` (`2026-03-01T00:00:00Z`). The `useGlobalFilters` hook now converts dates via `toStartOfDayISO()` / `toEndOfDayISO()`.

### Error body unwrapping
The API returns errors as `{ error: { code, message } }` but `handleResponse` passed the outer object — so `body.message` was `undefined`. Fixed to unwrap `raw.error ?? raw`.

### ProtocolInstanceStatus casing (blank Patient Detail page)
The API returns `status: "ACTIVE"` (uppercase) but `STATUS_COLORS` had lowercase keys (`active`). Lookup returned `undefined`, then `color.bg` in `StatusBadge` crashed React. Changed `ProtocolInstanceStatus` type and `STATUS_COLORS` to uppercase (`ACTIVE`, `COMPLETED`, `WITHDRAWN`, `EXPIRED`). Added fallback colors for all badge lookups.

### Null-safe numeric rendering (toFixed / toLocaleString on null)
Several API fields return `null` instead of a number (`processingStatusBreakdown`, `avgDaysToResolve`, `lossRate`, etc.). All formatter functions (`formatNumber`, `formatPercentage`, `formatRate`) now accept `null | undefined` and return `'—'`. All pages guard nullable nested objects before accessing properties.

### ProcessingQuality data shape mismatch
The `processing-quality` API nests status counts under a `breakdown` object per source (`bySource[].breakdown.matched.count`) and uses `zero_match` (snake_case). The chart component now reads `d.breakdown?.matched?.count ?? 0` and handles missing fields gracefully.

### API client refactoring
Extracted shared `buildUrl()`, `authHeaders()`, and `handleResponse()` helpers from duplicated code in `apiGet` and `apiGetPaginated`. Changed default `BASE_URL` from `http://localhost:8084` to empty string (relative URLs) so Caddy proxy works in Docker. The exports module now reuses `buildUrl()` from the client.

### Caddy directive ordering
Initial Caddyfile used `try_files` and `reverse_proxy` at the same level, causing `try_files` to run before the proxy. Fixed by using `handle` blocks for proper routing precedence.

### Ingestion funnel chart colors
Both ACCEPTED and REJECTED bars rendered in black because the chart used raw `<rect>` elements instead of Recharts `<Cell>` components. Fixed to use `<Cell>` with proper color mapping: ACCEPTED (green `#22c55e`), REJECTED (red `#ef4444`).

### Auth token configuration
Added `VITE_AUTH_TOKEN` build-time environment variable for providing a gateway bearer token. When `VITE_AUTH_ENABLED=true`, the token is read from `VITE_AUTH_TOKEN` first, falling back to `sessionStorage('access_token')`.

### Keycloak OIDC integration
Added full Keycloak authentication support via `keycloak-js`. When `VITE_AUTH_ENABLED=true` and `VITE_KEYCLOAK_URL` is set, the app initializes Keycloak with Authorization Code flow + PKCE before rendering. The token is auto-refreshed every 30 seconds. Token priority: `VITE_AUTH_TOKEN` (static override) → `keycloak.token` (OIDC) → `sessionStorage('access_token')` (manual). New env variables: `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`. When Keycloak is not configured, the app renders normally (demo mode).

### Lookup API integration
Added `src/api/lookups.ts` module with 5 lookup endpoints (`/lookups/protocols`, `/lookups/facilities`, `/lookups/practitioners`, `/lookups/sources`, `/lookups/patients`) and corresponding `useLookups.ts` hook with 5-minute `staleTime` for populating protocol/facility/source selectors.
