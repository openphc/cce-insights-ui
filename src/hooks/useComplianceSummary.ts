import { useQuery } from '@tanstack/react-query';
import { getAllProtocolsComplianceSummary, getProtocolComplianceSummary, getFacilityComplianceSummary, getProtocolPatients } from '../api/compliance';
import { useGlobalFilters } from './useGlobalFilters';

export function useProtocolComplianceSummary(protocolDefinitionId: string, facilityId?: string) {
  const filters = useGlobalFilters();
  const effectiveFilters = { ...filters, ...(facilityId ? { facilityId } : {}) };
  return useQuery({
    queryKey: ['compliance', 'summary', protocolDefinitionId || 'all', effectiveFilters],
    queryFn: () => protocolDefinitionId
      ? getProtocolComplianceSummary(protocolDefinitionId, effectiveFilters)
      : getAllProtocolsComplianceSummary(effectiveFilters),
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

export function useProtocolPatients(
  protocolDefinitionId: string,
  params?: { status?: string; facilityId?: string; limit?: number; cursor?: string; patientId?: string },
) {
  // Enrolment cohort of the global date range, matching the protocol compliance summary.
  const { startDate, endDate } = useGlobalFilters();
  const effectiveParams = { ...params, startDate, endDate };
  return useQuery({
    queryKey: ['compliance', 'patients', protocolDefinitionId, effectiveParams],
    queryFn: () => getProtocolPatients(protocolDefinitionId, effectiveParams),
    enabled: !!protocolDefinitionId,
  });
}
