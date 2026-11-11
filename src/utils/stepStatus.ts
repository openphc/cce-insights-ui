import type { JourneyStep, StepDisplayStatus, StepInstance } from '../api/types';

// CCE 2.0.0 steps carry two independent statuses: stepStatus (was the work recorded?) and slaStatus
// (was it on time?). These helpers turn that pair into what the patient views show.

/** The journey's steps, without its step-group rows. A group is not a step to count. */
export function stepsOnly(journey: JourneyStep[]): JourneyStep[] {
  return journey.filter((s) => !s.group);
}

/** An action with no step instance yet — reported NOT_STARTED, with no stepStatus. A group that never opened is the same. */
export function isUntriggered(step: JourneyStep): boolean {
  return step.status === 'NOT_STARTED' && !step.stepStatus;
}

/** One badge per step, as the API derives JourneyStep.status: COMPLETED, else an outstanding step's SLA verdict. */
export function stepDisplayStatus(s: Pick<StepInstance, 'stepStatus' | 'slaStatus'>): StepDisplayStatus {
  if (s.stepStatus === 'COMPLETED') return 'COMPLETED';
  if (s.slaStatus === 'OVERDUE' || s.slaStatus === 'MISSED') return s.slaStatus;
  return 'NOT_STARTED';
}

/**
 * An untriggered step is hidden only if its own root branch was superseded — never merely
 * because its parent action completed. Computed in a single forward pass so it cascades
 * correctly to any nesting depth (a NOT_STARTED step inherits its nearest ancestor's visibility).
 */
export function visibleJourneySteps(journey: JourneyStep[]): JourneyStep[] {
  const visibleRootIdx = new Set<number>();
  journey.forEach((step, i) => {
    if ((step.depth ?? 0) !== 0) return;
    if (!isUntriggered(step)) { visibleRootIdx.add(i); return; }
    // Superseded by a later root step that has progressed (completed, or past a deadline) — an
    // outstanding step that is merely pending does not count.
    const superseded = journey.slice(i + 1).some(
      (s) => (s.depth ?? 0) === 0 && s.status !== 'NOT_STARTED'
    );
    if (!superseded) visibleRootIdx.add(i);
  });

  const keep = journey.map(() => true);
  journey.forEach((step, i) => {
    if (!isUntriggered(step)) return;
    const depth = step.depth ?? 0;
    if (depth === 0) { keep[i] = visibleRootIdx.has(i); return; }
    for (let j = i - 1; j >= 0; j--) {
      if ((journey[j].depth ?? 0) < depth) { keep[i] = keep[j]; break; }
    }
  });

  return journey.filter((_step, i) => keep[i]);
}
