import { useQuery } from '@tanstack/react-query';
import {
  getFacilityRanking, getFacilityActivitySummary, getFacilityActivityDetail,
  getFacilityReference, getAdoptionKpis,
} from '../api/facilities';
import { useGlobalFilters } from './useGlobalFilters';
import type { RankBy, SortOrder } from '../api/types';
import { getEnv } from '../env';

export function useFacilityActivitySummary() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['facilities', 'activity-summary', filters],
    queryFn: () => getFacilityActivitySummary({
      startDate: filters.startDate,
      endDate: filters.endDate,
      facilityId: filters.facilityId,
      district: filters.district,
    }),
    refetchInterval: Number(getEnv('VITE_POLLING_INTERVAL') || 60000),
  });
}

export function useFacilityActivityDetail() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['facilities', 'activity-detail', filters.startDate, filters.endDate, filters.district],
    queryFn: () => getFacilityActivityDetail({
      startDate: filters.startDate,
      endDate: filters.endDate,
      district: filters.district,
    }),
    refetchInterval: Number(getEnv('VITE_POLLING_INTERVAL') || 60000),
  });
}

export function useFacilityReference() {
  return useQuery({
    queryKey: ['facilities', 'reference'],
    queryFn: () => getFacilityReference(),
    staleTime: 60 * 60 * 1000, // reference table is static — refresh hourly
  });
}

export function useAdoptionKpis() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['facilities', 'adoption', filters],
    queryFn: () => getAdoptionKpis({
      startDate: filters.startDate,
      endDate: filters.endDate,
      facilityId: filters.facilityId,
      district: filters.district,
    }),
  });
}

export function useFacilityRanking(params?: {
  protocolDefinitionId?: string;
  rankBy?: RankBy;
  order?: SortOrder;
  limit?: number;
}) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: [
      'facilities',
      'ranking',
      params?.rankBy,
      params?.order,
      params?.limit,
      filters,
    ],
    queryFn: () => getFacilityRanking({ ...params, ...filters }),
    // Return a shallow copy so cached rows are never mutated in place by the UI.
    select: (response) => ({
      ...response,
      data: [...response.data],
    }),
  });
}
