# API Integration Reference

> **CCE Insights UI** — Complete mapping of UI features to Insights Service APIs  
> All endpoints consumed from the Insights Service (`port 8084`) or via the CCE Gateway (`port 8060`).  
> Compliance categories are binary: `on_track` (Compliant) and `non_compliant` (Non-Compliant).

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
import { getEnv } from '../env';

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
    // Live Keycloak access token (kept fresh by initAuth's refresh loop). VITE_AUTH_TOKEN is a
    // static fallback for local testing without a login.
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
        }
      : { limit: 50, next_cursor: null, has_more: false },
  };
}

export { buildUrl };
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
  deviationType: DeviationType;
  detectedAt: string;
}

export type DeviationType = 'OVERDUE' | 'MISSED';

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
  affectedPatients: number;
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

export interface IntelligenceSummary {
  totalDeviations: number;
  byType: { overdue: number; missed: number };
  bySeverity: { warning: number; critical: number };
  recentActivity: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}

// ─── Event Volume ────────────────────────────────────────────

export interface EventVolumeSummary {
  totalEvents: number;
  processingStatusBreakdown: {
    matched: number;
    zeroMatch: number;
    duplicate: number;
  };
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

export interface PractitionerEventCount {
  practitionerRef: string;
  practitionerDisplay: string | null;
  facilityId: string;
  totalEvents: number;
  byResourceType: { resourceType: string; count: number }[];
}

export interface SourceSystemCount {
  source: string;
  totalEvents: number;
  byResourceType: { resourceType: string; count: number }[];
}

export interface SourceComparison {
  sourceA: string;
  sourceB: string;
  matchWindowSeconds: number;
  sourceASummary: SourceSummary;
  sourceBSummary: SourceSummary;
  overlap: {
    totalOverlappingEvents: number;
    byResourceType: { resourceType: string; count: number }[];
  };
  samples: SourceComparisonSample[];
}

export interface SourceSummary {
  source: string;
  totalEvents: number;
  uniqueEvents: number;
  overlappingEvents: number;
  overlapPercentage: number;
  uniqueByResourceType: { resourceType: string; count: number }[];
}

export interface SourceComparisonSample {
  eventAId: string;
  eventBId: string;
  subject: string;
  resourceType: string;
  eventTimeA: string;
  eventTimeB: string;
  timeDiffSeconds: number;
}

// ─── Protocol Analytics ──────────────────────────────────────

export interface StepAnalytics {
  protocolDefinitionId: string;
  protocolCanonical: string;
  steps: {
    actionId: string;
    totalInstances: number;
    completedCount: number;
    completionRate: number;
    timelinessDistribution: {
      completedOnTime: number;
      completedLate: number;
    };
    overdueCount: number;       // SLA verdicts — include steps completed late
    missedCount: number;
    notStartedCount: number;
    slaUnjudgedCount: number;
    avgDaysToComplete: number;
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
  totalEnrollments: number;
  complianceRate: number;
  activeDeviations: number;
  totalEvents: number;
}

export type RankBy = 'complianceRate' | 'deviationCount' | 'eventVolume';
export type SortOrder = 'asc' | 'desc';

// ─── Processing Quality ──────────────────────────────────────

export interface ProcessingQuality {
  totalEvents: number;
  overall: {
    matched: { count: number; percentage: number };
    zeroMatch: { count: number; percentage: number };
    duplicate: { count: number; percentage: number };
  };
  bySource: {
    source: string;
    totalEvents: number;
    breakdown: {
      matched: { count: number; percentage: number };
      zero_match: { count: number; percentage: number };
      duplicate: { count: number; percentage: number };
    };
  }[];
}

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
  },
) {
  return apiGetPaginated<PatientCompliance>(
    `/protocols/${encodeURIComponent(protocolDefinitionId)}/patients`,
    {
      status: params?.status,
      facilityId: params?.facilityId,
      limit: params?.limit?.toString(),
      cursor: params?.cursor,
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
```

### 3.3 Deviations & Intelligence

```typescript
// src/api/deviations.ts
import { apiGet, apiGetPaginated } from './client';
import type {
  DeviationRecord, DeviationTrend, DeviationByAction,
  DeviationResolution, IntelligenceSummary,
} from './types';

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

export function getIntelligenceSummary(): Promise<IntelligenceSummary> {
  return apiGet('/intelligence/summary');
}
```

### 3.4 Event Volume

```typescript
// src/api/events.ts
import { apiGet, apiGetPaginated } from './client';
import type {
  EventVolumeSummary, EventVolumeTrend, ResourceTypeCount,
  FacilityEventCount, PractitionerEventCount, SourceSystemCount,
  SourceComparison, ProcessingQuality,
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

export function getEventsByPractitioner(params?: {
  facilityId?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}) {
  return apiGetPaginated<PractitionerEventCount>('/events/by-practitioner', {
    facilityId: params?.facilityId,
    resourceType: params?.resourceType,
    startDate: params?.startDate,
    endDate: params?.endDate,
    limit: params?.limit?.toString(),
    cursor: params?.cursor,
  });
}

export function getEventsBySource(params?: {
  facilityId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<SourceSystemCount[]> {
  return apiGet('/events/by-source', params);
}

export function compareSourceSystems(params: {
  sourceA: string;
  sourceB: string;
  windowSeconds?: number;
  facilityId?: string;
  startDate?: string;
  endDate?: string;
  sampleLimit?: number;
}): Promise<SourceComparison> {
  return apiGet('/events/source-comparison', {
    sourceA: params.sourceA,
    sourceB: params.sourceB,
    windowSeconds: params.windowSeconds?.toString(),
    facilityId: params.facilityId,
    startDate: params.startDate,
    endDate: params.endDate,
    sampleLimit: params.sampleLimit?.toString(),
  });
}

export function getProcessingQuality(params?: {
  source?: string;
  facilityId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ProcessingQuality> {
  return apiGet('/events/processing-quality', params);
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
import { apiGetPaginated } from './client';
import type { FacilityRanking, RankBy, SortOrder } from './types';

export function getFacilityRanking(params?: {
  protocolDefinitionId?: string;
  rankBy?: RankBy;
  order?: SortOrder;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}) {
  return apiGetPaginated<FacilityRanking>('/facilities/ranking', {
    protocolDefinitionId: params?.protocolDefinitionId,
    rankBy: params?.rankBy,
    order: params?.order,
    startDate: params?.startDate,
    endDate: params?.endDate,
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
  IngestionFunnel, RejectionAnalytics, SourceDataQuality, PipelineLoss,
} from './types';

export function getIngestionFunnel(params?: {
  facilityId?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  interval?: string;
}): Promise<IngestionFunnel> {
  return apiGet('/ingestion/funnel', params);
}

export function getIngestionRejections(params?: {
  facilityId?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
}): Promise<RejectionAnalytics> {
  return apiGet('/ingestion/rejections', params);
}

export function getSourceQuality(params?: {
  facilityId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<SourceDataQuality> {
  return apiGet('/ingestion/source-quality', params);
}

export function getPipelineLoss(params?: {
  facilityId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PipelineLoss> {
  return apiGet('/ingestion/pipeline-loss', params);
}
```

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
  return apiGet<string[]>('/lookups/facilities');
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

---

## 4. TanStack Query Hooks

### 4.1 Compliance Summaries

```typescript
// src/hooks/useComplianceSummary.ts
import { useQuery } from '@tanstack/react-query';
import { getProtocolComplianceSummary, getFacilityComplianceSummary, getProtocolPatients } from '../api/compliance';
import { useGlobalFilters } from './useGlobalFilters';

export function useProtocolComplianceSummary(protocolDefinitionId: string) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['compliance', 'summary', protocolDefinitionId, filters],
    queryFn: () => getProtocolComplianceSummary(protocolDefinitionId, filters),
    enabled: !!protocolDefinitionId,
  });
}

export function useFacilityComplianceSummary(facilityId: string) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['compliance', 'facility', facilityId, filters],
    queryFn: () => getFacilityComplianceSummary(facilityId, filters),
    enabled: !!facilityId,
  });
}
```

### 4.2 Deviation Trends

```typescript
// src/hooks/useDeviations.ts
import { useQuery } from '@tanstack/react-query';
import {
  getDeviationTrends, getDeviationsByAction,
  getDeviationResolutionRate, getIntelligenceSummary,
} from '../api/deviations';
import { useGlobalFilters } from './useGlobalFilters';

export function useDeviationTrends(interval = 'weekly') {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'trends', { interval, ...filters }],
    queryFn: () => getDeviationTrends({ interval, ...filters }),
  });
}

export function useDeviationsByAction(protocolDefinitionId?: string) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'by-action', { protocolDefinitionId, ...filters }],
    queryFn: () => getDeviationsByAction({ protocolDefinitionId, ...filters }),
  });
}

export function useDeviationResolution() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'resolution', filters],
    queryFn: () => getDeviationResolutionRate(filters),
  });
}

export function useIntelligenceSummary() {
  return useQuery({
    queryKey: ['intelligence', 'summary'],
    queryFn: getIntelligenceSummary,
    refetchInterval: Number(getEnv('VITE_POLLING_INTERVAL') || 60000),
  });
}
```

### 4.3 Event Volume

```typescript
// src/hooks/useEventVolume.ts
import { useQuery } from '@tanstack/react-query';
import { getEventSummary, getEventTrends, getEventsByResourceType } from '../api/events';
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
> They power protocol/facility/source selectors in Compliance, Export, Facility, and Source Comparison pages.

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
  }), [ctx.startDate, ctx.endDate, ctx.facilityId]);
}
```

> **Note:** The hook converts YYYY-MM-DD date strings from the FilterContext to ISO 8601 OffsetDateTime
> format (`2026-03-01T00:00:00Z` / `2026-03-31T23:59:59Z`) required by the Insights Service.
>
> **Timezone (`VITE_TIMEZONE`, default `UTC`).** The Insights Service is UTC-only. The selected days
> are interpreted in the configured IANA zone and converted to UTC (`toStartOfDayISO` /
> `toEndOfDayISO`), so with `Africa/Kigali` (UTC+2) a `2026-06-22` filter is sent as
> `2026-06-21T22:00:00Z` – `2026-06-22T21:59:59Z`. API timestamps are rendered in that same zone at
> display time (`formatDate` / `formatDateTime`); response payloads are not rewritten. Trend
> `period` buckets are UTC `yyyy-MM-dd` days chosen by the service, so they are shown as returned.

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
