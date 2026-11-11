import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { JourneyStep, PatientDeviation } from '../api/types';
import PatientDetail from './PatientDetail';

// A visit is a step group: a set of steps that belong together. This patient had two visits. The
// first is done, and the second has one of its two steps done.
const journey: JourneyStep[] = [
  { actionId: 'registration', stepName: 'Registration', status: 'COMPLETED', stepStatus: 'COMPLETED', completionCount: 1, depth: 0 },
  {
    actionId: 'visit', stepName: 'Visit', status: 'COMPLETED', stepStatus: 'COMPLETED', completionCount: 1, depth: 0,
    group: true,
    groupInstances: [
      { groupInstanceId: 'g0', cycleIndex: 0, status: 'COMPLETED', openedAt: '2026-11-02T09:00:00Z', completedSteps: 2, totalSteps: 2 },
      { groupInstanceId: 'g1', cycleIndex: 1, status: 'NOT_STARTED', openedAt: '2026-11-03T09:00:00Z', completedSteps: 1, totalSteps: 2 },
    ],
  },
  {
    actionId: 'history', parentActionId: 'visit', stepName: 'History', status: 'COMPLETED', stepStatus: 'COMPLETED',
    completionCount: 2, depth: 1,
    instances: [
      { stepInstanceId: 'h0', groupInstanceId: 'g0', status: 'COMPLETED', stepStatus: 'COMPLETED', practitioner: 'Dr. First' },
      { stepInstanceId: 'h1', groupInstanceId: 'g1', status: 'COMPLETED', stepStatus: 'COMPLETED', practitioner: 'Dr. Second' },
    ],
  },
  {
    actionId: 'bp', parentActionId: 'visit', stepName: 'Blood Pressure', status: 'COMPLETED', stepStatus: 'COMPLETED',
    completionCount: 1, depth: 1,
    instances: [
      { stepInstanceId: 'b0', groupInstanceId: 'g0', status: 'COMPLETED', stepStatus: 'COMPLETED', slaStatus: 'MET' },
      { stepInstanceId: 'b1', groupInstanceId: 'g1', status: 'NOT_STARTED', stepStatus: 'NOT_STARTED' },
    ],
  },
];

const none = { data: undefined, isLoading: false, error: null };
const deviations: PatientDeviation[] = [];

vi.mock('../hooks/usePatients', () => ({
  usePatientTimeline: () => ({
    data: {
      patientId: 'P-1',
      protocols: [{
        protocolInstanceId: 'pi-1',
        protocolCanonical: 'http://x/PlanDefinition/visits|1.0',
        status: 'ACTIVE',
        complianceRate: 75,
        journey,
        timeline: [],
      }],
    },
    isLoading: false,
    error: null,
  }),
  usePatientProtocolTracking: () => ({ data: [], isLoading: false, error: null }),
  usePatientProtocolTrackingDetail: () => none,
  usePatientDeviations: () => ({ data: deviations, isLoading: false, error: null }),
  usePatientIntelligenceDeliveries: () => ({ data: [], isLoading: false, error: null }),
}));
vi.mock('../hooks/useProtocols', () => ({ useActionOrder: () => none }));

function renderPage() {
  // jsdom has no matchMedia. The page reads it to pick its desktop layout.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  render(
    <MemoryRouter initialEntries={['/patients/P-1']}>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PatientDetail — step groups in the Protocol Journey', () => {
  it('shows a group as a step group, with a chip per visit, newest first, and how far the shown one is', () => {
    renderPage();
    const visitRow = screen.getByText('Visit').parentElement!.parentElement!;
    expect(within(visitRow).getByText('Step group')).toBeInTheDocument();
    // Each chip is named by its number and the day it opened, newest first.
    const chips = within(visitRow).getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
    expect(chips.map((chip) => chip.textContent)).toEqual(['#2 · Nov 3', '#1 · Nov 2']);
    expect(chips[1]).toHaveAccessibleName('#1 · Nov 2, 2026 · Completed · 2/2 steps');
    // The row shows the latest visit, which is open, and the line under the chips says so.
    expect(within(visitRow).getByText('In progress')).toBeInTheDocument();
    expect(within(visitRow).getByText('Shown: #2 · Nov 3, 2026 · In progress · 1/2 steps')).toBeInTheDocument();
    expect(screen.getByTestId('visit-chip-legend')).toHaveTextContent('Visit chips:CompletedIn progressHas deviation');
  });

  it('shows the latest visit\'s steps first, and another visit\'s steps when its chip is picked', () => {
    renderPage();
    const chip = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label} ·`) });
    const bpRow = () => screen.getByText('Blood Pressure').parentElement!.parentElement!;

    // Visit #2: history done by Dr. Second, blood pressure still awaited.
    expect(chip('#2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Practitioner: Dr. Second')).toBeInTheDocument();
    expect(within(bpRow()).getByText('Pending')).toBeInTheDocument();

    fireEvent.click(chip('#1'));

    expect(chip('#1')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('#2')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Practitioner: Dr. First')).toBeInTheDocument();
    expect(screen.queryByText('Practitioner: Dr. Second')).not.toBeInTheDocument();
    expect(within(bpRow()).getByText('Completed')).toBeInTheDocument();
    expect(within(bpRow()).getByText('ON TIME')).toBeInTheDocument();
  });

  it('counts steps only, not the group, in the protocol header, and says the count covers all visits', () => {
    renderPage();
    // registration, history and bp are steps. The visit is not.
    expect(screen.getAllByText('3/3 steps').length).toBeGreaterThan(0);
    expect(screen.queryByText('4/4 steps')).not.toBeInTheDocument();
    expect(screen.getByText(/3\/3 steps\s*· all visits/)).toBeInTheDocument();
  });

  it('says which visit a deviation is in, and shows that visit when asked', () => {
    deviations.push({
      deviationId: 'd1', protocolInstanceId: 'pi-1', protocolCanonical: 'http://x/PlanDefinition/visits|1.0',
      stepInstanceId: 'b0', actionId: 'bp', stepName: 'Blood Pressure', deviationType: 'OVERDUE',
      detectedAt: '2026-11-03T09:00:00Z', description: 'Blood Pressure was late',
      groupPath: [{ groupActionId: 'visit', groupName: 'Visit', groupInstanceId: 'g0', number: 1, openedAt: '2026-11-02T09:00:00Z' }],
    });
    renderPage();
    // Visit #1's chip says it has a deviation.
    expect(screen.getByRole('button', { name: /^#1 ·/ })).toHaveAccessibleName(
      '#1 · Nov 2, 2026 · Completed · 2/2 steps · has a deviation');
    const card = screen.getByText('Blood Pressure was late').parentElement!;
    expect(within(card).getByText(/In Visit #1 \(Nov 2, 2026\)/)).toBeInTheDocument();

    // Visit #2 is shown; the deviation is in visit #1.
    fireEvent.click(within(card).getByText('· Show this visit'));

    expect(screen.getByText(/^#1 ·/).closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(within(card).getByText('· shown above')).toBeInTheDocument();
    deviations.length = 0;
  });

  it('keeps the latest four visits as chips, and the earlier ones in a menu', () => {
    const twoVisits = journey[1].groupInstances!;
    journey[1].groupInstances = Array.from({ length: 7 }, (_, i) => ({
      groupInstanceId: `g${i}`, cycleIndex: i, status: i < 6 ? 'COMPLETED' as const : 'NOT_STARTED' as const,
      openedAt: `2026-10-${String(10 + i).padStart(2, '0')}T09:00:00Z`, completedSteps: 2, totalSteps: 2,
    }));
    try {
      renderPage();
      const chipNames = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed')).map((b) => b.textContent);
      expect(chipNames()).toEqual(['#7 · Oct 16', '#6 · Oct 15', '#5 · Oct 14', '#4 · Oct 13']);

      fireEvent.click(screen.getByRole('button', { name: '3 earlier visits' }));
      const menu = screen.getByRole('menu');
      expect(within(menu).getAllByRole('menuitem').map((item) => item.getAttribute('aria-label'))).toEqual([
        '#3 · Oct 12, 2026 · Completed · 2/2 steps',
        '#2 · Oct 11, 2026 · Completed · 2/2 steps',
        '#1 · Oct 10, 2026 · Completed · 2/2 steps',
      ]);

      // Picking one shows it, closes the menu, and gives it a chip of its own.
      fireEvent.click(within(menu).getByRole('menuitem', { name: /^#2 ·/ }));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^#2 ·/ })).toHaveAttribute('aria-pressed', 'true');
      expect(chipNames()).toEqual(['#7 · Oct 16', '#6 · Oct 15', '#5 · Oct 14', '#4 · Oct 13', '#2 · Oct 11']);
      expect(screen.getByRole('button', { name: '2 earlier visits' })).toBeInTheDocument();
      expect(screen.getByText('Shown: #2 · Oct 11, 2026 · Completed · 2/2 steps')).toBeInTheDocument();

      // Escape closes the menu.
      fireEvent.click(screen.getByRole('button', { name: '2 earlier visits' }));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    } finally {
      journey[1].groupInstances = twoVisits;
    }
  });

  it('shows deviations five at a time', () => {
    for (let i = 1; i <= 7; i++) {
      deviations.push({
        deviationId: `d${i}`, protocolInstanceId: 'pi-1', protocolCanonical: 'http://x/PlanDefinition/visits|1.0',
        stepInstanceId: 'b1', actionId: 'bp', stepName: 'Blood Pressure', deviationType: 'OVERDUE',
        detectedAt: '2026-11-03T09:00:00Z', description: `Deviation ${i}`,
      });
    }
    try {
      renderPage();
      expect(screen.getAllByText(/^Deviation \d$/).map((el) => el.textContent))
        .toEqual(['Deviation 1', 'Deviation 2', 'Deviation 3', 'Deviation 4', 'Deviation 5']);
      expect(screen.getByText('1–5 of 7')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Next deviations' }));

      expect(screen.getAllByText(/^Deviation \d$/).map((el) => el.textContent)).toEqual(['Deviation 6', 'Deviation 7']);
    } finally {
      deviations.length = 0;
    }
  });
});
