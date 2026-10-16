import { useQuery } from '@tanstack/react-query';
import { getDashboardOverview, getDashboardComplianceSummary } from '../api/dashboard';
import { useGlobalFilters } from './useGlobalFilters';
import { getEnv } from '../env';

const POLLING_INTERVAL = Number(getEnv('VITE_POLLING_INTERVAL') || 60000);

export function useDashboardOverview() {
  const filters = useGlobalFilters();
  return useQuery({
    queryKey: ['dashboard', 'overview', filters],
    queryFn: () => getDashboardOverview(filters),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useDashboardComplianceSummary() {
  return useQuery({
    queryKey: ['dashboard', 'compliance-summary'],
    queryFn: () => getDashboardComplianceSummary(),
    refetchInterval: POLLING_INTERVAL,
  });
}
