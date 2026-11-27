import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HandoffMetrics } from './HandoffMetrics';
import type { HandoffMetric } from '../../api/dashboard';

const handoff = (over: Partial<HandoffMetric>): HandoffMetric => ({
  key: 'k',
  actionId: 'a',
  total: 0,
  completed: 0,
  onTime: 0,
  completedLate: 0,
  overdueOpen: 0,
  pending: 0,
  deviations: 0,
  deviationRate: 0,
  medianMinutes: null,
  ...over,
});

const show = (handoffs: HandoffMetric[]) =>
  render(
    <MemoryRouter>
      <HandoffMetrics handoffs={handoffs} />
    </MemoryRouter>,
  );

describe('HandoffMetrics', () => {
  it('shows each hand-off, in pathway order: how many missed the limit of those due, and the share on time', () => {
    show([
      handoff({ key: 'referral-consultation', total: 10 }),
      handoff({
        key: 'pci-referral-acknowledged',
        total: 6,
        pending: 1,
        deviations: 4,
        deviationRate: 80,
      }),
    ]);

    const first = screen.getByTestId('handoff-referral-consultation');
    expect(within(first).getByText('Delayed UHC Consultations')).toBeInTheDocument();
    expect(within(first).getByText('100.0% on time')).toBeInTheDocument();
    expect(within(first).getByText('/10')).toBeInTheDocument();

    const second = screen.getByTestId('handoff-pci-referral-acknowledged');
    expect(within(second).getByText('Delayed Cardiac Acknowledgments')).toBeInTheDocument();
    expect(within(second).getByText('20.0% on time')).toBeInTheDocument();
    expect(within(second).getByText('4')).toBeInTheDocument();
    // the one still within its time limit is not due yet
    expect(within(second).getByText('/5')).toBeInTheDocument();
  });

  it('says when none is due yet', () => {
    show([handoff({ key: 'p', total: 2, pending: 2 })]);
    expect(screen.getByText('None due yet')).toBeInTheDocument();
  });

  it('shows the key of a hand-off it has no name for', () => {
    show([handoff({ key: 'new-handoff', total: 1 })]);
    expect(screen.getByText('new-handoff')).toBeInTheDocument();
  });
});
