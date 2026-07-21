import { NavLink } from 'react-router-dom';
import {
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  CogIcon,
  ArrowDownTrayIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: ChartBarIcon },
  { to: '/compliance', label: 'Compliance', icon: ClipboardDocumentCheckIcon },
  { to: '/practitioners', label: 'Practitioners', icon: UserGroupIcon },
  { to: '/deviations', label: 'Deviations', icon: ExclamationTriangleIcon },
  { to: '/intelligence', label: 'Intelligence', icon: BoltIcon },
  { to: '/compliance/patients', label: 'Patients', icon: ClipboardDocumentCheckIcon },
  { to: '/events', label: 'Events', icon: SignalIcon },
  { to: '/ingestion', label: 'Ingestion', icon: CogIcon },
  { to: '/exports', label: 'Exports', icon: ArrowDownTrayIcon },
  { to: '/facilities', label: 'Facilities', icon: BuildingOffice2Icon },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-gray-100 px-4">
        <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <span className="text-xs font-bold text-white">C</span>
        </div>
        <span className="text-sm font-bold text-gray-900">CHW App Care Coordination Insights</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/' || to === '/compliance'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
