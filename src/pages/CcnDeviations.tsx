import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/shared/PageHeader';
import { MetricCard } from '../components/shared/MetricCard';
import { Card } from '../components/shared/Card';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ErrorAlert } from '../components/shared/ErrorAlert';
import { DeviationTrendChart } from '../components/charts/DeviationTrendChart';
import { useDeviationTrends, useDeviationsByAction } from '../hooks/useDeviations';
import { useActionOrder } from '../hooks/useProtocols';
import { useProtocols, useFacilityLookup } from '../hooks/useLookups';
import { useGlobalFilters } from '../hooks/useGlobalFilters';
import { getDeviations } from '../api/deviations';
import { formatNumber } from '../utils/formatters';
import { formatDate } from '../utils/dates';
import { INTERVAL_OPTIONS } from '../config';

const ACTION_FILTER = (id: string) =>
  id.toLowerCase().includes('anc') && id.toLowerCase().includes('referral');

export default function CcnDeviations() {
  const [interval, setInterval] = useState('weekly');
  const [deviationType, setDeviationType] = useState('');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [disputeMsg, setDisputeMsg] = useState<string | null>(null);
  const PAGE_SIZE = 20;
  const filters = useGlobalFilters();

  const trends = useDeviationTrends(interval);
  const byAction = useDeviationsByAction();
  const protocols = useProtocols();
  const protocolId = protocols.data?.[0]?.id ?? '';
  const actionOrder = useActionOrder(protocolId);

  const actionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    actionOrder.data?.forEach((a) => {
      if (a.title) map.set(a.actionId, a.title);
    });
    return map;
  }, [actionOrder.data]);

  const getActionName = (actionId: string) => actionNameMap.get(actionId) || actionId;

  const facilities = useFacilityLookup();
  const facilityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    facilities.data?.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [facilities.data]);
  const getFacilityName = (facilityId: string) => facilityNameMap.get(facilityId) || facilityId;

  const filteredByAction = useMemo(
    () => byAction.data?.filter((a) => ACTION_FILTER(a.actionId)) ?? [],
    [byAction.data],
  );

  const metrics = useMemo(() => {
    const totals = { total: 0, overdue: 0, missed: 0, orderViolation: 0 };
    filteredByAction.forEach((a) => {
      totals.total += a.totalDeviations;
      totals.overdue += a.overdueCount;
      totals.missed += a.missedCount;
      totals.orderViolation += a.orderViolationCount;
    });
    return totals;
  }, [filteredByAction]);

  const deviationList = useQuery({
    queryKey: ['ccn', 'deviations', 'list', { deviationType, ...filters }],
    queryFn: () => getDeviations({
      deviationType: deviationType || undefined,
      ...filters,
      limit: 1000,
    }),
  });

  const filteredList = useMemo(() => {
    const actionFiltered = deviationList.data?.data.filter((d) => ACTION_FILTER(d.actionId)) ?? [];
    if (!searchQuery.trim()) return actionFiltered;
    const q = searchQuery.trim().toLowerCase();
    return actionFiltered.filter((d) => d.patientId.toLowerCase().includes(q));
  }, [deviationList.data, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredList.slice(start, start + PAGE_SIZE);
  }, [filteredList, page]);

  const handleDispute = () => {
    setDisputeMsg('Facility Notified.');
    setTimeout(() => setDisputeMsg(null), 3000);
  };

  return (
    <>
      <PageHeader title="Deviation Analytics" description="ANC Visit Referral Closure deviations" />


      {byAction.isLoading ? <LoadingSpinner /> : byAction.error ? <ErrorAlert error={byAction.error} /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard title="Total Deviations" value={formatNumber(metrics.total)} description="Total ANC Visit Referral Closure deviations." />
          <MetricCard title="Overdue" value={formatNumber(metrics.overdue)} description="Referral closure steps not completed by the due date." />
          <MetricCard title="Missed" value={formatNumber(metrics.missed)} description="Referral closure steps that exceeded the maximum allowed window." />
          <MetricCard title="Order Violation" value={formatNumber(metrics.orderViolation)} description="Referral closure steps completed out of expected sequence." />
        </div>
      )}

      <Card title="Deviation Trends" className="mt-6"
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
        {trends.isLoading ? <LoadingSpinner /> : trends.data ? (
          <DeviationTrendChart data={trends.data.trends} />
        ) : null}
      </Card>

      <div className="mt-6">
        <Card title="Most Deviated Steps">
          {byAction.isLoading ? <LoadingSpinner /> : byAction.error ? <ErrorAlert error={byAction.error} /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="pb-2 pr-4">Action</th>
                    <th className="pb-2 pr-4">Total Deviations</th>
                    <th className="pb-2 pr-4">Overdue</th>
                    <th className="pb-2 pr-4">Missed</th>
                    <th className="pb-2">Order Violation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredByAction.map((a) => (
                    <tr key={a.actionId} className="hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-900">{getActionName(a.actionId)}</td>
                      <td className="py-2 pr-4">{formatNumber(a.totalDeviations)}</td>
                      <td className="py-2 pr-4 text-amber-600">{formatNumber(a.overdueCount)}</td>
                      <td className="py-2 pr-4 text-red-600">{formatNumber(a.missedCount)}</td>
                      <td className="py-2 text-purple-600">{formatNumber(a.orderViolationCount)}</td>
                    </tr>
                  ))}
                  {filteredByAction.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-sm text-gray-500">No matching actions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="relative mt-6">
        {disputeMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-5 py-2 shadow-lg">
            <span className="text-sm font-medium text-green-800">{disputeMsg}</span>
            <button
              onClick={() => setDisputeMsg(null)}
              className="text-green-600 hover:text-green-800 text-lg font-bold leading-none"
            >
              &times;
            </button>
          </div>
        )}
      <Card title="Deviation List">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {[{ value: '', label: 'All Types' }, { value: 'OVERDUE', label: 'Overdue' }, { value: 'MISSED', label: 'Missed' }, { value: 'ORDER_VIOLATION', label: 'Order Violation' }].map((t) => (
              <button
                key={t.value}
                onClick={() => { setDeviationType(t.value); setPage(1); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  deviationType === t.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search Patient / Enter patient ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSearchQuery(searchInput); setPage(1); } }}
                className="w-64 rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <svg className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={() => { setSearchQuery(searchInput); setPage(1); }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Search
            </button>
            {searchQuery && (
              <button
                onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {deviationList.isLoading && <LoadingSpinner />}
        {deviationList.error && <ErrorAlert error={deviationList.error} />}

        {deviationList.data && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="pb-2 pr-4">Patient</th>
                    <th className="pb-2 pr-4">Action</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Reason</th>
                    <th className="pb-2 pr-4">Facility</th>
                    <th className="pb-2 pr-4">Occurred</th>
                    <th className="pb-2 pr-4">Detected</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedList.map((d) => (
                    <tr key={d.deviationId} className="hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-900">{d.patientId}</td>
                      <td className="py-2 pr-4">{getActionName(d.actionId)}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs font-bold ${d.deviationType === 'OVERDUE' ? 'text-amber-600' : d.deviationType === 'ORDER_VIOLATION' ? 'text-purple-600' : 'text-red-600'}`}>
                          {d.deviationType}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-red-600 font-medium">SLA Breached</td>
                      <td className="py-2 pr-4 text-gray-600">{getFacilityName(d.facilityId)}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatDate(d.occurredAt)}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatDate(d.detectedAt)}</td>
                      <td className="py-2">
                        <button
                          onClick={handleDispute}
                          className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition-colors"
                        >
                          Request Follow-up
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedList.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-sm text-gray-500">No ANC Visit Referral Closure deviations found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
              <p className="text-sm text-gray-600">
                Showing {filteredList.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredList.length)} of {filteredList.length} deviations
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
      </div>
    </>
  );
}
