import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '../components/shared/PageHeader';
import { Card } from '../components/shared/Card';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ErrorAlert } from '../components/shared/ErrorAlert';
import { CompletionFunnelChart } from '../components/charts/CompletionFunnelChart';
import { OutcomeDistributionChart } from '../components/charts/OutcomeDistributionChart';
import { EnrollmentTrendChart } from '../components/charts/EnrollmentTrendChart';
import { useStepAnalytics, useCompletionFunnel, useOutcomeDistribution, useEnrollmentTrends } from '../hooks/useProtocols';
import { formatDaysVsDue, formatNumber, formatRate } from '../utils/formatters';
import { INTERVAL_OPTIONS } from '../config';

export default function ProtocolAnalytics() {
  const { id } = useParams<{ id: string }>();
  const protocolId = id ?? '';
  const [interval, setInterval] = useState('weekly');

  const steps = useStepAnalytics(protocolId);
  const funnel = useCompletionFunnel(protocolId);
  const outcomes = useOutcomeDistribution(protocolId);
  const enrollment = useEnrollmentTrends(protocolId, interval);

  const isLoading = steps.isLoading || funnel.isLoading;

  return (
    <>
      <div className="mb-2">
        <Link to="/compliance" className="text-sm text-blue-600 hover:text-blue-700">← Back to Compliance</Link>
      </div>
      <PageHeader
        title={`Protocol Analytics — ${protocolId}`}
        description="Step-level analytics, completion funnel, outcome distribution, tracking trends"
      />

      {isLoading && <LoadingSpinner />}
      {steps.error && <ErrorAlert error={steps.error} />}

      {steps.data && (
        <Card title="Step Analytics">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">Completed</th>
                  <th className="pb-2 pr-4">Rate</th>
                  <th className="pb-2 pr-4">On Time</th>
                  <th className="pb-2 pr-4">Late</th>
                  <th className="pb-2" title="Average of completion date minus due date, for completed steps that have a due date">Avg vs Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {steps.data.steps.map((s) => (
                  <tr key={s.actionId} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-900">{s.actionId}</td>
                    <td className="py-2 pr-4">{formatNumber(s.completedCount)}/{formatNumber(s.totalInstances)}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
                          {/* completionRate is a 0–1 fraction */}
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(s.completionRate * 100, 100)}%` }} />
                        </div>
                        <span>{formatRate(s.completionRate)}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4">{formatNumber(s.timelinessDistribution.completedOnTime)}</td>
                    <td className="py-2 pr-4 text-amber-600">{formatNumber(s.timelinessDistribution.completedLate)}</td>
                    <td className="py-2 text-gray-600">{formatDaysVsDue(s.avgDaysToComplete)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Completion Funnel">
          {funnel.isLoading ? <LoadingSpinner /> : funnel.data ? (
            <CompletionFunnelChart data={funnel.data.funnel} />
          ) : null}
        </Card>
        <Card title="Outcome Distribution">
          {outcomes.isLoading ? <LoadingSpinner /> : outcomes.data ? (
            <OutcomeDistributionChart distribution={outcomes.data.distribution} />
          ) : null}
        </Card>
      </div>

      <Card title="Tracking Trends" className="mt-6"
        action={
          <div className="flex gap-1">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInterval(opt.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  interval === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      >
        {enrollment.isLoading ? <LoadingSpinner /> : enrollment.data ? (
          <EnrollmentTrendChart data={enrollment.data.trends} />
        ) : null}
      </Card>
    </>
  );
}
