import { apiGet } from './client';
import type { FacilityRanking } from './types';

export interface DashboardOverview {
  totalPatientsEBuzima: number;
  patientsReceivedHIE: number;
  transmissionRate: number;
  activeFacilities: number;
  activeDeviations: number;
  newDeviations24h: number;
  hieEventCount: number;
  topFacilities: FacilityRanking[];
  bottomFacilities: FacilityRanking[];
}

export interface ComplianceMetric {
  trackedPatients: number;
  compliantPatients: number;
  nonCompliantPatients: number;
  complianceRate: number;
}

export interface FacilityComplianceMetric {
  trackedFacilities: number;
  above90: number;
  between75And90: number;
  below75: number;
}

export interface PractitionerComplianceMetric {
  trackedPractitioners: number;
  above90: number;
  between75And90: number;
  below75: number;
}

export interface DashboardComplianceSummary {
  patients: ComplianceMetric;
  facilities: FacilityComplianceMetric;
  practitioners: PractitionerComplianceMetric;
}

export function getDashboardOverview(params?: {
  facilityId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DashboardOverview> {
  return apiGet('/dashboard/overview', params);
}

export function getDashboardComplianceSummary(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<DashboardComplianceSummary> {
  return apiGet('/dashboard/compliance-summary', {
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

/** One referral hand-off (a protocol step with a deadline) over the date range; counts are hand-offs. */
export interface HandoffMetric {
  /** Stable id of the hand-off: the card's name and description are looked up by it (HANDOFF_CARDS). */
  key: string;
  actionId: string;
  /** Hand-offs due in the range: completed on time or late, or outstanding. */
  total: number;
  completed: number;
  onTime: number;
  completedLate: number;
  /** Outstanding past the deadline. */
  overdueOpen: number;
  /** Outstanding, deadline not reached yet. */
  pending: number;
  /** completedLate + overdueOpen. */
  deviations: number;
  /** Share of judged hand-offs (total - pending) that missed the deadline, in %. */
  deviationRate: number;
  /** Median minutes from the step the hand-off starts from; null when it cannot be measured. */
  medianMinutes: number | null;
}

export function getDashboardHandoffs(params?: { startDate?: string; endDate?: string }): Promise<HandoffMetric[]> {
  return apiGet('/dashboard/handoffs', {
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}
