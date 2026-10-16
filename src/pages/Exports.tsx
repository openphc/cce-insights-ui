import { useState, useContext } from 'react';
import { PageHeader } from '../components/shared/PageHeader';
import { Card } from '../components/shared/Card';
import { FilterContext } from '../context/FilterContext';
import { useGlobalFilters } from '../hooks/useGlobalFilters';
import { getExportUrl } from '../api/exports';

export default function Exports() {
  const { startDate, endDate } = useContext(FilterContext);
  // The export endpoint takes OffsetDateTime, so send the UTC day boundaries, not the raw dates.
  const filters = useGlobalFilters();
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [protocolId, setProtocolId] = useState('');
  const [facilityId, setFacilityId] = useState('');

  const handleDownload = () => {
    const url = getExportUrl({
      format,
      protocolDefinitionId: protocolId || undefined,
      facilityId: facilityId || undefined,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <PageHeader title="Export Compliance Data" description="Download compliance data as CSV or JSON" />

      <Card title="Export Configuration">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">JSON</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">CSV</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Protocol</label>
            <input
              type="text"
              value={protocolId}
              onChange={(e) => setProtocolId(e.target.value)}
              placeholder="All Protocols"
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Facility</label>
            <input
              type="text"
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              placeholder="All Facilities"
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date Range</label>
            <p className="text-sm text-gray-600">{startDate} to {endDate}</p>
            <p className="text-xs text-gray-400 mt-0.5">Uses the global date range filter</p>
          </div>

          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Report
          </button>
        </div>
      </Card>
    </>
  );
}
