import type { HandoffMetric } from '../../api/dashboard';
import { formatNumber, formatPercentage } from '../../utils/formatters';
import { MetricCard } from './MetricCard';

/** Each hand-off card's name and ⓘ text, by the hand-off's key (the service's cce.insights.handoffs.items). */
export const HANDOFF_CARDS: Record<string, { title: string; description: string }> = {
  'referral-consultation': {
    title: 'Delayed UHC Consultations',
    description:
      'CHW referrals from the community where the patient was not seen at the UHC within the time limit, out of those due.',
  },
  'consultation-ecg': {
    title: 'Delayed ECG Tests',
    description: 'ECGs ordered at the UHC that were not recorded within the time limit, out of those due.',
  },
  'ecg-reviewed': {
    title: 'Delayed ECG Reviews',
    description: 'ECGs recorded at the UHC that the doctor did not review within the time limit, out of those due.',
  },
  'pci-referral-acknowledged': {
    title: 'Delayed Cardiac Acknowledgments',
    description:
      'PCI referrals from the UHC that the cardiac centre did not acknowledge within the time limit, out of those due.',
  },
  'acknowledged-stent': {
    title: 'Delayed Stent Procedures',
    description:
      'Acknowledged PCI referrals where the cardiac centre did not record the stent outcome within the time limit, out of those due.',
  },
};

/**
 * Referral hand-off deviations: one card per hand-off of the referral pathway, in order, like the other dashboard
 * metrics: how many missed their time limit (done late, or still not done past it), out of those due.
 */
export function HandoffMetrics({ handoffs }: { handoffs: HandoffMetric[] }) {
  if (handoffs.length === 0) {
    return <p className="py-2 text-sm text-gray-500">No referral hand-offs are configured.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {handoffs.map((h) => {
        const due = h.total - h.pending;
        // A hand-off the UI has no name for yet shows its key
        const card = HANDOFF_CARDS[h.key] ?? { title: h.key, description: '' };
        return (
          <div key={h.key} data-testid={`handoff-${h.key}`}>
            <MetricCard
              title={card.title}
              subtitle={due > 0 ? `${formatPercentage(100 - h.deviationRate)} on time` : 'None due yet'}
              description={card.description}
              value={formatNumber(h.deviations)}
              denomination={formatNumber(due)}
              bgColor={h.deviations > 0 ? 'bg-red-50' : due > 0 ? 'bg-green-50' : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
