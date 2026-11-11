import { describe, it, expect } from 'vitest';
import type { JourneyStep } from '../api/types';
import { isUntriggered, stepDisplayStatus, stepsOnly, visibleJourneySteps } from './stepStatus';

const step = (actionId: string, status: JourneyStep['status'], extra: Partial<JourneyStep> = {}): JourneyStep => ({
  actionId, stepName: actionId, status, completionCount: 0, ...extra,
});

describe('stepDisplayStatus', () => {
  it('shows COMPLETED whatever the SLA verdict', () => {
    expect(stepDisplayStatus({ stepStatus: 'COMPLETED', slaStatus: 'MET' })).toBe('COMPLETED');
    expect(stepDisplayStatus({ stepStatus: 'COMPLETED', slaStatus: 'OVERDUE' })).toBe('COMPLETED');
    expect(stepDisplayStatus({ stepStatus: 'COMPLETED' })).toBe('COMPLETED');
  });

  it('shows the SLA breach of an outstanding step, else NOT_STARTED', () => {
    expect(stepDisplayStatus({ stepStatus: 'NOT_STARTED', slaStatus: 'OVERDUE' })).toBe('OVERDUE');
    expect(stepDisplayStatus({ stepStatus: 'NOT_STARTED', slaStatus: 'MISSED' })).toBe('MISSED');
    expect(stepDisplayStatus({ stepStatus: 'NOT_STARTED' })).toBe('NOT_STARTED');
    // legacy 1.x SKIPPED rows arrive as NOT_STARTED + MET: nothing outstanding to flag
    expect(stepDisplayStatus({ stepStatus: 'NOT_STARTED', slaStatus: 'MET' })).toBe('NOT_STARTED');
  });
});

describe('isUntriggered', () => {
  it('is an action with no step instance — NOT_STARTED without a stepStatus', () => {
    expect(isUntriggered(step('a', 'NOT_STARTED'))).toBe(true);
    expect(isUntriggered(step('a', 'NOT_STARTED', { stepStatus: null }))).toBe(true);
  });

  it('is not a step that exists but is still outstanding (1.x PENDING / DUE)', () => {
    expect(isUntriggered(step('a', 'NOT_STARTED', { stepStatus: 'NOT_STARTED' }))).toBe(false);
    expect(isUntriggered(step('a', 'OVERDUE', { stepStatus: 'NOT_STARTED', slaStatus: 'OVERDUE' }))).toBe(false);
  });
});

describe('visibleJourneySteps', () => {
  it('hides an untriggered root step once a later root step has progressed, with its sub-steps', () => {
    const journey = [
      step('lab-order', 'NOT_STARTED'),
      step('lab-results', 'NOT_STARTED', { depth: 1 }),
      step('consultation', 'COMPLETED', { stepStatus: 'COMPLETED', slaStatus: 'MET' }),
    ];
    expect(visibleJourneySteps(journey).map((s) => s.actionId)).toEqual(['consultation']);
  });

  it('keeps an untriggered root step when later root steps are merely pending', () => {
    const journey = [
      step('lab-order', 'NOT_STARTED'),
      step('consultation', 'NOT_STARTED', { stepStatus: 'NOT_STARTED' }),
    ];
    expect(visibleJourneySteps(journey).map((s) => s.actionId)).toEqual(['lab-order', 'consultation']);
  });

  it('never hides a step that exists, even when a later step has progressed', () => {
    const journey = [
      step('visit', 'NOT_STARTED', { stepStatus: 'NOT_STARTED' }),
      step('consultation', 'OVERDUE', { stepStatus: 'NOT_STARTED', slaStatus: 'OVERDUE' }),
    ];
    expect(visibleJourneySteps(journey).map((s) => s.actionId)).toEqual(['visit', 'consultation']);
  });
});

describe('step groups', () => {
  it('leaves group rows out of the steps to count', () => {
    const journey = [
      step('registration', 'COMPLETED', { stepStatus: 'COMPLETED' }),
      step('visit', 'NOT_STARTED', { stepStatus: 'NOT_STARTED', group: true }),
      step('history', 'COMPLETED', { stepStatus: 'COMPLETED', depth: 1 }),
    ];
    expect(stepsOnly(journey).map((s) => s.actionId)).toEqual(['registration', 'history']);
  });

  it('treats a group that never opened as untriggered, and an open group as not', () => {
    expect(isUntriggered(step('visit', 'NOT_STARTED', { group: true, groupInstances: [] }))).toBe(true);
    expect(isUntriggered(step('visit', 'NOT_STARTED', { group: true, stepStatus: 'NOT_STARTED' }))).toBe(false);
  });

  it('keeps an open group and its steps visible, even when a later root step has progressed', () => {
    const journey = [
      step('visit', 'NOT_STARTED', { stepStatus: 'NOT_STARTED', group: true }),
      step('bp', 'NOT_STARTED', { depth: 1 }),
      step('discharge', 'COMPLETED', { stepStatus: 'COMPLETED' }),
    ];
    expect(visibleJourneySteps(journey).map((s) => s.actionId)).toEqual(['visit', 'bp', 'discharge']);
  });
});
