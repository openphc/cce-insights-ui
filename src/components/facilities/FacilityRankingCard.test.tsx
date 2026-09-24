import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FacilityRankingCard } from './FacilityRankingCard';

// RI-33: the adoption columns are period totals. Mock the four data hooks the card reads so we
// can assert the rendered header labels + period values without a network/react-query layer.
// Values mirror the ticket mock-up (Kacyiru 0035: 220 expected / 1 actual / gap 219 / 0.45%).
vi.mock('../../hooks/useFacilities', () => ({
  useFacilityRanking: () => ({
    data: { data: [{
      facilityId: '0035', rank: 1, facilityName: 'Kacyiru District Hospital',
      complianceRate: 60, totalEnrollments: 5, nonCompliantPatients: 2, activeDeviations: 7, totalEvents: 146,
    }] },
    isPending: false, error: null,
  }),
  useAdoptionKpis: () => ({
    data: [{
      facilityId: '0035', facilityName: 'Kacyiru District Hospital', district: '',
      expectedVisits: 220, actualVisits: 1, adoptionRate: 0.45, reportingGap: 219,
    }],
  }),
  useFacilityActivityDetail: () => ({ data: [{ facilityId: '0035', active: true }] }),
}));

vi.mock('../../hooks/useDashboard', () => ({
  useReferralsKpi: () => ({ data: { byFacility: [{ facilityId: '0035', count: 0 }] } }),
}));

function renderCard() {
  render(
    <MemoryRouter>
      <FacilityRankingCard />
    </MemoryRouter>,
  );
}

describe('FacilityRankingCard — RI-33 adoption columns', () => {
  it('renders the period-scoped e-Buzima Adoption header labels', () => {
    renderCard();
    expect(screen.getByText('e-Buzima Adoption (Selected Period)')).toBeInTheDocument();
    expect(screen.getByText('Expected Visits (Period)')).toBeInTheDocument();
    expect(screen.getByText('Actual Visits (Period)')).toBeInTheDocument();
    expect(screen.getByText('Reporting Gap')).toBeInTheDocument();
  });

  it('does not use the old per-day labels', () => {
    renderCard();
    expect(screen.queryByText(/Visits \/ Day/)).toBeNull();
    expect(screen.queryByText(/Reporting Gap \/ Day/)).toBeNull();
  });

  it('renders period totals from the DTO: expected, actual, and signed reporting gap', () => {
    renderCard();
    expect(screen.getByText('220')).toBeInTheDocument();            // expectedVisits (period)
    expect(screen.getByText('−219')).toBeInTheDocument();     // reportingGap, under-reporting → −219 (U+2212)
    expect(screen.getByText('0.45%')).toBeInTheDocument();          // adoptionRate
  });
});

describe('FacilityRankingCard — Tracked Patients / Patients with Deviations columns', () => {
  it('places Tracked Patients before Referrals, outside the Compliance group', () => {
    renderCard();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.indexOf('Tracked Patients')).toBeGreaterThan(-1);
    expect(headers.indexOf('Tracked Patients')).toBeLessThan(headers.indexOf('Referrals'));
  });

  it('shows distinct patients with deviations, not the raw deviation count', () => {
    renderCard();
    expect(screen.getByText('Patients with Deviations')).toBeInTheDocument();
    expect(screen.queryByText('Deviations')).toBeNull();
    expect(screen.getByText('5')).toBeInTheDocument();   // totalEnrollments (tracked)
    expect(screen.getByText('2')).toBeInTheDocument();   // nonCompliantPatients
    expect(screen.queryByText('7')).toBeNull();          // activeDeviations no longer rendered
  });
});

describe('FacilityRankingCard — RI-62 Events column', () => {
  it('renders the Events column header and the row\'s totalEvents value', () => {
    renderCard();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('146')).toBeInTheDocument();   // totalEvents from the ranking row
  });
});
