import { describe, it, expect } from 'vitest';
import type { GroupInstance, JourneyStep } from '../api/types';
import {
  chipLayout, chipTone, groupInstanceChipName, groupInstanceName, groupInstancesWithDeviations, groupPathLabel,
  selectionFor, selectionFromParam, selectionToParam, showCycles, spansYears,
} from './groupCycles';

// An outpatient visit, one per day, with a consultation group nested in it. The patient came twice.
// Visit 1 is done. Visit 2 has its patient-visit step done and its vitals still awaited, and its
// consultation has not opened. Lab results sit under lab order, a step, in the consultation group.
const visit1: GroupInstance = {
  groupInstanceId: 'v1', cycleIndex: 0, status: 'COMPLETED', openedAt: '2026-09-05T08:00:00Z', completedSteps: 4, totalSteps: 4,
};
const visit2: GroupInstance = {
  groupInstanceId: 'v2', cycleIndex: 1, status: 'NOT_STARTED', openedAt: '2026-09-06T08:00:00Z', completedSteps: 1, totalSteps: 2,
};
const consultationInVisit1: GroupInstance = {
  groupInstanceId: 'c1', parentGroupInstanceId: 'v1', cycleIndex: 0, status: 'COMPLETED',
  openedAt: '2026-09-05T09:00:00Z', completedSteps: 2, totalSteps: 2,
};

const journey: JourneyStep[] = [
  { actionId: 'registration', stepName: 'Registration', status: 'COMPLETED', stepStatus: 'COMPLETED', completionCount: 1, depth: 0,
    instances: [{ stepInstanceId: 's-reg', groupInstanceId: null, status: 'COMPLETED', stepStatus: 'COMPLETED' }] },
  { actionId: 'visit', stepName: 'Outpatient Visit', status: 'COMPLETED', stepStatus: 'COMPLETED', completionCount: 1, depth: 0,
    group: true, groupInstances: [visit1, visit2] },
  { actionId: 'patient-visit', parentActionId: 'visit', stepName: 'Patient Visit', status: 'COMPLETED', stepStatus: 'COMPLETED',
    completionCount: 2, depth: 1, effectiveDateTime: '2026-09-05T08:00:00Z',
    instances: [
      { stepInstanceId: 's-pv1', groupInstanceId: 'v1', status: 'COMPLETED', stepStatus: 'COMPLETED', effectiveDateTime: '2026-09-05T08:00:00Z', practitioner: 'Dr. A' },
      { stepInstanceId: 's-pv2', groupInstanceId: 'v2', status: 'COMPLETED', stepStatus: 'COMPLETED', effectiveDateTime: '2026-09-06T08:00:00Z', practitioner: 'Dr. B' },
    ] },
  { actionId: 'vitals', parentActionId: 'visit', stepName: 'Vitals', status: 'COMPLETED', stepStatus: 'COMPLETED',
    completionCount: 1, depth: 1, slaStatus: 'MET',
    instances: [
      { stepInstanceId: 's-vit1', groupInstanceId: 'v1', status: 'COMPLETED', stepStatus: 'COMPLETED', slaStatus: 'MET' },
      { stepInstanceId: 's-vit2', groupInstanceId: 'v2', status: 'NOT_STARTED', stepStatus: 'NOT_STARTED', dueDate: '2026-09-07T08:00:00Z' },
    ] },
  { actionId: 'consultation', parentActionId: 'visit', stepName: 'Clinical Consultation', status: 'COMPLETED', stepStatus: 'COMPLETED',
    completionCount: 1, depth: 1, group: true, groupInstances: [consultationInVisit1] },
  { actionId: 'lab-order', parentActionId: 'consultation', stepName: 'Lab Order', status: 'COMPLETED', stepStatus: 'COMPLETED',
    completionCount: 1, depth: 2,
    instances: [{ stepInstanceId: 's-lo1', groupInstanceId: 'c1', status: 'COMPLETED', stepStatus: 'COMPLETED' }] },
  { actionId: 'lab-results', parentActionId: 'lab-order', stepName: 'Lab Results', status: 'MISSED', stepStatus: 'NOT_STARTED',
    slaStatus: 'MISSED', completionCount: 0, depth: 3, description: 'Step missed',
    instances: [{ stepInstanceId: 's-lr1', groupInstanceId: 'c1', status: 'MISSED', stepStatus: 'NOT_STARTED', slaStatus: 'MISSED', description: 'Step missed' }] },
];

const row = (steps: JourneyStep[], actionId: string) => steps.find((s) => s.actionId === actionId)!;

describe('showCycles', () => {
  it('shows the latest visit by default, with each step as it stands in that visit', () => {
    const view = showCycles(journey, {});

    expect(view.shownInstances.get('visit')).toBe(visit2);
    expect(row(view.steps, 'visit').status).toBe('NOT_STARTED');
    expect(row(view.steps, 'visit').stepStatus).toBe('NOT_STARTED'); // open: reads "In progress"
    expect(row(view.steps, 'patient-visit')).toMatchObject({
      status: 'COMPLETED', completionCount: 1, effectiveDateTime: '2026-09-06T08:00:00Z', practitioner: 'Dr. B',
    });
    expect(row(view.steps, 'vitals')).toMatchObject({
      status: 'NOT_STARTED', stepStatus: 'NOT_STARTED', slaStatus: null, dueDate: '2026-09-07T08:00:00Z',
    });
  });

  it('shows a picked visit instead', () => {
    const view = showCycles(journey, { visit: 'v1' });

    expect(row(view.steps, 'visit').status).toBe('COMPLETED');
    expect(row(view.steps, 'patient-visit')).toMatchObject({ effectiveDateTime: '2026-09-05T08:00:00Z', practitioner: 'Dr. A' });
    expect(row(view.steps, 'vitals')).toMatchObject({ status: 'COMPLETED', slaStatus: 'MET' });
  });

  it('offers a nested group only the instances inside the shown visit', () => {
    const latest = showCycles(journey, {});
    expect(latest.offeredInstances.get('consultation')).toEqual([]);
    expect(latest.shownInstances.get('consultation')).toBeNull();
    // Visit 2 has no consultation yet: it and its steps read as not started, with nothing from visit 1.
    expect(row(latest.steps, 'consultation')).toMatchObject({ status: 'NOT_STARTED', stepStatus: null });
    expect(row(latest.steps, 'lab-order')).toMatchObject({ status: 'NOT_STARTED', stepStatus: null, completionCount: 0 });
    expect(row(latest.steps, 'lab-results')).toMatchObject({ status: 'NOT_STARTED', stepStatus: null, description: undefined });

    const first = showCycles(journey, { visit: 'v1' });
    expect(first.offeredInstances.get('consultation')).toEqual([consultationInVisit1]);
    expect(row(first.steps, 'consultation').status).toBe('COMPLETED');
    // Lab results sits under lab order, a step: it is in the consultation group too.
    expect(row(first.steps, 'lab-results')).toMatchObject({ status: 'MISSED', description: 'Step missed' });
  });

  it('leaves a step in no group as it is', () => {
    const view = showCycles(journey, { visit: 'v1' });
    expect(row(view.steps, 'registration')).toBe(journey[0]);
  });

  it('counts a step instance as shown only in a shown cycle, or in no group', () => {
    const latest = showCycles(journey, {});
    expect(latest.isShown('s-reg')).toBe(true);
    expect(latest.isShown('s-vit2')).toBe(true);
    expect(latest.isShown('s-vit1')).toBe(false);
    expect(latest.isShown('s-lr1')).toBe(false);
    expect(latest.isShown('unknown')).toBe(true);

    expect(showCycles(journey, { visit: 'v1' }).isShown('s-lr1')).toBe(true);
  });

  it('ignores a pick that is no longer offered', () => {
    const view = showCycles(journey, { visit: 'gone', consultation: 'c1' });
    expect(view.shownInstances.get('visit')).toBe(visit2);
    expect(view.shownInstances.get('consultation')).toBeNull();
  });

  it('leaves step rows from an API without instances as they are', () => {
    const older = journey.map(({ instances: _instances, ...rest }) => rest);
    const view = showCycles(older, {});
    expect(row(view.steps, 'patient-visit')).toBe(older[2]);
  });
});

describe('naming a visit', () => {
  const path = [
    { groupActionId: 'visit', groupName: 'Outpatient Visit', groupInstanceId: 'v2', number: 2, openedAt: '2026-09-06T08:00:00Z' },
    { groupActionId: 'consultation', groupName: 'Clinical Consultation', groupInstanceId: 'c3', number: null, openedAt: '2026-09-06T09:00:00Z' },
  ];

  it('names a group instance by its number and day, or its day alone', () => {
    expect(groupInstanceName(2, '2026-09-06T08:00:00Z')).toBe('#2 · Sep 6, 2026');
    expect(groupInstanceName(null, '2026-09-06T08:00:00Z')).toBe('Sep 6, 2026');
  });

  it('names the visit a step is in, with the day only on the top-level group', () => {
    expect(groupPathLabel(path)).toBe('Outpatient Visit #2 (Sep 6, 2026) › Clinical Consultation');
    expect(groupPathLabel([])).toBe('');
    expect(groupPathLabel(undefined)).toBe('');
  });

  it('turns a visit into a pick, and a pick into a link value and back', () => {
    const selection = selectionFor(path);
    expect(selection).toEqual({ visit: 'v2', consultation: 'c3' });
    expect(selectionFromParam(selectionToParam(selection))).toEqual(selection);
    expect(selectionFromParam('broken,:x,y:,ok:1')).toEqual({ ok: '1' });
    expect(selectionFromParam(null)).toEqual({});
  });
});

describe('a group\'s instances as chips', () => {
  const visits: GroupInstance[] = Array.from({ length: 7 }, (_, i) => ({
    groupInstanceId: `v${i + 1}`, cycleIndex: i, status: i < 6 ? 'COMPLETED' : 'NOT_STARTED',
    openedAt: `2026-10-${String(10 + i).padStart(2, '0')}T08:00:00Z`, completedSteps: 2, totalSteps: 2,
  }));
  const numbers = (list: { number: number | null }[]) => list.map((n) => n.number);

  it('shows the latest four, newest first, and puts the rest in a menu, newest first too', () => {
    const { chips, earlier } = chipLayout(visits, 'v7');
    expect(numbers(chips)).toEqual([7, 6, 5, 4]);
    expect(numbers(earlier)).toEqual([3, 2, 1]);
  });

  it('keeps a chip for the shown instance when it is an earlier one', () => {
    const { chips, earlier } = chipLayout(visits, 'v2');
    expect(numbers(chips)).toEqual([7, 6, 5, 4, 2]);
    expect(numbers(earlier)).toEqual([3, 1]);
  });

  it('never hides a single instance in the menu', () => {
    expect(chipLayout(visits.slice(0, 5), 'v5').earlier).toEqual([]);
    expect(numbers(chipLayout(visits.slice(0, 5), 'v5').chips)).toEqual([5, 4, 3, 2, 1]);
  });

  it('numbers instances only when there is more than one', () => {
    expect(numbers(chipLayout(visits.slice(0, 1), 'v1').chips)).toEqual([null]);
  });

  it('marks an instance with a deviation in it, or past its own deadline, before whether it is done', () => {
    const deviated = groupInstancesWithDeviations([
      { groupPath: [
        { groupActionId: 'visit', groupName: 'Visit', groupInstanceId: 'v1', number: 1, openedAt: '2026-10-10T08:00:00Z' },
        { groupActionId: 'consultation', groupName: 'Consultation', groupInstanceId: 'c1', number: null, openedAt: '2026-10-10T09:00:00Z' },
      ] },
      { groupPath: [] },
      {},
    ]);
    expect(deviated).toEqual(new Set(['v1', 'c1']));
    expect(chipTone(visits[0], deviated)).toBe('DEVIATION');
    expect(chipTone(visits[1], deviated)).toBe('COMPLETED');
    expect(chipTone(visits[6], deviated)).toBe('IN_PROGRESS');
    expect(chipTone({ ...visits[1], status: 'MISSED' }, deviated)).toBe('DEVIATION');
  });

  it('names a chip by its number and day, with the year only when the visits span years', () => {
    expect(groupInstanceChipName(14, '2026-11-01T08:00:00Z', false)).toBe('#14 · Nov 1');
    expect(groupInstanceChipName(null, '2026-11-01T08:00:00Z', false)).toBe('Nov 1');
    expect(groupInstanceChipName(1, '2025-12-30T08:00:00Z', true)).toBe('#1 · Dec 30, 2025');
    expect(spansYears(visits)).toBe(false);
    expect(spansYears([...visits, { ...visits[0], openedAt: '2027-01-02T08:00:00Z' }])).toBe(true);
  });
});
