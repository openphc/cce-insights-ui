import { useQuery } from '@tanstack/react-query';
import { getEventSummary, getEventTrends, getEventsByResourceType, getEventsByFacility, getEventsByPractitioner, getEventsBySource, getProcessingQuality } from '../api/events';
import { useGlobalFilters } from './useGlobalFilters';
import { getEnv } from '../env';

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

export function useEventsByFacility(params?: { resourceType?: string; limit?: number; cursor?: string }) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['events', 'by-facility', { ...params, ...filters }],
    queryFn: () => getEventsByFacility({ ...params, ...filters }),
  });
}

export function useEventsByPractitioner(params?: { resourceType?: string; limit?: number; cursor?: string }) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['events', 'by-practitioner', { ...params, ...filters }],
    queryFn: () => getEventsByPractitioner({ ...params, ...filters }),
  });
}

export function useEventsBySource() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['events', 'by-source', filters],
    queryFn: () => getEventsBySource(filters),
  });
}

export function useProcessingQuality() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['events', 'processing-quality', filters],
    queryFn: () => getProcessingQuality(filters),
  });
}

export function useEventTrendsBySource(source: string, interval = 'daily') {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['events', 'trends', { interval, source, ...filters }],
    queryFn: () => getEventTrends({ interval, source, ...filters }),
    enabled: !!source,
  });
}
