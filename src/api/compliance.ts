import { apiGet, apiGetPaginated } from './client';
import type { ComplianceSummary, FacilitySummary, PatientCompliance, GlobalFilters } from './types';

export function getAllProtocolsComplianceSummary(filters?: GlobalFilters): Promise<ComplianceSummary> {
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
  },
) {
  return apiGetPaginated<PatientCompliance>(
    `/protocols/${encodeURIComponent(protocolDefinitionId)}/patients`,
    {
      status: params?.status,
      facilityId: params?.facilityId,
      limit: (params?.limit ?? 20).toString(),
      cursor: params?.cursor,
      patientId: params?.patientId,
      startDate: params?.startDate,
      endDate: params?.endDate,
    },
  );
}
