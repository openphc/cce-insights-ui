import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  toUtcString,
  toStartOfDayISO,
  toEndOfDayISO,
  toZonedDateString,
  toLocalDateParam,
  getDefaultDateRange,
} from './dates';
import { resolveTimeZone } from '../config';

describe('formatDate', () => {
  it('renders in UTC regardless of local timezone', () => {
    // 20:00Z must stay on Jun 22 even in ahead-of-UTC zones (would slip to Jun 23 if local).
    expect(formatDate('2026-06-22T20:00:00Z')).toBe('Jun 22, 2026');
  });
});

describe('formatDateTime', () => {
  it('renders date and 24h time in UTC', () => {
    expect(formatDateTime('2026-06-22T20:05:00Z')).toBe('Jun 22, 2026, 20:05');
  });
});

describe('toUtcString', () => {
  it('returns the ISO-8601 representation of a Date', () => {
    const date = new Date('2026-06-22T20:00:00Z');
    expect(toUtcString(date)).toBe('2026-06-22T20:00:00.000Z');
  });
});

describe('day-boundary ISO helpers', () => {
  it('expands a YYYY-MM-DD to start and end of the UTC day', () => {
    expect(toStartOfDayISO('2026-06-22')).toBe('2026-06-22T00:00:00Z');
    expect(toEndOfDayISO('2026-06-22')).toBe('2026-06-22T23:59:59Z');
  });
});

describe('display in a configured timezone', () => {
  const KIGALI = 'Africa/Kigali'; // UTC+2, no DST
  const NEW_YORK = 'America/New_York'; // UTC-5 / UTC-4 (DST)

  it('moves a late-evening UTC timestamp onto the next day in an ahead-of-UTC zone', () => {
    expect(formatDate('2026-06-22T23:30:00Z', KIGALI)).toBe('Jun 23, 2026');
    expect(formatDateTime('2026-06-22T23:30:00Z', KIGALI)).toBe('Jun 23, 2026, 01:30');
  });

  it('moves an early-morning UTC timestamp onto the previous day in a behind-UTC zone', () => {
    expect(formatDateTime('2026-01-15T03:00:00Z', NEW_YORK)).toBe('Jan 14, 2026, 22:00');
    expect(formatDateTime('2026-07-15T03:00:00Z', NEW_YORK)).toBe('Jul 14, 2026, 23:00');
  });

  it('does not shift date-only values, which have no time to convert', () => {
    expect(formatDate('2026-06-22', NEW_YORK)).toBe('Jun 22, 2026');
    expect(formatDate('2026-06-22', KIGALI)).toBe('Jun 22, 2026');
  });

  it('reads zone-less date-times as UTC, not browser-local', () => {
    expect(formatDateTime('2026-06-22T20:05:00', KIGALI)).toBe('Jun 22, 2026, 22:05');
    expect(formatDateTime('2026-06-22T20:05:00', 'UTC')).toBe('Jun 22, 2026, 20:05');
  });

  it('honours an explicit offset on the input', () => {
    expect(formatDateTime('2026-06-22T22:05:00+02:00', 'UTC')).toBe('Jun 22, 2026, 20:05');
  });
});

describe('day boundaries in a configured timezone', () => {
  it('converts the start/end of a Kigali day to UTC', () => {
    expect(toStartOfDayISO('2026-06-22', 'Africa/Kigali')).toBe('2026-06-21T22:00:00Z');
    expect(toEndOfDayISO('2026-06-22', 'Africa/Kigali')).toBe('2026-06-22T21:59:59Z');
  });

  it('converts a behind-UTC zone, using the offset in force on that date (DST)', () => {
    expect(toStartOfDayISO('2026-01-15', 'America/New_York')).toBe('2026-01-15T05:00:00Z');
    expect(toStartOfDayISO('2026-07-15', 'America/New_York')).toBe('2026-07-15T04:00:00Z');
    expect(toEndOfDayISO('2026-07-15', 'America/New_York')).toBe('2026-07-16T03:59:59Z');
  });

  it('handles a half-hour offset', () => {
    expect(toStartOfDayISO('2026-06-22', 'Asia/Kolkata')).toBe('2026-06-21T18:30:00Z');
  });

  it('gives a 23-hour day across a spring-forward transition', () => {
    // US clocks jump forward on 2026-03-08: midnight is UTC-5, the end of the day is UTC-4.
    expect(toStartOfDayISO('2026-03-08', 'America/New_York')).toBe('2026-03-08T05:00:00Z');
    expect(toEndOfDayISO('2026-03-08', 'America/New_York')).toBe('2026-03-09T03:59:59Z');
  });

  it('round-trips with the displayed date', () => {
    const start = toStartOfDayISO('2026-06-22', 'Africa/Kigali');
    const end = toEndOfDayISO('2026-06-22', 'Africa/Kigali');
    expect(toZonedDateString(start, 'Africa/Kigali')).toBe('2026-06-22');
    expect(toZonedDateString(end, 'Africa/Kigali')).toBe('2026-06-22');
  });

  it('passes a cleared date input through rather than throwing', () => {
    expect(toStartOfDayISO('', 'Africa/Kigali')).toBe('T00:00:00Z');
  });
});

describe('toLocalDateParam', () => {
  it('returns the selected calendar date, not the UTC date of the converted instant', () => {
    // Start of Jun 22 in Kigali is still Jun 21 in UTC.
    expect(toLocalDateParam('2026-06-21T22:00:00Z', 'Africa/Kigali')).toBe('2026-06-22');
    // End of Jun 22 in New York (UTC-4) is already Jun 23 in UTC.
    expect(toLocalDateParam('2026-06-23T03:59:59Z', 'America/New_York')).toBe('2026-06-22');
  });

  it('is undefined for a missing value', () => {
    expect(toLocalDateParam(undefined)).toBeUndefined();
  });
});

describe('getDefaultDateRange', () => {
  it('ends on today as the calendar reads in the configured zone', () => {
    const now = new Date('2026-06-22T23:30:00Z'); // already Jun 23 in Kigali
    expect(getDefaultDateRange(7, 'UTC', now)).toEqual({ startDate: '2026-06-15', endDate: '2026-06-22' });
    expect(getDefaultDateRange(7, 'Africa/Kigali', now)).toEqual({ startDate: '2026-06-16', endDate: '2026-06-23' });
  });
});

describe('resolveTimeZone', () => {
  it('accepts a valid IANA zone and trims it', () => {
    expect(resolveTimeZone(' Africa/Kigali ')).toBe('Africa/Kigali');
  });

  it('falls back to UTC when unset, blank or invalid', () => {
    expect(resolveTimeZone(undefined)).toBe('UTC');
    expect(resolveTimeZone('  ')).toBe('UTC');
    expect(resolveTimeZone('Not/AZone')).toBe('UTC');
  });
});
