import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ProtocolFilter } from '../components/shared/ProtocolFilter';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/shared/PageHeader';
import { MetricCard } from '../components/shared/MetricCard';
import { Card } from '../components/shared/Card';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ErrorAlert } from '../components/shared/ErrorAlert';
import { DeviationTrendChart } from '../components/charts/DeviationTrendChart';
import { useIntelligenceSummary, useDeviationTrends, useDeviationsByAction } from '../hooks/useDeviations';
import { useActionOrder } from '../hooks/useProtocols';
import { useGlobalFilters } from '../hooks/useGlobalFilters';
import { useFacilityLookup } from '../hooks/useLookups';
import { getDeviations } from '../api/deviations';
import { formatNumber } from '../utils/formatters';
import { formatDate } from '../utils/dates';
import { INTERVAL_OPTIONS } from '../config';

export default function Deviations() {
  const [protocolId, setProtocolId] = useState('');
  const [interval, setInterval] = useState('weekly');
  const [deviationType, setDeviationType] = useState('');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const PAGE_SIZE = 20;
  const filters = useGlobalFilters();

  const intel = useIntelligenceSummary();
  const trends = useDeviationTrends(interval);
  const byAction = useDeviationsByAction(protocolId || undefined);
  const actionOrder = useActionOrder(protocolId);
  const facilities = useFacilityLookup();

  const actionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    actionOrder.data?.forEach((a) => {
      if (a.title) map.set(a.actionId, a.title);
    });
    return map;
  }, [actionOrder.data]);

  const getActionName = (actionId: string) => actionNameMap.get(actionId) || actionId;

  const facilityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    facilities.data?.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [facilities.data]);

  const getFacilityName = (facilityId: string) => facilityNameMap.get(facilityId) || facilityId;

  const deviationList = useQuery({
    queryKey: ['deviations', 'list', { deviationType, protocolId, ...filters }],
    queryFn: () => getDeviations({
      deviationType: deviationType || undefined,
      protocolDefinitionId: protocolId || undefined,
      ...filters,
      limit: 1000,
    }),
  });

  const filteredDeviations = useMemo(() => {
    if (!deviationList.data?.data) return [];
    if (!searchQuery.trim()) return deviationList.data.data;
    const q = searchQuery.trim().toLowerCase();
    return deviationList.data.data.filter((d) =>
      d.patientId.toLowerCase().includes(q)
    );
  }, [deviationList.data, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDeviations.length / PAGE_SIZE));
  const paginatedDeviations = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredDeviations.slice(start, start + PAGE_SIZE);
  }, [filteredDeviations, page]);

  return (
    <>
      <PageHeader title="Deviation Analytics" description="Trends, most-deviated steps, resolution rate" />

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-gray-500">Protocol</label>
        <ProtocolFilter value={protocolId} onChange={(v) => { setProtocolId(v); setPage(1); }} />
      </div>

      {intel.isLoading ? <LoadingSpinner /> : intel.error ? <ErrorAlert error={intel.error} /> : intel.data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard title="Total Deviations" value={formatNumber(intel.data.totalDeviations)} description="Total number of protocol deviations detected across all patients and facilities." />
          <MetricCard title="Overdue" value={formatNumber(intel.data.byType?.overdue ?? 0)} description="Steps that were not completed by the due date and are still pending." />
          <MetricCard title="Missed" value={formatNumber(intel.data.byType?.missed ?? 0)} description="Steps that exceeded the maximum allowed window and are now considered missed." />
          <MetricCard title="Order Violation" value={formatNumber(intel.data.byType?.orderViolation ?? 0)} description="Steps completed out of the expected sequence order defined in the protocol." />
        </div>
      ) : null}

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
          {byAction.isLoading ? <LoadingSpinner /> : byAction.error ? <ErrorAlert error={byAction.error} /> : byAction.data ? (
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
                  {byAction.data.map((a) => (
                    <tr key={a.actionId} className="hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-900">{getActionName(a.actionId)}</td>
                      <td className="py-2 pr-4">{formatNumber(a.totalDeviations)}</td>
                      <td className="py-2 pr-4 text-amber-600">{formatNumber(a.overdueCount)}</td>
                      <td className="py-2 pr-4 text-red-600">{formatNumber(a.missedCount)}</td>
                      <td className="py-2 text-purple-600">{formatNumber(a.orderViolationCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </div>

      <Card title="Deviation List" className="mt-6">
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
                    <th className="pb-2 pr-4">Facility</th>
                    <th className="pb-2 pr-4">Occurred</th>
                    <th className="pb-2">Detected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedDeviations.map((d) => (
                    <tr key={d.deviationId} className="hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <Link
                          to={`/compliance/patients/${encodeURIComponent(d.patientId)}?protocolInstanceId=${encodeURIComponent(d.protocolInstanceId)}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          {d.patientId}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{getActionName(d.actionId)}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs font-bold ${d.deviationType === 'OVERDUE' ? 'text-amber-600' : d.deviationType === 'ORDER_VIOLATION' ? 'text-purple-600' : 'text-red-600'}`}>
                          {d.deviationType}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{getFacilityName(d.facilityId)}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatDate(d.occurredAt)}</td>
                      <td className="py-2 text-gray-600">{formatDate(d.detectedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
              <p className="text-sm text-gray-600">
                Showing {filteredDeviations.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredDeviations.length)} of {filteredDeviations.length} deviations
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
    </>
  );
}
