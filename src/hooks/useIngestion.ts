import { useQuery } from '@tanstack/react-query';
import { getIngestionFunnel, getIngestionRejections, getSourceQuality, getPipelineLoss, getLastIngestedEvent } from '../api/ingestion';
import { useGlobalFilters } from './useGlobalFilters';
import { getEnv } from '../env';

const LAST_EVENT_POLL_INTERVAL = Number(getEnv('VITE_POLLING_INTERVAL') || 60000);

export function useIngestionFunnel(params?: { source?: string; interval?: string }) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['ingestion', 'funnel', { ...params, ...filters }],
    queryFn: () => getIngestionFunnel({ ...params, ...filters }),
  });
}

export function useIngestionRejections(params?: { source?: string }) {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['ingestion', 'rejections', { ...params, ...filters }],
    queryFn: () => getIngestionRejections({ ...params, ...filters }),
  });
}

export function useSourceQuality() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['ingestion', 'source-quality', filters],
    queryFn: () => getSourceQuality(filters),
  });
}

export function usePipelineLoss() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['ingestion', 'pipeline-loss', filters],
    queryFn: () => getPipelineLoss(filters),
  });
}

/**
 * Respects facilityId/district (so "is THIS facility/district still sending data" works), but is
 * deliberately unfiltered by date range — always reflects the true latest ingest for the selected
 * scope, for pipeline freshness, not the latest within whatever From/To is selected.
 */
export function useLastIngestedEvent() {
  const { facilityId, district } = useGlobalFilters();
  return useQuery({
    queryKey: ['ingestion', 'last-event', facilityId, district],
    queryFn: () => getLastIngestedEvent({ facilityId, district }),
    refetchInterval: LAST_EVENT_POLL_INTERVAL,
  });
}
