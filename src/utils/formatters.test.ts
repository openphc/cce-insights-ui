import { describe, expect, it } from 'vitest';
import { formatDaysVsDue, formatRate } from './formatters';

describe('formatRate', () => {
  it('renders a 0–1 fraction as a percentage', () => {
    expect(formatRate(0.26)).toBe('26.0%');
    expect(formatRate(1)).toBe('100.0%');
    expect(formatRate(null)).toBe('—');
  });
});

describe('formatDaysVsDue', () => {
  it('reads a negative offset as early and a positive one as late', () => {
    expect(formatDaysVsDue(-12.14)).toBe('12.1 d early');
    expect(formatDaysVsDue(3)).toBe('3.0 d late');
  });

  it('treats an offset that rounds to zero as on the due date', () => {
    expect(formatDaysVsDue(-0.01)).toBe('on due date');
    expect(formatDaysVsDue(0)).toBe('on due date');
  });

  it('shows a dash when there is no completed step with a due date', () => {
    expect(formatDaysVsDue(null)).toBe('—');
    expect(formatDaysVsDue(undefined)).toBe('—');
  });
});
