import { Routes, Route, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { CcnSidebar } from './components/layout/CcnSidebar';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { DateRangeFilter } from './components/shared/DateRangeFilter';
import { authEnabled, logout } from './auth/keycloak';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ComplianceOverview = lazy(() => import('./pages/ComplianceOverview'));
const ProtocolAnalytics = lazy(() => import('./pages/ProtocolAnalytics'));
const PatientList = lazy(() => import('./pages/PatientList'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const Deviations = lazy(() => import('./pages/Deviations'));
const EventVolume = lazy(() => import('./pages/EventVolume'));
const SourceComparison = lazy(() => import('./pages/SourceComparison'));
const FacilityAnalytics = lazy(() => import('./pages/FacilityAnalytics'));
const PractitionerAnalytics = lazy(() => import('./pages/PractitionerAnalytics'));
const IngestionPipeline = lazy(() => import('./pages/IngestionPipeline'));
const Exports = lazy(() => import('./pages/Exports'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const CcnDeviations = lazy(() => import('./pages/CcnDeviations'));
const CcnFacilityAnalytics = lazy(() => import('./pages/CcnFacilityAnalytics'));
const CcnPractitionerAnalytics = lazy(() => import('./pages/CcnPractitionerAnalytics'));
const CcnDisputes = lazy(() => import('./pages/CcnDisputes'));

function ProtectedLayout() {
  const location = useLocation();
  const isCcn = location.pathname.startsWith('/ccn');

  return (
    <div className="flex min-h-screen bg-gray-50">
      {isCcn ? <CcnSidebar /> : <Sidebar />}
      <div className="ml-56 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-end gap-4 border-b border-gray-200 bg-white px-6 py-2.5">
          <DateRangeFilter />
          {authEnabled && (
            <button
              type="button"
              onClick={() => logout()}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
            >
              Sign out
            </button>
          )}
        </header>
        <main className="p-6">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/compliance" element={<ComplianceOverview />} />
              <Route path="/compliance/protocols/:id" element={<ProtocolAnalytics />} />
              <Route path="/compliance/patients" element={<PatientList />} />
              <Route path="/compliance/patients/:id" element={<PatientDetail />} />
              <Route path="/deviations" element={<Deviations />} />
              <Route path="/events" element={<EventVolume />} />
              <Route path="/events/source-comparison" element={<SourceComparison />} />
              <Route path="/facilities" element={<FacilityAnalytics />} />
              <Route path="/practitioners" element={<PractitionerAnalytics />} />
              <Route path="/ingestion" element={<IngestionPipeline />} />
              <Route path="/intelligence" element={<Intelligence />} />
              <Route path="/exports" element={<Exports />} />
              {/* CCN View */}
              <Route path="/ccn" element={<Dashboard />} />
              <Route path="/ccn/deviations" element={<CcnDeviations />} />
              <Route path="/ccn/facilities" element={<CcnFacilityAnalytics />} />
              <Route path="/ccn/practitioners" element={<CcnPractitionerAnalytics />} />
              <Route path="/ccn/disputes" element={<CcnDisputes />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
