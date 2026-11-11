import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ComplianceOverview from './ComplianceOverview';

// The Rwanda outpatient protocol: a visit group with a consultation group inside it, and lab results
// under lab order. Registration sits outside every group. Patient counts are Rwanda UAT's. Each step in
// a group is counted per time it was expected (its step instances) as well as per patient.
const metric = (actionId: string, patients: number, done: number, times?: number, timesDone?: number) => ({
  actionId, totalInstances: patients, completedCount: done, completionRate: done / patients,
  timelinessDistribution: { completedOnTime: done, completedLate: 0 },
  overdueCount: 0, missedCount: 0, notStartedCount: patients - done, slaUnjudgedCount: 0,
  avgDaysToComplete: 0, medianDaysToComplete: 0,
  stepInstanceCount: times, completedStepInstanceCount: timesDone,
});

vi.mock('../hooks/useProtocols', () => ({
  useStepAnalytics: () => ({
    data: {
      protocolDefinitionId: 'p1', protocolCanonical: 'http://x/PD/op|2.0.0',
      steps: [
        metric('registration', 50, 50, 50, 50),
        metric('visit-encounter', 97, 97, 140, 140),
        metric('vitals-recording', 105, 21, 150, 30),
        metric('consultation', 83, 73, 120, 100),
        metric('chief-complaints', 43, 43, 60, 60),
        metric('history-assessment', 9, 9, 12, 12),
        metric('lab-order', 31, 31, 40, 40),
        metric('lab-results', 20, 12, 25, 14),
        metric('diagnosis', 82, 27, 118, 38),
        metric('treatment', 23, 23, 30, 30),
        metric('referral', 15, 15, 18, 18),
      ],
      groups: [
        { groupActionId: 'outpatient-visit', title: 'Outpatient Visit', patientCount: 105, instanceCount: 150, completedInstanceCount: 60, completionRate: 0.4 },
        { groupActionId: 'clinical-consultation', title: 'Clinical Consultation', patientCount: 83, instanceCount: 120, completedInstanceCount: 90, completionRate: 0.75 },
      ],
    },
    isLoading: false, error: null,
  }),
  useActionOrder: () => ({
    data: [
      { actionId: 'registration', parentActionId: null, type: null, title: 'Registration' },
      { actionId: 'outpatient-visit', parentActionId: null, type: null, title: 'Outpatient Visit', group: true },
      { actionId: 'visit-encounter', parentActionId: 'outpatient-visit', type: null, title: 'Patient Visit' },
      { actionId: 'vitals-recording', parentActionId: 'outpatient-visit', type: null, title: 'Vitals Recording' },
      { actionId: 'clinical-consultation', parentActionId: 'outpatient-visit', type: null, title: 'Clinical Consultation', group: true },
      { actionId: 'consultation', parentActionId: 'clinical-consultation', type: null, title: 'Clinical Consultation' },
      { actionId: 'chief-complaints', parentActionId: 'clinical-consultation', type: null, title: 'Chief Complaints' },
      { actionId: 'history-assessment', parentActionId: 'clinical-consultation', type: null, title: 'History of Present Illness' },
      { actionId: 'lab-order', parentActionId: 'clinical-consultation', type: null, title: 'Laboratory Order' },
      { actionId: 'lab-results', parentActionId: 'lab-order', type: null, title: 'Laboratory Results' },
      { actionId: 'diagnosis', parentActionId: 'clinical-consultation', type: null, title: 'Clinical Diagnosis' },
      { actionId: 'treatment', parentActionId: 'clinical-consultation', type: null, title: 'Treatment Prescription' },
      { actionId: 'referral', parentActionId: 'clinical-consultation', type: null, title: 'Referral' },
    ],
    isLoading: false, error: null,
  }),
}));
vi.mock('../hooks/useComplianceSummary', () => ({
  useProtocolComplianceSummary: () => ({
    data: {
      protocolDefinitionId: 'p1', protocolCanonical: 'http://x/PD/op|2.0.0', totalEnrollments: 105,
      compliantPatients: 2, complianceRate: 0.019,
      statusBreakdown: { active: 105, completed: 0, withdrawn: 0, expired: 0 },
      stepMetrics: { totalSteps: 975, completed: 713, notStarted: 262, slaMet: 168, overdue: 11, missed: 281,
        slaUnjudged: 515, completedOnTime: 168, completedLate: 48 },
      deviationCount: 0, deviationBreakdown: { overdue: 0, missed: 0, orderViolation: 0 },
    },
    isLoading: false, error: null,
  }),
}));
vi.mock('../hooks/useLookups', () => ({
  useProtocols: () => ({ data: [{ id: 'p1', title: 'Facility service journey', url: 'http://x/PD/op', version: '2.0.0' }] }),
  useFacilityLookup: () => ({ data: [] }),
}));

function renderPage() {
  render(
    <MemoryRouter>
      <ComplianceOverview />
    </MemoryRouter>,
  );
}

describe('ComplianceOverview — Service Workflow Compliance with step groups', () => {
  it('nests the consultation group inside the visit group, and lab results under lab order', () => {
    renderPage();
    const visit = screen.getByTestId('workflow-outpatient-visit');
    const consultation = within(visit).getByTestId('workflow-clinical-consultation');
    const labOrder = within(consultation).getByTestId('workflow-lab-order');
    expect(within(labOrder).getByTestId('workflow-lab-results')).toBeInTheDocument();
    // Every step of the consultation group, in protocol order, inside it. The count takes in every
    // step below the group, lab results under lab order included.
    expect(consultation).toHaveTextContent('Steps (8)');
    const steps = within(consultation).getAllByTestId(/^workflow-/)
      .filter((el) => el.parentElement?.closest('[data-testid^="workflow-"]') === consultation)
      .map((el) => el.dataset.testid?.replace('workflow-', ''));
    expect(steps).toEqual(['consultation', 'chief-complaints', 'history-assessment', 'lab-order', 'diagnosis',
      'treatment', 'referral']);
    expect(within(consultation).getByTestId('workflow-diagnosis')).toHaveTextContent('38/118 times · 27/82 patients');
    // Not a second top-level card beside the visit.
    expect(screen.getAllByTestId(/^workflow-/).filter((el) => el.parentElement?.closest('[data-testid^="workflow-"]') === null)
      .map((el) => el.dataset.testid)).toEqual(['workflow-registration', 'workflow-outpatient-visit']);
  });

  it('counts a step in a group per time it was expected, with its patients alongside', () => {
    renderPage();
    const vitals = screen.getByTestId('workflow-vitals-recording');
    expect(vitals).toHaveTextContent('20%');
    expect(vitals).toHaveTextContent('30/150 times · 21/105 patients');
  });

  it('counts a step outside every group per patient, against the patients before it', () => {
    renderPage();
    // The first step is measured against every tracked patient.
    expect(screen.getByTestId('workflow-registration')).toHaveTextContent('50 of 105 patients completed');
  });

  it("shows a group's own figures: how often it opened, for how many patients, and how often it was completed", () => {
    renderPage();
    const visit = screen.getByTestId('workflow-outpatient-visit');
    expect(visit).toHaveTextContent('150 opened for 105 patients · 40% completed (60/150)');
    expect(visit).toHaveTextContent('Steps (10)');
  });
});
