# API Integration Reference

> **CCE Insights UI** — Complete mapping of UI features to Insights Service APIs  
> All endpoints consumed from the Insights Service (`port 8084`) directly (gateway-less/dev), or via the
> CCE Gateway when auth is enabled (JWT-validated; see `architecture-overview.md`).  
> Compliance categories are binary: `on_track` (Compliant) and `non_compliant` (Non-Compliant).
> Deviations have three types: `OVERDUE`, `MISSED`, `ORDER_VIOLATION`.

---

## Table of Contents

1. [API Client Configuration](#1-api-client-configuration)
2. [TypeScript Type Definitions](#2-typescript-type-definitions)
3. [Endpoint Reference](#3-endpoint-reference)
4. [TanStack Query Hooks](#4-tanstack-query-hooks)
5. [Error Handling](#5-error-handling)
6. [CORS Configuration](#6-cors-configuration)

---

## 1. API Client Configuration

### Base Client

```typescript
// src/api/client.ts
import type { ErrorResponse, PaginatedResponse } from './types';
import { authEnabled, getToken } from '../auth/keycloak';

const BASE_URL = getEnv('VITE_API_BASE_URL');

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ErrorResponse,
  ) {
    super(body.message);
  }
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const raw = `${BASE_URL}/v1/insights${path}`;
  const url = BASE_URL ? new URL(raw) : new URL(raw, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authEnabled) {
    // Live Keycloak access token (kept fresh by initAuth's refresh loop);
    // VITE_AUTH_TOKEN is a static fallback for local testing without a login.
    const token = getToken() || getEnv('VITE_AUTH_TOKEN');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const raw = await res.json().catch(() => ({
      code: 'UNKNOWN',
      message: `HTTP ${res.status}`,
    }));
    // API wraps errors as { error: { code, message } }
    const body = raw.error ?? raw;
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), { headers: authHeaders() });
  const json = await handleResponse(res);
  return json.data !== undefined ? json.data : json;
}

/**
 * Fetch paginated responses using the CCE cursor-based pagination envelope.
 * Normalizes both camelCase and snake_case pagination fields from the API.
 */
export async function apiGetPaginated<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<PaginatedResponse<T>> {
  const res = await fetch(buildUrl(path, params), { headers: authHeaders() });
  const json = await handleResponse(res);
  const p = json.pagination;
  return {
    data: json.data,
    pagination: p
      ? {
          limit: p.limit ?? 50,
          next_cursor: p.next_cursor ?? p.nextCursor ?? null,
          has_more: p.has_more ?? p.hasMore ?? false,
          total_count: p.total_count ?? p.totalCount ?? undefined,
        }
      : { limit: 50, next_cursor: null, has_more: false },
  };
}

export { buildUrl };
```

### Authentication (`src/auth/keycloak.ts`)

Auth is gated by `authEnabled` (`getEnv('VITE_AUTH_ENABLED') === 'true'` — baked at build time, overridable at container start). When enabled:

- `initAuth()` runs in `main.tsx` before render (`onLoad: 'login-required'`, `pkceMethod: 'S256'`),
  redirecting unauthenticated users to Keycloak (Authorization Code + PKCE).
- Keycloak URL defaults to `${window.location.origin}/auth` (override: `VITE_KEYCLOAK_URL`); realm
  default `cce` (`VITE_KEYCLOAK_REALM`), client id `cce-insights-ui` (`VITE_KEYCLOAK_CLIENT_ID`).
- A 60s interval refreshes the token (`keycloak.updateToken(70)`).
- `client.ts` reads the live token via `getToken()` and sends `Authorization: Bearer …`. The gateway
  validates issuer, audience (`gateway-service`), and the `INSIGHTS_READ` role.

When disabled, the auth path is inert (local dev / gateway-less demo). There is **no** `sessionStorage`
token. Config is read with `getEnv` (`src/env.ts`): runtime `window._env_` (written by
`docker/entrypoint.sh`) → build-time `import.meta.env.VITE_*` → default.

```typescript
// src/auth/keycloak.ts — exports
export const authEnabled: boolean;          // VITE_AUTH_ENABLED === 'true'
export async function initAuth(): Promise<void>;
export function getToken(): string | undefined;
export function getUsername(): string | undefined;
export function logout(): void;             // redirect → origin + '/insights'
```

---

## 2. TypeScript Type Definitions

```typescript
// src/api/types.ts

// ─── Response Envelopes ──────────────────────────────────────

export interface ErrorResponse {
  code: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
    total_count?: number;
  };
}

// ─── Global Filters ──────────────────────────────────────────

export interface GlobalFilters {
  startDate?: string;     // ISO 8601
  endDate?: string;       // ISO 8601
  facilityId?: string;
}

// ─── Compliance Summaries ────────────────────────────────────

export interface ComplianceSummary {
  protocolDefinitionId: string;
  protocolCanonical: string;
  totalEnrollments: number;
  compliantPatients: number;
  statusBreakdown: {
    active: number;
    completed: number;
    withdrawn: number;
    expired: number;
  };
  complianceRate: number;
  // CCE 2.0.0: stepStatus (was it recorded?) and slaStatus (was it on time?) are independent.
  // overdue / missed are SLA verdicts, so they include steps completed after the deadline.
  stepMetrics: {
    totalSteps: number;
    completed: number;        // stepStatus = COMPLETED
    notStarted: number;       // stepStatus = NOT_STARTED
    slaMet: number;
    overdue: number;
    missed: number;
    slaUnjudged: number;      // no verdict yet (no deadline due; optional steps)
    completedOnTime: number;  // COMPLETED + MET
    completedLate: number;    // COMPLETED + OVERDUE | MISSED
  };
  deviationCount: number;
  deviationBreakdown: {
    overdue: number;
    missed: number;
    orderViolation: number;
  };
}

export interface FacilitySummary {
  facilityId: string;
  totalPatients: number;
  totalEnrollments: number;
  overallComplianceRate: number;
  protocolBreakdown: {
    protocolDefinitionId: string;
    protocolCanonical: string;
    enrollments: number;
    complianceRate: number;
    activeDeviations: number;
  }[];
}

export interface PatientCompliance {
  patientId: string;
  protocolInstanceId: string;
  protocolCanonical: string;
  enrolledAt: string;
  status: ProtocolInstanceStatus;
  complianceRate: number;
  complianceCategory: ComplianceCategory;
  stepsCompleted: number;
  totalSteps: number;
  activeDeviations: number;
  facilityId: string;
}

export type ProtocolInstanceStatus = 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN' | 'EXPIRED';
export type ComplianceCategory = 'on_track' | 'non_compliant';

// ─── Patient Compliance ──────────────────────────────────────

export interface PatientTimeline {
  patientId: string;
  protocols: {
    protocolInstanceId: string;
    protocolCanonical: string;
    status: ProtocolInstanceStatus;
    complianceRate: number;
    timeline: TimelineEntry[];
  }[];
}

export interface TimelineEntry {
  timestamp: string;
  type: 'enrollment' | 'step_completed' | 'step_overdue' | 'step_missed' | 'step_not_started';
  description?: string;
  actionId?: string;
  stepStatus?: StepStatus;
  slaStatus?: SlaStatus | null;
  source?: string;
  daysOverdue?: number;
}

export interface ProtocolTracking {
  protocolInstanceId: string;
  protocolCanonical: string;
  enrolledAt: string;
  status: ProtocolInstanceStatus;
  complianceRate: number;
  stepsCompleted: number;
  totalSteps: number;
}

export interface ProtocolTrackingDetail {
  protocolInstanceId: string;
  patientId: string;
  protocolCanonical: string;
  status: ProtocolInstanceStatus;
  enrolledAt: string;
  complianceRate: number;
  steps: StepInstance[];
  deviations: DeviationRecord[];
}

export interface StepInstance {
  stepInstanceId: string;
  actionId: string;
  stepStatus: StepStatus;
  slaStatus?: SlaStatus;            // absent until the Step SLA Service reaches a verdict
  dueDate: string | null;
  overdueDate?: string;             // scheduled SLA thresholds; mandatory steps only
  missedDate?: string;
  completedAt?: string;
  completedBySource?: string;
  daysOverdue?: number;
}

export type StepStatus = 'NOT_STARTED' | 'COMPLETED';
export type SlaStatus = 'OVERDUE' | 'MISSED' | 'MET';
// One badge per step: COMPLETED, else an outstanding step's SLA verdict, else NOT_STARTED.
export type StepDisplayStatus = 'COMPLETED' | 'OVERDUE' | 'MISSED' | 'NOT_STARTED';

export interface PatientEvent {
  eventId: string;
  cloudeventsId: string;
  type: string;
  eventTime: string;
  source: string;
  resourceType: string;
  processingStatus: ProcessingStatus;
  facilityId: string | null;
  protocolInstanceId: string | null;
  actionId: string | null;
  matchedStepInstanceId: string | null;
}

export type ProcessingStatus = 'MATCHED' | 'ZERO_MATCH' | 'DUPLICATE';

export interface PatientDeviation {
  deviationId: string;
  protocolInstanceId: string;
  protocolCanonical: string;
  stepInstanceId: string;
  actionId?: string;
  stepName?: string;
  deviationType: DeviationType;
  detectedAt: string;
  description?: string;
  metadata?: {
    completedActionId?: string;
    incompletePrerequisites?: string[];
    backfilled?: boolean;
  };
}

export type DeviationType = 'OVERDUE' | 'MISSED' | 'ORDER_VIOLATION';

// ─── Deviations & Intelligence ───────────────────────────────

export interface DeviationRecord {
  deviationId: string;
  patientId: string;
  protocolInstanceId: string;
  protocolCanonical: string;
  stepInstanceId: string;
  actionId: string;
  deviationType: DeviationType;
  detectedAt: string;
  facilityId: string;
}

export interface DeviationTrend {
  interval: string;
  trends: {
    period: string;
    overdue: number;
    missed: number;
    orderViolation: number;
    total: number;
  }[];
}

export interface DeviationByAction {
  actionId: string;
  protocolDefinitionId: string;
  protocolCanonical: string;
  totalDeviations: number;
  overdueCount: number;
  missedCount: number;
  orderViolationCount: number;
  affectedPatients: number;
}

// KPI counts for the Deviations page header cards.
export interface DeviationKpis {
  totalDeviations: number;
  overdueCount: number;
  missedCount: number;
  orderViolationCount: number;
}

export interface DeviationResolution {
  totalOverdueDeviations: number;
  resolved: {
    count: number;
    percentage: number;
    avgDaysToResolve: number;
  };
  escalatedToMissed: {
    count: number;
    percentage: number;
  };
  byProtocol: {
    protocolDefinitionId: string;
    protocolCanonical: string;
    totalOverdue: number;
    resolvedCount: number;
    resolutionRate: number;
    escalatedCount: number;
  }[];
}

// NOTE: there are TWO distinct IntelligenceSummary types.
// (1) types.ts — deviation counts; returned by deviations.ts → getIntelligenceSummary.
export interface IntelligenceSummary {
  totalDeviations: number;
  byType: { overdue: number; missed: number; orderViolation: number };
  bySeverity: { warning: number; critical: number };
  recentActivity: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}
// (2) intelligence.ts declares its OWN IntelligenceSummary (delivery-pipeline shaped:
//     total, delivered, failed, pending, successRate, avgLatencySeconds, byStatus[],
//     byActionType[], bySeverity[], byDestination[], activeAdaptors[]). See §3.11.

// ─── Event Volume ────────────────────────────────────────────

export interface EventVolumeSummary {
  totalEvents: number;
  // Each bucket is an optional { count, percentage } object; the whole field may be null.
  processingStatusBreakdown: {
    matched?: { count: number; percentage: number };
    zeroMatch?: { count: number; percentage: number };
    duplicate?: { count: number; percentage: number };
  } | null;
  byResourceType: { resourceType: string; count: number }[];
  byFacility: { facilityId: string; count: number }[];
  bySource: { source: string; count: number }[];
}

export interface EventVolumeTrend {
  interval: string;
  trends: {
    period: string;
    total: number;
    byResourceType: Record<string, number>;
  }[];
}

export interface ResourceTypeCount {
  resourceType: string;
  count: number;
  percentage: number;
}

export interface FacilityEventCount {
  facilityId: string;
  totalEvents: number;
  byResourceType: { resourceType: string; count: number }[];
}

// ─── Protocol Analytics ──────────────────────────────────────

export interface StepAnalytics {
  protocolDefinitionId: string;
  protocolCanonical: string;
  steps: {
    actionId: string;
    totalInstances: number;
    completedCount: number;
    completionRate: number;        // 0–1 fraction (completedCount / totalInstances)
    timelinessDistribution: {
      completedOnTime: number;
      completedLate: number;
    };
    overdueCount: number;       // SLA verdicts — include steps completed late
    missedCount: number;
    notStartedCount: number;
    slaUnjudgedCount: number;
    avgDaysToComplete: number;     // days from due date to completion; negative = early
    medianDaysToComplete: number;
  }[];
}

export interface CompletionFunnel {
  protocolDefinitionId: string;
  protocolCanonical: string;
  totalEnrollments: number;
  funnel: {
    actionId: string;
    stepOrder: number;
    reachedCount: number;
    completedCount: number;
    completionRate: number;
    dropOffRate: number;
  }[];
}

export interface OutcomeDistribution {
  protocolDefinitionId: string;
  protocolCanonical: string;
  totalInstances: number;
  distribution: {
    active: { count: number; percentage: number };
    completed: { count: number; percentage: number };
    expired: { count: number; percentage: number };
    withdrawn: { count: number; percentage: number };
  };
}

export interface EnrollmentTrend {
  protocolDefinitionId: string;
  interval: string;
  trends: {
    period: string;
    enrollments: number;
  }[];
}

// ─── Facility Analytics ──────────────────────────────────────

export interface FacilityRanking {
  rank: number;
  facilityId: string;
  facilityName?: string;
  totalEnrollments: number;
  complianceRate: number;
  activeDeviations: number;
  totalEvents: number;
  outboundEvents: number;
  inboundEvents: number;
  patientsFromHIE: number;
}

export type RankBy = 'complianceRate' | 'deviationCount' | 'eventVolume';
export type SortOrder = 'asc' | 'desc';

// ─── Patient Risk ────────────────────────────────────────────

export interface AtRiskHotspot {
  facilityId: string;
  totalPatients: number;
  onTrack: { count: number; percentage: number };
  atRisk: { count: number; percentage: number };
  nonCompliant: { count: number; percentage: number };
}

export interface RepeatDeviationPatient {
  patientId: string;
  totalDeviations: number;
  overdueCount: number;
  missedCount: number;
  orderViolationCount: number;
  affectedProtocols: number;
  affectedSteps: number;
  facilityId: string;
  deviations: {
    protocolCanonical: string;
    actionId: string;
    deviationType: DeviationType;
    detectedAt: string;
  }[];
}

// ─── Ingestion Analytics ─────────────────────────────────────

export interface IngestionFunnel {
  totalReceived: number;
  accepted: number;
  rejected: number;
  duplicate: number;
  acceptanceRate: number;
  rejectionRate: number;
  duplicateRate: number;
  breakdown: { status: string; count: number; percentage: number }[];
  trends?: {
    period: string;
    byStatus: Record<string, number>;
    total: number;
  }[];
}

export interface RejectionAnalytics {
  totalRejected: number;
  byReason: {
    reason: string;
    count: number;
    percentage: number;
  }[];
  bySource: {
    source: string;
    totalEvents: number;
    rejectedEvents: number;
    rejectionRate: number;
    topReasons: { reason: string; count: number; percentage: number }[];
  }[];
}

export type RejectionReason =
  | 'INVALID_ENVELOPE'
  | 'INVALID_FHIR'
  | 'INVALID_JSON'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'DUPLICATE'
  | 'MISSING_SUBJECT'
  | 'PAYLOAD_TOO_LARGE'
  | 'DESERIALIZATION_ERROR'
  | 'KAFKA_PUBLISH_FAILURE'
  | 'INTERNAL_ERROR';

export interface SourceDataQuality {
  sources: {
    source: string;
    totalEvents: number;
    accepted: number;
    rejected: number;
    duplicate: number;
    acceptanceRate: number;
    rejectionRate: number;
    duplicateRate: number;
  }[];
}

export interface PipelineLoss {
  totalAcceptedByCollector: number;
  totalInComplianceEventLog: number;
  lostEvents: number;
  lossRate: number;
  bySource: { source: string; lostEvents: number }[];
}

// ─── Journey / timeline additions ────────────────────────────
// PatientTimeline.protocols[] now also carries a journey: JourneyStep[] alongside timeline.
export interface JourneyStep {
  actionId: string;
  stepName?: string;
  status: StepDisplayStatus;
  stepStatus?: StepStatus | null;   // null for an action with no step instance yet
  slaStatus?: SlaStatus | null;
  depth?: number;            // 0 = root step; >0 = sub-step (used by PatientDetail visibility rules)
  dueDate?: string | null;
  completedAt?: string | null;
  completedBySource?: string | null;
  effectiveDateTime?: string;
}
// TimelineEntry entries may also carry stepName?, state?: StepDisplayStatus | 'ENROLLED',
// effectiveDateTime?. (2.0.0 dropped step_due / step_pending / step_skipped.)

// ─── KPI / analytics additions ───────────────────────────────
export interface EventKpis { /* cumulative event pipeline KPIs incl. pipeline loss */ }
export interface AdoptionKpi { facilityId: string; facilityName: string; district: string;
  /* RI-33 — period totals for the selected range, not per-day: */
  expectedVisits: number; actualVisits: number; adoptionRate: number; reportingGap: number; }
export interface FacilityActivitySummary { totalInScope: number; activeFacilities: number; inactiveFacilities: number; /* … */ }
export interface FacilityReference { facilityId: string; facilityName: string; /* … */ }
export interface FacilityLookup { facilityId: string; facilityName: string; }
export interface ProtocolLookup { protocolDefinitionId: string; protocolCanonical: string; title?: string; }
export interface PractitionerRanking { rank: number; practitionerId: string; practitionerName?: string; facilityId?: string; patientsServed: number; stepCompletionRate: number; stepsCompleted: number; totalSteps: number; }
export type PractitionerRankBy = 'stepCompletion' | 'patientsServed';
export interface PatientIntelligenceDelivery { actionId: string; status: string; destination?: string; deliveredAt?: string; /* … */ }
export interface ActionOrderEntry { actionId: string; stepOrder: number; title?: string; trigger?: string; parentStep?: string; }
// FacilityRanking-adjacent: AtRiskHotspot now also has facilityName?; StepAnalytics steps add
// requiredBehavior?: 'must' | 'could'; ProtocolTracking adds protocolTitle?, relatedArtifact?;
// ProtocolTrackingDetail adds protocolDefinitionId?.
```

---

## 3. Endpoint Reference

### 3.1 Compliance Summaries

```typescript
// src/api/compliance.ts
import { apiGet, apiGetPaginated } from './client';
import type {
  ComplianceSummary, FacilitySummary, PatientCompliance,
  PatientTimeline, ProtocolTracking, ProtocolTrackingDetail,
  PatientEvent, PatientDeviation, GlobalFilters,
} from './types';

// Aggregate across ALL protocols (used when no specific protocol is selected).
export function getAllProtocolsComplianceSummary(
  filters?: GlobalFilters,
): Promise<ComplianceSummary> {
  return apiGet('/protocols/compliance-summary', {
    facilityId: filters?.facilityId,
    startDate: filters?.startDate,
    endDate: filters?.endDate,
  });
}

export function getProtocolComplianceSummary(
  protocolDefinitionId: string,
  filters?: GlobalFilters,
): Promise<ComplianceSummary> {
  return apiGet(`/protocols/${encodeURIComponent(protocolDefinitionId)}/compliance-summary`, {
    facilityId: filters?.facilityId,
    startDate: filters?.startDate,
    endDate: filters?.endDate,
  });
}

export function getFacilityComplianceSummary(
  facilityId: string,
  params?: { protocolDefinitionId?: string; startDate?: string; endDate?: string },
): Promise<FacilitySummary> {
  return apiGet(`/facilities/${encodeURIComponent(facilityId)}/compliance-summary`, {
    protocolDefinitionId: params?.protocolDefinitionId,
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

export function getProtocolPatients(
  protocolDefinitionId: string,
  params?: {
    status?: string;
    facilityId?: string;
    limit?: number;
    cursor?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
    dateFilterMode?: 'enrollment' | 'activity';
  },
) {
  return apiGetPaginated<PatientCompliance>(
    `/protocols/${encodeURIComponent(protocolDefinitionId)}/patients`,
    {
      status: params?.status,
      facilityId: params?.facilityId,
      limit: (params?.limit ?? 15).toString(),
      cursor: params?.cursor,
      patientId: params?.patientId,
      startDate: params?.startDate,
      endDate: params?.endDate,
      // 'enrollment' (default) — cohort = enrolled in period
      // 'activity'   — cohort = patients with step activity in period
      dateFilterMode: params?.dateFilterMode ?? 'enrollment',
    },
  );
}
```

### 3.2 Patient Compliance

```typescript
// src/api/patients.ts
import { apiGet } from './client';
import type {
  PatientTimeline, ProtocolTracking, ProtocolTrackingDetail,
  PatientEvent, PatientDeviation,
} from './types';

export function getPatientTimeline(
  patientId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<PatientTimeline> {
  return apiGet(`/patients/${encodeURIComponent(patientId)}/compliance-timeline`, {
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

export function getPatientProtocolTracking(patientId: string): Promise<ProtocolTracking[]> {
  return apiGet(`/patients/${encodeURIComponent(patientId)}/protocol-tracking`);
}

// RI-44 — patients behind the "Referrals Received by HIE" indicator (event_time-scoped).
// PatientReferral: { patientId, facilityId, facilityName, lastReferral, referralCount, matchedCount }
// RI-51: this endpoint (distinct *patients*) is no longer used by the Dashboard — "Total Referrals"
// now reads the event-count KPI (getReferralsKpi → /dashboard/referrals) so it agrees with the
// Facility Ranking column + Facilities "Referral Details" card. This function has no live caller
// today; kept for the (currently unmounted) PatientReferralCards strip.
export function getReferralsReceivedByHie(filters?: GlobalFilters): Promise<PatientReferral[]> {
  return apiGet('/patients/referrals/received-by-hie', {
    startDate: filters?.startDate,
    endDate: filters?.endDate,
  });
}

export function getPatientProtocolTrackingDetail(
  patientId: string,
  protocolInstanceId: string,
): Promise<ProtocolTrackingDetail> {
  return apiGet(
    `/patients/${encodeURIComponent(patientId)}/protocol-tracking/${encodeURIComponent(protocolInstanceId)}`,
  );
}

export function getPatientEvents(
  patientId: string,
  params?: {
    resourceType?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  },
): Promise<PatientEvent[]> {
  return apiGet(`/patients/${encodeURIComponent(patientId)}/events`, {
    resourceType: params?.resourceType,
    source: params?.source,
    startDate: params?.startDate,
    endDate: params?.endDate,
    limit: params?.limit?.toString(),
  });
}

export function getPatientDeviations(
  patientId: string,
  params?: { deviationType?: string; startDate?: string; endDate?: string },
): Promise<PatientDeviation[]> {
  return apiGet(`/patients/${encodeURIComponent(patientId)}/deviations`, {
    deviationType: params?.deviationType,
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

// Intelligence-alert deliveries for the patient (Patient Detail → Intelligence Alerts card).
export function getPatientIntelligenceDeliveries(
  patientId: string,
): Promise<PatientIntelligenceDelivery[]> {
  return apiGet(`/patients/${encodeURIComponent(patientId)}/intelligence-deliveries`);
}
```

### 3.3 Deviations & Intelligence

```typescript
// src/api/deviations.ts
import { apiGet, apiGetPaginated } from './client';
import type {
  DeviationRecord, DeviationTrend, DeviationByAction, DeviationByFacility,
  DeviationResolution, DeviationKpis, IntelligenceSummary,
} from './types';

// KPI counts for the Deviations page header cards.
export function getDeviationKpis(params?: {
  protocolDefinitionId?: string;
  facilityId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DeviationKpis> {
  return apiGet('/deviations/kpis', {
    protocolDefinitionId: params?.protocolDefinitionId,
    facilityId: params?.facilityId,
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

export function getDeviations(params?: {
  deviationType?: string;
  facilityId?: string;
  protocolDefinitionId?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  limit?: number;
  cursor?: string;
}) {
  return apiGetPaginated<DeviationRecord>('/deviations', {
    deviationType: params?.deviationType,
    facilityId: params?.facilityId,
    protocolDefinitionId: params?.protocolDefinitionId,
    startDate: params?.startDate,
    endDate: params?.endDate,
    sort: params?.sort,
    limit: params?.limit?.toString(),
    cursor: params?.cursor,
  });
}

export function getDeviationTrends(params?: {
  interval?: string;
  facilityId?: string;
  protocolDefinitionId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DeviationTrend> {
  return apiGet('/deviations/trends', {
    interval: params?.interval,
    facilityId: params?.facilityId,
    protocolDefinitionId: params?.protocolDefinitionId,
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

export function getDeviationsByAction(params?: {
  protocolDefinitionId?: string;
  deviationType?: string;
  facilityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<DeviationByAction[]> {
  return apiGet('/deviations/by-action', {
    protocolDefinitionId: params?.protocolDefinitionId,
    deviationType: params?.deviationType,
    facilityId: params?.facilityId,
    startDate: params?.startDate,
    endDate: params?.endDate,
    limit: params?.limit?.toString(),
  });
}

// RI-34 — "Deviations by Facility and Type" chart (Deviations page).
export function getDeviationsByFacility(params?: {
  facilityId?: string;
  district?: string;
  protocolDefinitionId?: string;
  startDate?: string;
  endDate?: string;
  deviationType?: string;
  limit?: number;
  cursor?: string;
}) {
  return apiGetPaginated<DeviationByFacility>('/deviations/by-facility', {
    facilityId: params?.facilityId,
    district: params?.district,
    protocolDefinitionId: params?.protocolDefinitionId,
    startDate: params?.startDate,
    endDate: params?.endDate,
    deviationType: params?.deviationType,
    limit: params?.limit?.toString(),
    cursor: params?.cursor,
  });
}

export function getDeviationResolutionRate(params?: {
  protocolDefinitionId?: string;
  facilityId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DeviationResolution> {
  return apiGet('/deviations/resolution-rate', {
    protocolDefinitionId: params?.protocolDefinitionId,
    facilityId: params?.facilityId,
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

// Deviation-count summary. NOTE: path is /deviations/intelligence-summary (not /intelligence/summary),
// and it now takes filter params. Distinct from the delivery-pipeline summary in §3.13.
export function getIntelligenceSummary(params?: {
  startDate?: string;
  endDate?: string;
  facilityId?: string;
}): Promise<IntelligenceSummary> {
  return apiGet('/deviations/intelligence-summary', {
    startDate: params?.startDate,
    endDate: params?.endDate,
    facilityId: params?.facilityId,
  });
}
```

### 3.4 Event Volume

```typescript
// src/api/events.ts
import { apiGet, apiGetPaginated } from './client';
import type {
  EventVolumeSummary, EventVolumeTrend, ResourceTypeCount,
  FacilityEventCount, EventKpis,
} from './types';

export function getEventSummary(params?: {
  facilityId?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
}): Promise<EventVolumeSummary> {
  return apiGet('/events/summary', params);
}

export function getEventTrends(params?: {
  interval?: string;
  resourceType?: string;
  facilityId?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
}): Promise<EventVolumeTrend> {
  return apiGet('/events/trends', params);
}

export function getEventsByResourceType(params?: {
  facilityId?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ResourceTypeCount[]> {
  return apiGet('/events/by-resource-type', params);
}

export function getEventsByFacility(params?: {
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}) {
  return apiGetPaginated<FacilityEventCount>('/events/by-facility', {
    resourceType: params?.resourceType,
    startDate: params?.startDate,
    endDate: params?.endDate,
    limit: params?.limit?.toString(),
    cursor: params?.cursor,
  });
}

export function getEventKpis(): Promise<EventKpis> {
  return apiGet('/events/kpis');
}
```

### 3.5 Protocol Analytics

```typescript
// src/api/protocols.ts
import { apiGet } from './client';
import type {
  StepAnalytics, CompletionFunnel, OutcomeDistribution, EnrollmentTrend,
} from './types';

export function getStepAnalytics(
  protocolDefinitionId: string,
  params?: { facilityId?: string; startDate?: string; endDate?: string },
): Promise<StepAnalytics> {
  return apiGet(`/protocols/${encodeURIComponent(protocolDefinitionId)}/step-analytics`, params);
}

export function getCompletionFunnel(
  protocolDefinitionId: string,
  params?: { facilityId?: string; startDate?: string; endDate?: string },
): Promise<CompletionFunnel> {
  return apiGet(`/protocols/${encodeURIComponent(protocolDefinitionId)}/completion-funnel`, params);
}

export function getOutcomeDistribution(
  protocolDefinitionId: string,
  params?: { facilityId?: string; startDate?: string; endDate?: string },
): Promise<OutcomeDistribution> {
  return apiGet(
    `/protocols/${encodeURIComponent(protocolDefinitionId)}/outcome-distribution`,
    params,
  );
}

export function getEnrollmentTrends(
  protocolDefinitionId: string,
  params?: {
    interval?: string;
    facilityId?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<EnrollmentTrend> {
  return apiGet(
    `/protocols/${encodeURIComponent(protocolDefinitionId)}/enrollment-trends`,
    params,
  );
}
```

### 3.6 Facility Analytics

```typescript
// src/api/facilities.ts
import { apiGet, apiGetPaginated } from './client';
import type {
  FacilityRanking, RankBy, SortOrder,
  FacilityActivitySummary, FacilityReference, AdoptionKpi,
} from './types';

// Facility activity cards (total / active / inactive). Dates truncated to YYYY-MM-DD. Respects
// the global facility + district filters (facilityId takes precedence server-side when both are
// given — see cce-insights-service docs/api-reference.md §9.2).
export function getFacilityActivitySummary(params?: {
  startDate?: string;
  endDate?: string;
  facilityId?: string;
  district?: string;
}): Promise<FacilityActivitySummary> {
  return apiGet('/facilities/activity-summary', {
    startDate: params?.startDate ? params.startDate.substring(0, 10) : undefined,
    endDate: params?.endDate ? params.endDate.substring(0, 10) : undefined,
    facilityId: params?.facilityId,
    district: params?.district,
  });
}

// Canonical facility list (FOSA id → name). Used to merge with event-by-facility rows.
export function getFacilityReference(): Promise<FacilityReference[]> {
  return apiGet('/facilities/reference');
}

// e-Buzima adoption KPIs (Facilities → Facility Ranking adoption columns). Respects the global
// date + district + facility filters; dates truncated to LocalDate. Returns one row per facility.
export function getAdoptionKpis(params?: {
  startDate?: string;
  endDate?: string;
  facilityId?: string;
  district?: string;
}): Promise<AdoptionKpi[]> {
  return apiGet('/facilities/adoption', {
    startDate: params?.startDate?.substring(0, 10),
    endDate: params?.endDate?.substring(0, 10),
    facilityId: params?.facilityId,
    district: params?.district,
  });
}

// Facility leaderboard. NOTE: now accepts facilityId and truncates dates to YYYY-MM-DD.
export function getFacilityRanking(params?: {
  protocolDefinitionId?: string;
  facilityId?: string;
  rankBy?: RankBy;
  order?: SortOrder;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}) {
  return apiGetPaginated<FacilityRanking>('/facilities/ranking', {
    protocolDefinitionId: params?.protocolDefinitionId,
    facilityId: params?.facilityId,
    rankBy: params?.rankBy,
    order: params?.order,
    startDate: params?.startDate?.substring(0, 10),
    endDate: params?.endDate?.substring(0, 10),
    limit: params?.limit?.toString(),
    cursor: params?.cursor,
  });
}
```

### 3.7 Patient Risk Analytics

```typescript
// src/api/patients.ts (additional exports)

import { apiGetPaginated } from './client';
import type { AtRiskHotspot, RepeatDeviationPatient } from './types';

export function getAtRiskHotspots(params?: {
  protocolDefinitionId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}) {
  return apiGetPaginated<AtRiskHotspot>('/patients/at-risk-hotspots', {
    protocolDefinitionId: params?.protocolDefinitionId,
    startDate: params?.startDate,
    endDate: params?.endDate,
    limit: params?.limit?.toString(),
    cursor: params?.cursor,
  });
}

export function getRepeatDeviations(params?: {
  minDeviations?: number;
  facilityId?: string;
  protocolDefinitionId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}) {
  return apiGetPaginated<RepeatDeviationPatient>('/patients/repeat-deviations', {
    minDeviations: params?.minDeviations?.toString(),
    facilityId: params?.facilityId,
    protocolDefinitionId: params?.protocolDefinitionId,
    startDate: params?.startDate,
    endDate: params?.endDate,
    limit: params?.limit?.toString(),
    cursor: params?.cursor,
  });
}
```

### 3.8 Ingestion Analytics

```typescript
// src/api/ingestion.ts
import { apiGet } from './client';
import type {
  IngestionFunnel, RejectionAnalytics, SourceDataQuality, PipelineLoss, LastIngestedEvent,
} from './types';

export function getIngestionFunnel(params?: {
  facilityId?: string;
  source?: string;
  district?: string;
  startDate?: string;
  endDate?: string;
  interval?: string;
}): Promise<IngestionFunnel> {
  return apiGet('/ingestion/funnel', params);
}

export function getIngestionRejections(params?: {
  facilityId?: string;
  source?: string;
  district?: string;
  startDate?: string;
  endDate?: string;
}): Promise<RejectionAnalytics> {
  return apiGet('/ingestion/rejections', params);
}

export function getSourceQuality(params?: {
  facilityId?: string;
  district?: string;
  startDate?: string;
  endDate?: string;
}): Promise<SourceDataQuality> {
  return apiGet('/ingestion/source-quality', params);
}

export function getPipelineLoss(params?: {
  facilityId?: string;
  district?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PipelineLoss> {
  return apiGet('/ingestion/pipeline-loss', params);
}

export function getLastIngestedEvent(params?: {
  facilityId?: string;
  district?: string;
}): Promise<LastIngestedEvent> {
  return apiGet('/ingestion/last-event', params);
}
```

> **`useLastIngestedEvent()`** (`useIngestion.ts`) reads `facilityId`/`district` from
> `useGlobalFilters()` but deliberately does **not** pass the date range — it always reflects the
> true latest ingest for the selected scope (pipeline freshness), not the latest within whatever
> From/To is selected. It polls every `VITE_POLLING_INTERVAL` ms (default 60000) via
> `refetchInterval`, and the backend endpoint is intentionally uncached for the same freshness
> reason. `formatRelative` (`utils/dates.ts`, wraps `date-fns`'s `formatDistanceToNow`) renders
> the returned timestamp as "about N hours ago" — its rounding buckets switch at fixed thresholds
> (e.g. "about 1 hour" covers up to ~89.5 minutes), so the displayed bucket can appear to lag by
> up to a poll interval right at a boundary; this is expected `date-fns` behavior, not a bug.
>
> As of RI-56, Ingestion also supports the global `district` filter end-to-end (previously the
> only page without it) — threaded through the repository layer via the same `districtScope(...)`
> helper used everywhere else in the backend.

### 3.9 Exports

```typescript
// src/api/exports.ts
import { buildUrl } from './client';

export function getExportUrl(params: {
  format: 'json' | 'csv';
  protocolDefinitionId?: string;
  facilityId?: string;
  startDate?: string;
  endDate?: string;
}): string {
  return buildUrl('/exports/compliance-report', {
    format: params.format,
    protocolDefinitionId: params.protocolDefinitionId,
    facilityId: params.facilityId,
    startDate: params.startDate,
    endDate: params.endDate,
  });
}
```

### 3.10 Lookups

```typescript
// src/api/lookups.ts
import { apiGet } from './client';
import type { ProtocolLookup } from './types';

export function getProtocols() {
  return apiGet<ProtocolLookup[]>('/lookups/protocols');
}

export function getFacilities() {
  // FacilityLookup now includes `district` (enables constraining pickers to the global district).
  return apiGet<FacilityLookup[]>('/lookups/facilities');
}

export function getDistricts() {
  // Distinct district names — feeds the global District filter (useDistricts).
  return apiGet<string[]>('/lookups/districts');
}

export function getPractitioners() {
  return apiGet<string[]>('/lookups/practitioners');
}

export function getSources() {
  return apiGet<string[]>('/lookups/sources');
}

export function getPatients() {
  return apiGet<string[]>('/lookups/patients');
}
```

### 3.11 Dashboard

```typescript
// src/api/dashboard.ts — declares its own DashboardOverview / DashboardComplianceSummary types.
import { apiGet } from './client';

export function getDashboardOverview(params?: {
  startDate?: string; endDate?: string; facilityId?: string;
}): Promise<DashboardOverview> {
  return apiGet('/dashboard/overview', params);
}

export function getDashboardComplianceSummary(params?: {
  startDate?: string; endDate?: string; facilityId?: string;
}): Promise<DashboardComplianceSummary> {
  return apiGet('/dashboard/compliance-summary', params);
}

// Referrals KPI — Dashboard "Referrals" card (received / compliant / non-compliant / rate) with a
// per-facility drill-down (RI-35). Filtered by clinical event_time.
// response: { totalReferralsReceived: number, compliantReferrals: number,
//             nonCompliantReferrals: number, referralComplianceRate: number,
//             byFacility: [{ facilityId, facilityName, district, count, compliant,
//                            nonCompliant, complianceRate }] }
export function getReferralsKpi(params?: {
  facilityId?: string; startDate?: string; endDate?: string;
}): Promise<ReferralsKpi> {
  return apiGet('/dashboard/referrals', params);
}
```

### 3.12 Practitioners

```typescript
// src/api/practitioners.ts
import { apiGet } from './client';
import type { PractitionerRanking, PractitionerRankBy } from './types';

export function getPractitionerRanking(params?: {
  rankBy?: PractitionerRankBy;
  order?: 'asc' | 'desc';
  limit?: number;
  startDate?: string;
  endDate?: string;
  facilityId?: string;
  protocolDefinitionId?: string;
}): Promise<PractitionerRanking[]> {
  return apiGet<PractitionerRanking[]>('/practitioners/ranking', { /* …params… */ });
}
```

### 3.13 Intelligence (delivery pipeline)

```typescript
// src/api/intelligence.ts — NOTE: its IntelligenceSummary is the DELIVERY-PIPELINE shape
// (total, delivered, failed, pending, successRate, byDestination[], activeAdaptors[], …),
// distinct from the deviation-count IntelligenceSummary in types.ts (§3.3).
import { apiGet } from './client';

export function getIntelligenceSummary(params?: {
  startDate?: string; endDate?: string; protocolDefinitionId?: string;
}): Promise<IntelligenceSummary /* delivery-pipeline */> {
  return apiGet('/intelligence/summary', { /* …params… */ });
}
```

---

## 4. TanStack Query Hooks

### 4.1 Compliance Summaries

```typescript
// src/hooks/useComplianceSummary.ts
import { useQuery } from '@tanstack/react-query';
import {
  getProtocolComplianceSummary, getAllProtocolsComplianceSummary, getProtocolPatients,
} from '../api/compliance';
import { useGlobalFilters } from './useGlobalFilters';

// Falls back to the all-protocols aggregate when no protocol id is given.
// Note: no `enabled` guard — it always runs (id || 'all').
export function useProtocolComplianceSummary(protocolDefinitionId: string, facilityId?: string) {
  const filters = useGlobalFilters();
  const effectiveFilters = { ...filters, facilityId: facilityId ?? filters.facilityId };
  return useQuery({
    queryKey: ['compliance', 'summary', protocolDefinitionId || 'all', effectiveFilters],
    queryFn: () => protocolDefinitionId
      ? getProtocolComplianceSummary(protocolDefinitionId, effectiveFilters)
      : getAllProtocolsComplianceSummary(effectiveFilters),
  });
}

// Patient list for a protocol, threading the enrollment-vs-activity dateFilterMode.
export function useProtocolPatients(
  protocolDefinitionId: string,
  params?: { status?: string; patientId?: string; limit?: number; cursor?: string;
             dateFilterMode?: 'enrollment' | 'activity' },
) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['compliance', 'patients', protocolDefinitionId, params, filters],
    queryFn: () => getProtocolPatients(protocolDefinitionId, { ...params, ...filters }),
  });
}
```

### 4.2 Deviation Trends

```typescript
// src/hooks/useDeviations.ts
import { useQuery } from '@tanstack/react-query';
import {
  getDeviationKpis, getDeviationTrends, getDeviationsByAction,
  getDeviationResolutionRate, getIntelligenceSummary,
} from '../api/deviations';
import { useGlobalFilters } from './useGlobalFilters';

// KPI cards for the Deviations page (polls).
export function useDeviationKpis(protocolDefinitionId?: string) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'kpis', { protocolDefinitionId, ...filters }],
    queryFn: () => getDeviationKpis({ protocolDefinitionId, ...filters }),
    refetchInterval: Number(getEnv('VITE_POLLING_INTERVAL') || 60000),
  });
}

export function useDeviationTrends(interval = 'weekly', protocolDefinitionId?: string) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'trends', { interval, protocolDefinitionId, ...filters }],
    queryFn: () => getDeviationTrends({ interval, protocolDefinitionId, ...filters }),
  });
}

export function useDeviationsByAction(protocolDefinitionId?: string) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'by-action', { protocolDefinitionId, ...filters }],
    queryFn: () => getDeviationsByAction({ protocolDefinitionId, ...filters }),
  });
}

// Deviation-count summary (deviations/intelligence-summary). Distinct from useIntelligence (§4.6).
export function useIntelligenceSummary() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'intelligence-summary', filters],
    queryFn: () => getIntelligenceSummary(filters),
    refetchInterval: Number(getEnv('VITE_POLLING_INTERVAL') || 60000),
  });
}
```

### 4.3 Event Volume

```typescript
// src/hooks/useEventVolume.ts
import { useQuery } from '@tanstack/react-query';
import {
  getEventSummary, getEventTrends, getEventsByResourceType,
  getEventsByFacility, getEventKpis,
} from '../api/events';
import { useGlobalFilters } from './useGlobalFilters';

const POLLING_INTERVAL = Number(getEnv('VITE_POLLING_INTERVAL') || 60000);

export function useEventSummary() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['events', 'summary', filters],
    queryFn: () => getEventSummary(filters),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useEventTrends(interval = 'weekly') {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['events', 'trends', { interval, ...filters }],
    queryFn: () => getEventTrends({ interval, ...filters }),
  });
}

export function useEventsByResourceType() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['events', 'by-resource-type', filters],
    queryFn: () => getEventsByResourceType(filters),
  });
}

export function useEventsByFacility(params?: { resourceType?: string }) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['events', 'by-facility', { ...params, ...filters }],
    queryFn: () => getEventsByFacility({ ...params, ...filters }),
  });
}

// Cumulative pipeline-loss KPI (not date-filtered). Polls.
export function useEventKpis() {
  return useQuery({
    queryKey: ['events', 'kpis'],
    queryFn: getEventKpis,
    refetchInterval: POLLING_INTERVAL,
  });
}
```

### 4.4 Lookups

```typescript
// src/hooks/useLookups.ts
import { useQuery } from '@tanstack/react-query';
import { getProtocols, getFacilities, getPractitioners, getSources, getPatients } from '../api/lookups';

export function useProtocols() {
  return useQuery({
    queryKey: ['lookups', 'protocols'],
    queryFn: getProtocols,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFacilityLookup() {
  return useQuery({
    queryKey: ['lookups', 'facilities'],
    queryFn: getFacilities,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSourcesLookup() {
  return useQuery({
    queryKey: ['lookups', 'sources'],
    queryFn: getSources,
    staleTime: 5 * 60 * 1000,
  });
}
```

> **Note:** Lookup hooks use a 5-minute `staleTime` since this reference data changes infrequently.
> They power protocol/facility/source selectors in Compliance, Export, and Facility pages.

### 4.5 Global Filters Hook

```typescript
// src/hooks/useGlobalFilters.ts
import { useContext, useMemo } from 'react';
import { FilterContext } from '../context/FilterContext';
import { toStartOfDayISO, toEndOfDayISO } from '../utils/dates';
import type { GlobalFilters } from '../api/types';

export function useGlobalFilters(): GlobalFilters {
  const ctx = useContext(FilterContext);
  return useMemo(() => ({
    startDate: toStartOfDayISO(ctx.startDate),
    endDate: toEndOfDayISO(ctx.endDate),
    facilityId: ctx.facilityId,
    district: ctx.district,
  }), [ctx.startDate, ctx.endDate, ctx.facilityId, ctx.district]);
}
```

> **Note:** The hook converts YYYY-MM-DD date strings from the FilterContext to ISO 8601 OffsetDateTime
> format (`2026-03-01T00:00:00Z` / `2026-03-31T23:59:59Z`) required by the Insights Service.
>
> **Timezone (`VITE_TIMEZONE`, default `UTC`).** The Insights Service is UTC-only. The selected days
> are interpreted in the configured IANA zone and converted to UTC (`toStartOfDayISO` /
> `toEndOfDayISO`), so with `Africa/Kigali` (UTC+2) a `2026-06-22` filter is sent as
> `2026-06-21T22:00:00Z` – `2026-06-22T21:59:59Z`. API timestamps are rendered in that same zone at
> display time (`formatDate` / `formatDateTime`); response payloads are not rewritten. Limits:
> `LocalDate` endpoints (`/facilities/*`) cannot carry a zone, so they receive the selected calendar
> date (`toLocalDateParam`), and trend `period` buckets are UTC `yyyy-MM-dd` days chosen by the
> service, so they are shown as returned.
>
> `FilterContext` carries `startDate`/`endDate`/`facilityId`/`district`. The enrollment-vs-activity
> `dateFilterMode` is **not** a global filter — it is a per-query param on `getProtocolPatients` /
> `useProtocolPatients` (§3.1, §4.1), driven by a local radio on the Patient List page.

> **Global District + Facility filters (RI-56).** Two dropdowns in the header — `District`
> (`DistrictFilter`, options from `useDistricts` → `GET /lookups/districts`) and `Facility`
> (`FacilityFilter`, options from `useFacilityLookup` → `GET /lookups/facilities`, filtered to the
> selected district) — set `district`/`facilityId` on the FilterContext (both URL-synced). Both
> render unconditionally on **every** page, including Ingestion (previously the only page without
> district support — see §3.8). `FacilityFilter` auto-resets to "All Facilities" if the selected
> district changes and the current facility no longer belongs to it, and disambiguates two
> facilities that share a display name by appending the facility id (`formatFacilityDisplayName`,
> same convention used by the Facility Ranking table and other facility-id-bearing tables).
>
> As of RI-56, this pair is the **only** facility picker on the app — the per-page local facility
> dropdowns previously on Deviations, Compliance Overview, and the Events page's Zero-Match table
> were removed (those hooks now read `facilityId` solely from `useGlobalFilters()`), and the
> `DistrictFacilityFilter` bundled control (`DistrictSelect.tsx`, used on 4 facility/patient/referral
> cards) took a `showFacility?: boolean` prop (default `true`) so those cards can suppress their own
> Facility half and read the global one instead — their District half is unchanged, still a
> per-card refinement layered on top of the global district.

### 4.6 Other hook modules

These hook files exist and follow the same pattern (each reads `useGlobalFilters()` and polls where noted):

| File | Hooks | Query keys |
|------|-------|-----------|
| `useDashboard.ts` | `useDashboardOverview`, `useDashboardComplianceSummary`, `useReferralsKpi` | `['dashboard','overview', filters]`, `['dashboard','compliance-summary', filters]`, `['dashboard','referrals', filters]` (all poll) |
| `useFacilities.ts` | `useFacilityActivitySummary`, `useFacilityReference`, `useAdoptionKpis`, `useFacilityRanking` | `['facilities','activity-summary', filters]` (poll), `['facilities','reference']` (1h staleTime), `['facilities','adoption', filters]`, `['facilities','ranking', rankBy, order, limit, filters]` |
| `useIntelligence.ts` | `useIntelligenceSummary(protocolDefinitionId?)` — delivery-pipeline (`../api/intelligence`); **distinct** from the deviations one in §4.2 | `['intelligence','summary', { ...filters, protocolDefinitionId }]` |
| `usePractitioners.ts` | `usePractitionerRanking(params)` | `['practitioners','ranking', { ...params, ...filters }]` |
| `usePatients.ts` | `usePatientTimeline`, `usePatientProtocolTracking`, `usePatientProtocolTrackingDetail`, `usePatientEvents`, `usePatientDeviations`, `usePatientIntelligenceDeliveries`, `useAtRiskHotspots`, `useRepeatDeviations` | `['patients', …]` |
| `useIngestion.ts`, `useProtocols.ts`, `useFacilityName.ts` | ingestion analytics, protocol analytics, facility-name resolution | — |

---

## 5. Error Handling

### API Error Mapping

```typescript
// src/utils/errors.ts
import { ApiError } from '../api/client';

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400: return `Invalid request: ${error.body.message}`;
      case 404: return 'Resource not found';
      case 503: return 'Service unavailable — database may be down';
      default: return error.body.message || `Unexpected error (${error.status})`;
    }
  }
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Cannot reach Insights Service. Check that it is running on the configured port.';
  }
  return 'An unexpected error occurred';
}
```

### TanStack Query Global Error Handler

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
```

---

## 6. CORS Configuration

### Option A: Vite Dev Server Proxy (Recommended for development)

```typescript
// vite.config.ts
export default defineConfig({
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

When using the proxy, set `VITE_API_BASE_URL=` (empty) so API calls use relative paths.

### Option B: Spring Boot CORS (Insights Service)

Add CORS configuration in the Insights Service for development:

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/v1/insights/**")
            .allowedOrigins("http://localhost:3001")
            .allowedMethods("GET")
            .allowedHeaders("*");
    }
}
```

### Option C: Caddy Reverse Proxy (Production)

Both UI and API behind the same origin — no CORS needed. See `architecture-overview.md` §11 for Caddyfile config.
