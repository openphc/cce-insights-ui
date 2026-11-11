import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { PageHeader } from '../components/shared/PageHeader';
import { Card } from '../components/shared/Card';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ErrorAlert } from '../components/shared/ErrorAlert';
import { StatusBadge } from '../components/shared/StatusBadge';
import { PagedList } from '../components/shared/PagedList';
import { usePatientTimeline, usePatientProtocolTracking, usePatientProtocolTrackingDetail, usePatientDeviations, usePatientIntelligenceDeliveries } from '../hooks/usePatients';
import { useActionOrder } from '../hooks/useProtocols';
import { formatDate, formatDateTime } from '../utils/dates';
import { formatPercentage } from '../utils/formatters';
import { STATUS_COLORS, STATE_COLORS } from '../utils/colors';
import type { ProtocolInstanceStatus, JourneyStep, GroupInstance, StepDisplayStatus } from '../api/types';
import { isUntriggered, stepDisplayStatus, stepsOnly, visibleJourneySteps } from '../utils/stepStatus';
import {
  chipLayout, chipTone, groupInstanceChipName, groupInstanceName, groupInstancesWithDeviations, groupPathLabel,
  selectionFor, selectionFromParam, showCycles, spansYears,
  type ChipTone, type CycleSelection, type NumberedGroupInstance,
} from '../utils/groupCycles';
import { ChevronDownIcon, ClockIcon } from '@heroicons/react/20/solid';

// PENDING is a UI-only state: the step exists but its event has not arrived and no deadline has
// been breached. The API reports it as NOT_STARTED, the same as an action with no step yet, and only
// stepStatus (null for the latter) tells the two apart.
type JourneyDisplayStatus = JourneyStep['status'] | 'PENDING' | 'DEVIATION';

/** Convert Google Drive URLs to embeddable thumbnail URLs */
function toDirectImageUrl(url: string): string {
  // Match /file/d/ID or uc?...id=ID formats
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (fileMatch) return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w200`;
  const ucMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (ucMatch) return `https://drive.google.com/thumbnail?id=${ucMatch[1]}&sz=w200`;
  return url;
}

const JOURNEY_STATUS: Record<JourneyDisplayStatus, { bg: string; text: string; dot: string; label: string }> = {
  COMPLETED:   { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Completed' },
  PENDING:     { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400',   label: 'Pending' },
  OVERDUE:     { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Overdue' },
  MISSED:      { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Missed' },
  NOT_STARTED: { bg: 'bg-gray-50',   text: 'text-gray-400',   dot: 'bg-gray-300',   label: 'Not Started' },
  DEVIATION:   { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Deviation' },
};

/** A group instance's status. NOT_STARTED means the instance is open, so it reads "In progress". */
const GROUP_INSTANCE_STATUS: Record<StepDisplayStatus, { label: string; style: JourneyDisplayStatus }> = {
  COMPLETED:   { label: 'Completed',   style: 'COMPLETED' },
  NOT_STARTED: { label: 'In progress', style: 'PENDING' },
  OVERDUE:     { label: 'Overdue',     style: 'OVERDUE' },
  MISSED:      { label: 'Missed',      style: 'MISSED' },
};

/** How many deviations, and how many intelligence alerts, the side lists show a page. */
const SIDE_LIST_PAGE_SIZE = 5;

/** A visit chip's dot, by what it says about the visit. */
const CHIP_TONE: Record<ChipTone, { dot: string; label: string }> = {
  COMPLETED:   { dot: 'bg-green-500',  label: 'Completed' },
  IN_PROGRESS: { dot: 'bg-purple-500', label: 'In progress' },
  DEVIATION:   { dot: 'bg-red-500',    label: 'Has deviation' },
};

/**
 * A step group's instances, such as its visits, as chips: the latest few, newest first, and the rest
 * behind an "earlier visits" menu. Each chip has a dot: completed, in progress, or has a deviation.
 * With more than one instance, each chip is a button: picking one shows that instance's steps below.
 * The line under the chips says which instance is shown, and how far along it is.
 */
function GroupInstanceList({ instances, shownInstanceId, deviatedInstanceIds, onShow }: {
  instances: GroupInstance[];
  shownInstanceId: string | null;
  deviatedInstanceIds: Set<string>;
  onShow: (groupInstanceId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on a click outside it, or on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const selectable = instances.length > 1;
  const withYear = spansYears(instances);
  const { chips, earlier } = chipLayout(instances, shownInstanceId);
  const shown = [...chips, ...earlier].find((n) => n.instance.groupInstanceId === shownInstanceId);

  /** In full, such as "#6 · Oct 1, 2026 · In progress · 2/4 steps · has a deviation". */
  const describe = ({ instance, number }: NumberedGroupInstance) => {
    const status = GROUP_INSTANCE_STATUS[instance.status] ?? GROUP_INSTANCE_STATUS.NOT_STARTED;
    const deviation = chipTone(instance, deviatedInstanceIds) === 'DEVIATION' ? ' · has a deviation' : '';
    return `${groupInstanceName(number, instance.openedAt)} · ${status.label} · `
      + `${instance.completedSteps}/${instance.totalSteps} steps${deviation}`;
  };
  const dot = (instance: GroupInstance) => (
    <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${CHIP_TONE[chipTone(instance, deviatedInstanceIds)].dot}`} />
  );
  const chipStyle = 'inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1 text-xs font-medium text-gray-800';

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((n) => {
          const content = <>{dot(n.instance)}<span>{groupInstanceChipName(n.number, n.instance.openedAt, withYear)}</span></>;
          if (!selectable) {
            return <span key={n.instance.groupInstanceId} title={describe(n)} className={`${chipStyle} border-gray-200`}>{content}</span>;
          }
          const isShown = n.instance.groupInstanceId === shownInstanceId;
          return (
            <button
              key={n.instance.groupInstanceId}
              type="button"
              aria-pressed={isShown}
              aria-label={describe(n)}
              title={describe(n)}
              onClick={() => onShow(n.instance.groupInstanceId)}
              className={`${chipStyle} ${isShown ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              {content}
            </button>
          );
        })}
        {earlier.length > 0 && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className={`${chipStyle} border-gray-200 text-gray-600 hover:bg-gray-50`}
            >
              <ClockIcon aria-hidden className="h-3.5 w-3.5" />
              {earlier.length} earlier visit{earlier.length > 1 ? 's' : ''}
              <ChevronDownIcon aria-hidden className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute left-0 z-20 mt-1 max-h-64 min-w-[16rem] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {earlier.map((n) => (
                  <button
                    key={n.instance.groupInstanceId}
                    type="button"
                    role="menuitem"
                    aria-label={describe(n)}
                    onClick={() => { onShow(n.instance.groupInstanceId); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                  >
                    {dot(n.instance)}
                    <span className="font-medium text-gray-800">{groupInstanceName(n.number, n.instance.openedAt)}</span>
                    <span className="ml-auto pl-3 text-gray-500">
                      {(GROUP_INSTANCE_STATUS[n.instance.status] ?? GROUP_INSTANCE_STATUS.NOT_STARTED).label}
                      {' · '}{n.instance.completedSteps}/{n.instance.totalSteps}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {shown && <p className="mt-1 text-xs text-gray-500">{selectable ? 'Shown: ' : ''}{describe(shown)}</p>}
    </div>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  spice: 'bg-purple-100 text-purple-700',
  openmrs: 'bg-sky-100 text-sky-700',
  dhis2: 'bg-teal-100 text-teal-700',
  fhir: 'bg-indigo-100 text-indigo-700',
  hl7: 'bg-pink-100 text-pink-700',
};

function getSourceColor(source: string): string {
  return SOURCE_COLORS[source.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
}

/** Pins the protocol the user came here for to the top of the list, leaving the rest in place. */
function reorderByRequestedProtocol<T extends { protocolInstanceId: string }>(items: T[], requestedProtocolInstanceId: string | null): T[] {
  if (!requestedProtocolInstanceId) return items;
  const idx = items.findIndex((item) => item.protocolInstanceId === requestedProtocolInstanceId);
  if (idx <= 0) return items;
  const reordered = [...items];
  const [requested] = reordered.splice(idx, 1);
  reordered.unshift(requested);
  return reordered;
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const requestedProtocolInstanceId = searchParams.get('protocolInstanceId');
  const patientId = id ?? '';
  const [selectedProtocolInstanceId, setSelectedProtocolInstanceId] = useState<string | null>(null);
  const [hasSetDefaultSelection, setHasSetDefaultSelection] = useState(false);
  const [protocolSearch, setProtocolSearch] = useState('');
  // The cycle of each step group whose steps are shown. A group with none picked shows its latest.
  // A link can open the page at a visit, with ?visit=groupActionId:groupInstanceId,…
  const [cycleSelection, setCycleSelection] = useState<CycleSelection>(() => selectionFromParam(searchParams.get('visit')));

  // Both the patient title block and the Protocols panel below it are
  // `position: sticky`, stacked under the app's own sticky header — so both
  // offsets have to match real, measured element heights, not a guessed
  // Tailwind spacing value. The app header's height isn't fixed either: it
  // carries the Ministry of Health branding (logo + three lines of text) and
  // District/Facility/date filters, taller than a plain single-row header,
  // so a hardcoded `top-14` (56px) leaves the title block's own "← Back to
  // Patient List" link covered once scrolled.
  const titleBlockRef = useRef<HTMLDivElement>(null);
  const [headerHeightPx, setHeaderHeightPx] = useState(56);
  const [protocolsTopPx, setProtocolsTopPx] = useState(176);
  useLayoutEffect(() => {
    const headerEl = document.querySelector('header');
    const titleEl = titleBlockRef.current;
    if (!headerEl || !titleEl) return;
    // Only a sub-pixel safety margin — each sticky element's top must match
    // the one above it's stuck bottom edge almost exactly. Too little and
    // the element below gets covered once both are stuck; too much and it
    // sits detectably lower than expected even at rest, because
    // `position: sticky` enforces its `top` value immediately whenever the
    // element's natural position would otherwise be higher.
    const GAP_PX = 4;
    const measure = () => {
      const headerH = headerEl.offsetHeight;
      setHeaderHeightPx(headerH);
      setProtocolsTopPx(headerH + titleEl.offsetHeight + GAP_PX);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(headerEl);
    observer.observe(titleEl);
    return () => observer.disconnect();
  }, []);

  // Applied via inline style (not a Tailwind class) so the sticky `top`
  // is gated to desktop widths without depending on a CSS custom property —
  // matches the `lg:` breakpoint used everywhere else on this page.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Step Details stays collapsed under the selected protocol until its own
  // toggle is clicked — picking a protocol shouldn't also dump the raw step
  // table.
  const [showStepDetails, setShowStepDetails] = useState(false);

  const tracking = usePatientProtocolTracking(patientId);
  const timeline = usePatientTimeline(patientId);
  const deviations = usePatientDeviations(patientId);
  const intelligenceDeliveries = usePatientIntelligenceDeliveries(patientId);
  const detail = usePatientProtocolTrackingDetail(patientId, showStepDetails ? selectedProtocolInstanceId ?? '' : '');
  const actionOrder = useActionOrder(detail.data?.protocolDefinitionId ?? '');

  const actionNameMap = useMemo(() => {
    if (!actionOrder.data) return new Map<string, string>();
    return new Map(actionOrder.data.map((a) => [a.actionId, a.title || a.actionId]));
  }, [actionOrder.data]);

  // Whichever protocol the user came here for (clicked from the Patient
  // List's or Deviations page's protocol-filtered table, carried via
  // ?protocolInstanceId=) is pinned to the top of the list on the left.
  const orderedProtocols = useMemo(
    () => reorderByRequestedProtocol(timeline.data?.protocols ?? [], requestedProtocolInstanceId),
    [timeline.data, requestedProtocolInstanceId]
  );

  // Filters the (already-pinned) list by title, canonical URL or status — the
  // Protocols panel can otherwise hold dozens of entries with nothing but a
  // scrollbar to find one.
  const visibleProtocols = useMemo(() => {
    const query = protocolSearch.trim().toLowerCase();
    if (!query) return orderedProtocols;
    return orderedProtocols.filter((proto) => {
      const trackingMatch = tracking.data?.find((t) => t.protocolInstanceId === proto.protocolInstanceId);
      const title = trackingMatch?.protocolTitle || proto.protocolCanonical;
      return (
        title.toLowerCase().includes(query) ||
        proto.protocolCanonical.toLowerCase().includes(query) ||
        proto.status.toLowerCase().includes(query)
      );
    });
  }, [orderedProtocols, protocolSearch, tracking.data]);

  // On first load, select whichever protocol the user actually came here
  // for, else the protocol most likely to need attention (has deviations,
  // else the first active one, else just the first).
  useEffect(() => {
    if (hasSetDefaultSelection || orderedProtocols.length === 0) return;
    const protocolsWithDeviations = new Set((deviations.data ?? []).map((d) => d.protocolInstanceId));
    const defaultProtocol =
      orderedProtocols.find((p) => p.protocolInstanceId === requestedProtocolInstanceId) ??
      orderedProtocols.find((p) => protocolsWithDeviations.has(p.protocolInstanceId)) ??
      orderedProtocols.find((p) => p.status === 'ACTIVE') ??
      orderedProtocols[0];
    setSelectedProtocolInstanceId(defaultProtocol.protocolInstanceId);
    setHasSetDefaultSelection(true);
  }, [orderedProtocols, deviations.data, hasSetDefaultSelection, requestedProtocolInstanceId]);

  function selectProtocol(protocolInstanceId: string) {
    setSelectedProtocolInstanceId(protocolInstanceId);
    setShowStepDetails(false);
    setCycleSelection({});
  }

  const isLoading = tracking.isLoading || timeline.isLoading;
  const error = tracking.error || timeline.error;
  const selectedProto = orderedProtocols.find((p) => p.protocolInstanceId === selectedProtocolInstanceId);
  const selectedTrackingMatch = tracking.data?.find((t) => t.protocolInstanceId === selectedProtocolInstanceId);

  return (
    <>
      <div
        ref={titleBlockRef}
        className="lg:sticky lg:z-10 lg:bg-gray-50 lg:pb-4"
        style={isDesktop ? { top: `${headerHeightPx}px` } : undefined}
      >
        <div className="mb-2">
          <Link to="/compliance/patients" className="text-sm text-blue-600 hover:text-blue-700">← Back to Patient List</Link>
        </div>
        <PageHeader title={`Patient: ${patientId}`} />
      </div>

      {isLoading && <Card title="Protocol Journey"><LoadingSpinner /></Card>}
      {error && <Card title="Protocol Journey"><ErrorAlert error={error} /></Card>}
      {timeline.data && timeline.data.protocols.length === 0 && (
        <Card title="Protocol Journey">
          <p className="py-4 text-center text-sm text-gray-400">No protocols found for this patient.</p>
        </Card>
      )}

      {timeline.data && timeline.data.protocols.length > 0 && (
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Protocol list — pick one to see its full detail on the right */}
          <Card
            title="Protocols"
            className="lg:w-80 lg:flex-shrink-0 lg:self-start"
            style={
              isDesktop
                ? { position: 'sticky', top: `${protocolsTopPx}px` }
                : undefined
            }
          >
            {orderedProtocols.length > 5 && (
              <div className="relative mb-2">
                <svg
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input
                  type="text"
                  value={protocolSearch}
                  onChange={(e) => setProtocolSearch(e.target.value)}
                  placeholder="Search protocols…"
                  className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
            )}
            <div
              className="space-y-2 overflow-y-auto"
              // `position: sticky` can't move an element's bottom edge past its
              // containing block's (this flex row's) bottom edge — so if the
              // Protocols card is nearly as tall as the row (which the row's
              // height takes from the Protocol Journey column), there's no
              // room left to stick into and it behaves as if unstuck. Capping
              // well under the viewport height keeps the card comfortably
              // shorter than a typical journey column regardless of how many
              // protocols this patient has.
              style={isDesktop ? { maxHeight: `min(calc(100vh - ${protocolsTopPx}px - 4rem), 32rem)` } : undefined}
            >
              {visibleProtocols.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">No protocols match “{protocolSearch}”.</p>
              )}
              {visibleProtocols.map((proto) => {
                const isSelected = proto.protocolInstanceId === selectedProtocolInstanceId;
                const trackingMatch = tracking.data?.find((t) => t.protocolInstanceId === proto.protocolInstanceId);
                const title = trackingMatch?.protocolTitle || proto.protocolCanonical;
                const docArtifact = trackingMatch?.relatedArtifact?.find((a) => a.type === 'documentation');
                const thumbnailUrl = docArtifact?.extension?.find((e) => e.url === 'http://openphc.org/fhir/thumbnail')?.valueCode;
                const journeySteps = stepsOnly(proto.journey ?? []);
                const completedCount = journeySteps.filter((s) => s.status === 'COMPLETED').length;
                const protoDeviationCount = (deviations.data ?? []).filter((d) => d.protocolInstanceId === proto.protocolInstanceId).length;

                return (
                  <button
                    key={proto.protocolInstanceId}
                    type="button"
                    onClick={() => selectProtocol(proto.protocolInstanceId)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {thumbnailUrl && (
                        <img
                          src={toDirectImageUrl(thumbnailUrl)}
                          alt=""
                          className="h-6 w-6 flex-shrink-0 rounded object-cover border border-gray-200"
                        />
                      )}
                      <StatusBadge
                        label={proto.status}
                        color={STATUS_COLORS[proto.status as ProtocolInstanceStatus] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }}
                      />
                    </div>
                    <p className="mt-1.5 truncate text-sm font-semibold text-gray-900">{title}</p>
                    <p className="truncate text-xs text-gray-500">{proto.protocolCanonical}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-gray-500">{completedCount}/{journeySteps.length} steps</span>
                      <span className="text-xs font-medium text-gray-700">{formatPercentage(proto.complianceRate)}</span>
                      {protoDeviationCount > 0 && (
                        <span className="ml-auto inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                          {protoDeviationCount} deviation{protoDeviationCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Detail panel — everything about the selected protocol */}
          <Card title="Protocol Journey" className="min-w-0 flex-1">
            {!selectedProto && (
              <p className="py-4 text-center text-sm text-gray-400">Select a protocol to see its details.</p>
            )}

            {selectedProto && (() => {
              const proto = selectedProto;
              const trackingMatch = selectedTrackingMatch;
              const title = trackingMatch?.protocolTitle || proto.protocolCanonical;
              const docArtifact = trackingMatch?.relatedArtifact?.find((a) => a.type === 'documentation');
              const thumbnailUrl = docArtifact?.extension?.find((e) => e.url === 'http://openphc.org/fhir/thumbnail')?.valueCode;
              const journeySteps = proto.journey ?? [];
              const countedSteps = stepsOnly(journeySteps);
              const completedCount = countedSteps.filter((s) => s.status === 'COMPLETED').length;
              const protoDeviations = (deviations.data ?? []).filter((d) => d.protocolInstanceId === proto.protocolInstanceId);
              const protoDeliveries = (intelligenceDeliveries.data ?? []).filter((d) => d.protocolCanonical === proto.protocolCanonical);
              // One cycle of each step group at a time: the picked one, else the latest.
              const cycleView = showCycles(journeySteps, cycleSelection);
              const visibleSteps = visibleJourneySteps(cycleView.steps);
              const coversSeveralVisits = journeySteps.some((s) => (s.groupInstances?.length ?? 0) > 1);
              // The visits with a deviation, at any depth: their chips get a red dot.
              const deviatedInstanceIds = groupInstancesWithDeviations(protoDeviations);

              // The actions to mark with a deviation: the step that is late or missed, and the
              // prerequisites an out-of-order step skipped. Only deviations of step instances in the
              // cycles shown count.
              const deviationActionIds = new Set<string>();
              for (const d of protoDeviations) {
                if (!cycleView.isShown(d.stepInstanceId)) continue;
                if (d.deviationType === 'ORDER_VIOLATION' && d.metadata?.incompletePrerequisites) {
                  d.metadata.incompletePrerequisites.forEach((actionId) => deviationActionIds.add(actionId));
                }
                if ((d.deviationType === 'OVERDUE' || d.deviationType === 'MISSED') && d.actionId) {
                  deviationActionIds.add(d.actionId);
                }
              }

              return (
                <div>
                  {/* Header */}
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {thumbnailUrl && (
                        <a href={docArtifact?.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <img
                            src={toDirectImageUrl(thumbnailUrl)}
                            alt={docArtifact?.display || 'Protocol thumbnail'}
                            className="h-10 w-10 rounded object-cover border border-gray-200"
                          />
                        </a>
                      )}
                      <StatusBadge
                        label={proto.status}
                        color={STATUS_COLORS[proto.status as ProtocolInstanceStatus] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }}
                      />
                      <div className="min-w-0">
                        {docArtifact ? (
                          <a
                            href={docArtifact.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-sm font-semibold text-blue-700 hover:underline"
                          >
                            {title}
                          </a>
                        ) : (
                          <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
                        )}
                        <p className="truncate text-xs text-gray-500">
                          {proto.protocolCanonical}
                          {trackingMatch?.enrolledAt && <> · Enrolled: {formatDate(trackingMatch.enrolledAt)}</>}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      {protoDeviations.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {protoDeviations.length} deviation{protoDeviations.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {completedCount}/{countedSteps.length} steps
                        {/* The journey shows one visit at a time; these counts cover them all. */}
                        {coversSeveralVisits && <> · all visits</>}
                      </span>
                      <span className="text-xs font-medium text-gray-700">{formatPercentage(proto.complianceRate)}</span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      <span className="text-xs text-gray-600">Completed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                      <span className="text-xs text-gray-600">Pending</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span className="text-xs text-gray-600">Deviation</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full border-2 border-gray-300 bg-white" />
                      <span className="text-xs text-gray-600">Not started</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700">
                        Mandatory
                      </span>
                      <span className="text-xs text-gray-600">Required step (must)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700">
                        Step group
                      </span>
                      <span className="text-xs text-gray-600">Steps that belong together, such as a visit</span>
                    </div>
                    {coversSeveralVisits && (
                      <div className="flex items-center gap-3" data-testid="visit-chip-legend">
                        <span className="text-xs text-gray-600">Visit chips:</span>
                        {Object.values(CHIP_TONE).map((tone) => (
                          <span key={tone.label} className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                            <span className="text-xs text-gray-600">{tone.label}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {deviations.isLoading && <div className="mb-3"><LoadingSpinner /></div>}
                  {deviations.error && <div className="mb-3"><ErrorAlert error={deviations.error} /></div>}

                  <div className="space-y-6">
                    <div className="space-y-0">
                      {visibleSteps.map((step, i, arr) => {
                        const hasDeviation = deviationActionIds.has(step.actionId);
                        const isPending = step.status === 'NOT_STARTED' && !isUntriggered(step);
                        const displayStatus: JourneyDisplayStatus = hasDeviation && step.status !== 'COMPLETED'
                          ? 'DEVIATION'
                          : isPending ? 'PENDING' : step.status;
                        const info = JOURNEY_STATUS[displayStatus] ?? JOURNEY_STATUS.NOT_STARTED;
                        // An open group is in progress, not waiting to start
                        const statusLabel = step.group && displayStatus === 'PENDING' ? 'In progress' : info.label;
                        const depth = step.depth ?? 0;
                        const isSubStep = depth > 0;
                        const isDeviation = displayStatus === 'DEVIATION';
                        const isNotStarted = displayStatus === 'NOT_STARTED';
                        const isOutstandingMandatory = step.requiredBehavior === 'must' && !isDeviation
                          && displayStatus !== 'COMPLETED';

                        return (
                          <div
                            key={`${proto.protocolInstanceId}-j-${i}`}
                            className={`flex gap-3 py-2.5 ${
                              isDeviation ? 'rounded-lg bg-red-50 border border-red-200'
                                : isOutstandingMandatory ? 'rounded-lg bg-purple-50 border border-purple-100'
                                : ''
                            }`}
                            style={{ paddingLeft: `${depth * 24}px` }}
                          >
                            <div className="flex flex-col items-center">
                              {isNotStarted ? (
                                <div className="mt-1 h-3.5 w-3.5 rounded-full border-2 border-gray-300 bg-white" />
                              ) : (
                                <div className={`mt-1 ${isSubStep ? 'h-3 w-3' : 'h-3.5 w-3.5'} rounded-full ${info.dot}`} />
                              )}
                              {i < arr.length - 1 && <div className="w-px flex-1 bg-gray-200" />}
                            </div>
                            <div className="min-w-0 pb-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`${isSubStep ? 'text-sm' : 'text-base'} font-semibold ${isNotStarted ? 'text-gray-400' : 'text-gray-900'}`}>{step.stepName}</p>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${info.bg} ${info.text}`}>
                                  {statusLabel}
                                </span>
                                {step.group && (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">
                                    Step group
                                  </span>
                                )}
                                {step.requiredBehavior === 'must' && (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                                    Mandatory
                                  </span>
                                )}

                                {!step.group && step.completionCount > 1 && (
                                  <span className="text-xs text-gray-400">×{step.completionCount}</span>
                                )}
                              </div>
                              {step.group && (cycleView.offeredInstances.get(step.actionId)?.length ?? 0) > 0 && (
                                <GroupInstanceList
                                  instances={cycleView.offeredInstances.get(step.actionId)!}
                                  shownInstanceId={cycleView.shownInstances.get(step.actionId)?.groupInstanceId ?? null}
                                  deviatedInstanceIds={deviatedInstanceIds}
                                  onShow={(groupInstanceId) =>
                                    setCycleSelection((current) => ({ ...current, [step.actionId]: groupInstanceId }))}
                                />
                              )}
                              {!step.group && <div className="mt-1 flex flex-wrap items-center gap-2">
                                {step.dueDate && (step.status === 'MISSED' || step.status === 'OVERDUE' || isPending) && (
                                  <span className="text-xs text-gray-500">Due: {formatDate(step.dueDate)}</span>
                                )}
                                {(step.status === 'OVERDUE' || step.status === 'MISSED') && (
                                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-red-700 bg-red-100">
                                    SLA BREACHED
                                  </span>
                                )}
                                {step.effectiveDateTime && (
                                  <span className="text-xs text-gray-500">{formatDateTime(step.effectiveDateTime)}</span>
                                )}
                                {step.stepStatus === 'COMPLETED' && (step.slaStatus === 'OVERDUE' || step.slaStatus === 'MISSED') && (
                                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-100">
                                    LATE
                                  </span>
                                )}
                                {step.stepStatus === 'COMPLETED' && step.slaStatus === 'MET' && (
                                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-green-700 bg-green-100">
                                    ON TIME
                                  </span>
                                )}
                                {step.source && (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getSourceColor(step.source)}`}>
                                    {step.source}
                                  </span>
                                )}
                                {step.practitioner && (
                                  <span className="text-xs text-gray-500">Practitioner: {step.practitioner}</span>
                                )}
                                {(step.facilityName || step.facilityId) && (
                                  <span className="text-xs text-gray-500">Facility: {step.facilityName || step.facilityId}</span>
                                )}
                              </div>}
                              {isDeviation && step.description && (
                                <p className="mt-1 text-xs text-red-600">{step.description}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-gray-200">
                        <div className="md:pr-4">
                          <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Deviations</h4>
                          {protoDeviations.length > 0 ? (
                            <PagedList
                              key={`deviations-${proto.protocolInstanceId}`}
                              items={protoDeviations}
                              pageSize={SIDE_LIST_PAGE_SIZE}
                              label="Deviations"
                              renderItem={(d) => {
                                const visit = groupPathLabel(d.groupPath);
                                const shown = cycleView.isShown(d.stepInstanceId);
                                return (
                                  <div key={`dev-${d.deviationId}`} className="rounded-lg border border-gray-200 p-3">
                                    <span className={`text-xs font-bold ${d.deviationType === 'OVERDUE' ? 'text-amber-600' : d.deviationType === 'ORDER_VIOLATION' ? 'text-purple-600' : 'text-red-600'}`}>
                                      {d.deviationType === 'OVERDUE' ? '⚠' : d.deviationType === 'ORDER_VIOLATION' ? '🔀' : '🔴'} {d.deviationType}
                                    </span>
                                    <p className="mt-1 text-sm font-medium text-gray-900">{d.description || d.stepName || d.actionId || 'Unknown Step'}</p>
                                    {visit && (
                                      <p className="text-xs text-gray-600">
                                        In {visit}
                                        {shown ? (
                                          <span className="ml-1 text-gray-400">· shown above</span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setCycleSelection((current) => ({ ...current, ...selectionFor(d.groupPath) }))}
                                            className="ml-1 text-blue-600 hover:text-blue-700 hover:underline"
                                          >
                                            · Show this visit
                                          </button>
                                        )}
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-500">Detected: {formatDate(d.detectedAt)}</p>
                                  </div>
                                );
                              }}
                            />
                          ) : (
                            <p className="py-3 text-center text-xs text-gray-400">No deviations found.</p>
                          )}
                        </div>

                        <div className="mt-4 md:mt-0 md:pl-4">
                          <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Intelligence Alerts</h4>
                          {intelligenceDeliveries.isLoading ? <LoadingSpinner /> : intelligenceDeliveries.error ? <ErrorAlert error={intelligenceDeliveries.error} /> : protoDeliveries.length > 0 ? (
                            <PagedList
                              key={`alerts-${proto.protocolInstanceId}`}
                              items={protoDeliveries}
                              pageSize={SIDE_LIST_PAGE_SIZE}
                              label="Intelligence alerts"
                              renderItem={(d) => {
                                const delivered = d.status === 'DELIVERED';
                                const failed = d.status === 'FAILED';
                                return (
                                  <div key={`alert-${d.id}`} className="rounded-lg border border-gray-200 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        {d.severity && (
                                          <span className={`text-xs font-bold ${d.severity === 'CRITICAL' ? 'text-red-600' : d.severity === 'HIGH' ? 'text-orange-600' : d.severity === 'MEDIUM' ? 'text-amber-600' : 'text-blue-600'}`}>
                                            {d.severity}
                                          </span>
                                        )}
                                        <span className="text-xs text-gray-500">{d.actionType}</span>
                                      </div>
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset flex-shrink-0 ${
                                        delivered ? 'bg-green-50 text-green-700 ring-green-200' :
                                        failed ? 'bg-red-50 text-red-700 ring-red-200' :
                                        'bg-amber-50 text-amber-700 ring-amber-200'
                                      }`}>
                                        {delivered ? '✓ Delivered' : failed ? '✗ Failed' : d.status}
                                      </span>
                                    </div>
                                    {d.actionId && (
                                      <p className="mt-1 text-sm font-medium text-gray-900">
                                        {actionNameMap.get(d.actionId) ?? d.actionId}
                                      </p>
                                    )}
                                    <div className="mt-1 flex flex-wrap gap-3">
                                      {d.destination && (
                                        <span className="text-xs text-gray-500">To: {d.destination}</span>
                                      )}
                                      <span className="text-xs text-gray-500">Sent: {formatDateTime(d.createdAt)}</span>
                                      {d.deliveredAt && (
                                        <span className="text-xs text-gray-500">Delivered: {formatDateTime(d.deliveredAt)}</span>
                                      )}
                                      {d.attemptCount > 1 && (
                                        <span className="text-xs text-amber-600">{d.attemptCount} attempts</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                          ) : (
                            <p className="py-3 text-center text-xs text-gray-400">No intelligence alerts found.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowStepDetails((prev) => !prev)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left hover:bg-gray-100"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-600">
                          <svg
                            className={`h-3.5 w-3.5 flex-shrink-0 text-gray-500 transition-transform ${showStepDetails ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Step Details
                        </span>
                        <span className="text-[11px] font-normal normal-case text-gray-400">
                          {showStepDetails ? 'Hide' : 'Show'} raw step-level data
                        </span>
                      </button>
                      {showStepDetails && detail.isLoading && <div className="mt-2"><LoadingSpinner /></div>}
                      {showStepDetails && detail.error && <div className="mt-2"><ErrorAlert error={detail.error} /></div>}
                      {showStepDetails && detail.data && detail.data.protocolInstanceId === proto.protocolInstanceId && (
                        <div className="mt-2 overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                                <th className="pb-2 pr-4">Action</th>
                                <th className="pb-2 pr-4">Visit</th>
                                <th className="pb-2 pr-4">State</th>
                                <th className="pb-2 pr-4">Due Date</th>
                                <th className="pb-2 pr-4">Completed</th>
                                <th className="pb-2">Source</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {detail.data.steps.map((s) => (
                                <tr key={s.stepInstanceId} className="hover:bg-gray-50">
                                  <td className="py-2 pr-4">
                                    <span className="font-medium text-gray-900">
                                      {actionNameMap.get(s.actionId) ?? s.actionId}
                                    </span>
                                    {actionNameMap.has(s.actionId) && (
                                      <span className="ml-1 font-mono text-[10px] text-gray-400">{s.actionId}</span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-4 text-gray-600">{groupPathLabel(s.groupPath) || '—'}</td>
                                  <td className="py-2 pr-4">
                                    <StatusBadge label={stepDisplayStatus(s)} color={STATE_COLORS[stepDisplayStatus(s)]} />
                                  </td>
                                  <td className="py-2 pr-4 text-gray-600">{s.dueDate ? formatDate(s.dueDate) : '—'}</td>
                                  <td className="py-2 pr-4 text-gray-600">{s.completedAt ? formatDateTime(s.completedAt) : '—'}</td>
                                  <td className="py-2 text-gray-600">{s.completedBySource || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      )}
    </>
  );
}
