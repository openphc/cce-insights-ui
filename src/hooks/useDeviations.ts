import { useQuery } from '@tanstack/react-query';
import {
  getDeviationTrends, getDeviationsByAction, getDeviationsByFacility,
  getDeviationResolutionRate, getIntelligenceSummary, getDeviationKpis,
} from '../api/deviations';
import { useGlobalFilters } from './useGlobalFilters';
import { getEnv } from '../env';

// RI-56: facilityId now comes exclusively from the global header filter (useGlobalFilters).
export function useDeviationKpis(protocolDefinitionId?: string) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'kpis', { protocolDefinitionId, ...filters }],
    queryFn: () => getDeviationKpis({
      protocolDefinitionId,
      facilityId: filters.facilityId,
      district: filters.district,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
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

// RI-34 — "Deviations by Facility and Type" chart. Page-based on top of the API's cursor
// pagination (cursor is just a stringified offset), matching TableRangePagination's contract.
// deviationType, when set, both filters nothing (the endpoint still returns all 3 counts per
// facility) and re-ranks the page by that type's count instead of the total — matches the
// chart's type-filter toggle.
export function useDeviationsByFacility(page: number, pageSize: number, deviationType?: string, protocolDefinitionId?: string) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'by-facility', { page, pageSize, deviationType, protocolDefinitionId, ...filters }],
    queryFn: () => getDeviationsByFacility({
      ...filters,
      deviationType,
      protocolDefinitionId,
      limit: pageSize,
      cursor: String((page - 1) * pageSize),
    }),
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
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['deviations', 'intelligence-summary', filters],
    queryFn: () => getIntelligenceSummary(filters),
    refetchInterval: Number(getEnv('VITE_POLLING_INTERVAL') || 60000),
  });
}
