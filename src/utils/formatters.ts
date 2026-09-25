export function formatNumber(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() : '—';
}

export function formatPercentage(n: number | null | undefined, decimals = 1): string {
  return n != null ? `${n.toFixed(decimals)}%` : '—';
}

export function formatRate(rate: number | null | undefined): string {
  return rate != null ? `${(rate * 100).toFixed(1)}%` : '—';
}

/**
 * Days between completion and the due date (completed_at − due_date), as early / late.
 * Step analytics reports it signed: negative = completed before the due date.
 */
export function formatDaysVsDue(days: number | null | undefined): string {
  if (days == null) return '—';
  const magnitude = Math.abs(days).toFixed(1);
  if (magnitude === '0.0') return 'on due date';
  return days < 0 ? `${magnitude} d early` : `${magnitude} d late`;
}
