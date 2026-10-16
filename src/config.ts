import { getEnv } from './env';

export const DEFAULT_PAGE_SIZE = 50;

export const INTERVAL_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

export const RANK_BY_OPTIONS = [
  { value: 'complianceRate', label: 'Compliance Rate' },
  { value: 'deviationCount', label: 'Deviation Count' },
  { value: 'eventVolume', label: 'Event Volume' },
] as const;

export const SORT_ORDER_OPTIONS = [
  { value: 'desc', label: 'Best First' },
  { value: 'asc', label: 'Worst First' },
] as const;

export const DEVIATION_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'missed', label: 'Missed' },
  { value: 'orderViolation', label: 'Order Violation' },
] as const;

export const COMPLIANCE_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'on_track', label: 'Compliant' },
  { value: 'non_compliant', label: 'Non-Compliant' },
] as const;

/**
 * Resolve the IANA timezone (e.g. "Africa/Kigali") used to display API timestamps and to
 * interpret the user's selected dates. Falls back to UTC when unset or not a valid zone name.
 */
export function resolveTimeZone(raw: string | undefined): string {
  const tz = raw?.trim();
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    console.warn(`Invalid VITE_TIMEZONE "${tz}"; falling back to UTC`);
    return 'UTC';
  }
}

/**
 * Display timezone. The insights-service stores and accepts UTC only: API timestamps are shown
 * in this zone, and the selected date range is converted from this zone to UTC before it is sent.
 * Read at runtime (docker/entrypoint.sh → window._env_), so it can change without a rebuild.
 */
export const APP_TIMEZONE = resolveTimeZone(getEnv('VITE_TIMEZONE'));
