import { formatDistanceToNow, differenceInDays, subDays } from 'date-fns';
import { APP_TIMEZONE } from '../config';

// The insights-service stores and accepts UTC only. API timestamps are rendered in the
// configured APP_TIMEZONE (VITE_TIMEZONE, default UTC), and the day boundaries chosen in the
// date filter are interpreted in that same zone and converted to UTC before being sent, so what
// the user selects and what they see always agree.
//
// Never rely on the browser's own timezone: it would shift a UTC timestamp onto an adjacent
// calendar day for users whose machine is set differently from the configured zone.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
// An ISO date-time with no Z / offset, e.g. a Java LocalDateTime. The service is UTC, so it
// means UTC — but `new Date()` would read it as browser-local time.
const ZONELESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** Parse an API timestamp. Zone-less date-times are UTC (as the service emits them). */
function parseApiInstant(value: string): Date {
  return new Date(ZONELESS_DATE_TIME.test(value) ? `${value.replace(' ', 'T')}Z` : value);
}

/** Milliseconds that `timeZone` is ahead of UTC at the given instant (e.g. +2h for Kigali). */
function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epochMs));
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wallAsUtc = Date.UTC(
    part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'),
  );
  return wallAsUtc - Math.floor(epochMs / 1000) * 1000;
}

/** The UTC instant at which `timeZone`'s wall clock reads the given date and time. */
function zonedWallTimeToUtcMs(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  // Two passes: the offset at the guess may differ from the offset at the real instant when a
  // DST transition falls between them.
  const guess = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  return wallAsUtc - zoneOffsetMs(guess, timeZone);
}

function toUtcIsoSeconds(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('.000Z', 'Z');
}

/** Render an API timestamp as a calendar date in `timeZone`. Date-only values are not shifted. */
export function formatDate(dateStr: string, timeZone: string = APP_TIMEZONE): string {
  const isDateOnly = DATE_ONLY.test(dateStr);
  return parseApiInstant(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    // A bare date has no time-of-day to convert; reading it in another zone would move the day.
    timeZone: isDateOnly ? 'UTC' : timeZone,
  });
}

/** Render an API timestamp as date + 24h time in `timeZone`. */
export function formatDateTime(dateStr: string, timeZone: string = APP_TIMEZONE): string {
  return parseApiInstant(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
}

export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(parseApiInstant(dateStr), { addSuffix: true });
}

export function daysUntil(dateStr: string): number {
  return differenceInDays(parseApiInstant(dateStr), new Date());
}

export function daysSince(dateStr: string): number {
  return differenceInDays(new Date(), parseApiInstant(dateStr));
}

export function toUtcString(date: Date): string {
  return date.toISOString();
}

/** YYYY-MM-DD calendar date of an instant as seen in `timeZone`. */
export function toZonedDateString(value: Date | string, timeZone: string = APP_TIMEZONE): string {
  const date = typeof value === 'string' ? parseApiInstant(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Convert a YYYY-MM-DD date (a day in `timeZone`) to the UTC instant at the start of that day,
 * as an ISO OffsetDateTime.
 */
export function toStartOfDayISO(date: string, timeZone: string = APP_TIMEZONE): string {
  if (!DATE_ONLY.test(date)) return `${date}T00:00:00Z`; // e.g. a cleared date input
  return toUtcIsoSeconds(zonedWallTimeToUtcMs(date, '00:00:00', timeZone));
}

/** Convert a YYYY-MM-DD date (a day in `timeZone`) to the UTC instant at the end of that day. */
export function toEndOfDayISO(date: string, timeZone: string = APP_TIMEZONE): string {
  if (!DATE_ONLY.test(date)) return `${date}T23:59:59Z`;
  return toUtcIsoSeconds(zonedWallTimeToUtcMs(date, '23:59:59', timeZone));
}

/**
 * Date param for endpoints that take a plain LocalDate rather than a date-time. Those cannot
 * carry a zone, so send the calendar date the user selected (the day in `timeZone`) rather than
 * the UTC date of the converted instant, which can land on the neighbouring day.
 */
export function toLocalDateParam(
  isoUtc: string | undefined,
  timeZone: string = APP_TIMEZONE,
): string | undefined {
  return isoUtc ? toZonedDateString(isoUtc, timeZone) : undefined;
}

/** Default filter range ending today (as the calendar reads in `timeZone`), `days` days back. */
export function getDefaultDateRange(
  days: number,
  timeZone: string = APP_TIMEZONE,
  now: Date = new Date(),
): { startDate: string; endDate: string } {
  const endDate = toZonedDateString(now, timeZone);
  // Calendar arithmetic on the date itself, so DST changes can't skew the day count.
  const start = subDays(new Date(`${endDate}T00:00:00Z`), days);
  return { startDate: start.toISOString().split('T')[0], endDate };
}
