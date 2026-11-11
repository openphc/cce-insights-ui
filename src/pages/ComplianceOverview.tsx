import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../components/shared/PageHeader';
import { MetricCard } from '../components/shared/MetricCard';
import { Card } from '../components/shared/Card';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ErrorAlert } from '../components/shared/ErrorAlert';
import { useProtocolComplianceSummary } from '../hooks/useComplianceSummary';
import { useStepAnalytics, useActionOrder } from '../hooks/useProtocols';
import { useProtocols, useFacilityLookup } from '../hooks/useLookups';
import { formatNumber, formatRate } from '../utils/formatters';
import { buildWorkflowTree, countDescendants, isInAGroup, type WorkflowNode } from '../utils/serviceWorkflow';
import type { ActionOrderEntry, StepAnalytics } from '../api/types';

type StepRow = StepAnalytics['steps'][number];
type GroupMetric = NonNullable<StepAnalytics['groups']>[number];

/** Everything the workflow tree needs to label and measure a node. */
interface WorkflowContext {
  labelOf: (actionId: string) => string;
  order: ActionOrderEntry[];
  denominators: Map<string, number>;
  groupMetrics: Map<string, GroupMetric>;
}

const rateColors = (pct: number) => ({
  bar: pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400',
  text: pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700',
});

/**
 * How a step is measured, with its unit. A step in a step group can repeat, once per visit, so it is
 * measured per time it was expected (its step instances), with its patients alongside. Any other
 * step is measured per patient, against the patients who completed the step before it.
 */
function measureOf(step: StepRow, context: WorkflowContext) {
  if (isInAGroup(step.actionId, context.order) && step.stepInstanceCount != null) {
    const total = step.stepInstanceCount;
    const done = step.completedStepInstanceCount ?? 0;
    return {
      done, total, unit: 'times',
      pct: total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0,
      alongside: `${formatNumber(step.completedCount)}/${formatNumber(step.totalInstances)} patients` as string | null,
    };
  }
  const total = context.denominators.get(step.actionId) ?? step.totalInstances;
  return {
    done: step.completedCount, total, unit: 'patients',
    pct: total > 0 ? Math.min(Math.round((step.completedCount / total) * 100), 100) : 0,
    alongside: null as string | null,
  };
}

/** A step group's own figures: how often it opened, for how many patients, and how often it was completed. */
function GroupSummary({ metric }: { metric: GroupMetric | undefined }) {
  if (!metric) return <span className="text-[11px] font-medium text-gray-400">step group</span>;
  const pct = Math.round(metric.completionRate * 100);
  return (
    <span
      className="text-[11px] text-gray-500"
      title="Each time the group opened for a patient, such as each visit, and how many of those had every step so far done."
    >
      <span className="font-medium text-indigo-700">step group</span>
      {' · '}{formatNumber(metric.instanceCount)} opened for {formatNumber(metric.patientCount)} patients
      {' · '}<span className={`font-bold ${rateColors(pct).text}`}>{pct}%</span> completed
      {' '}({formatNumber(metric.completedInstanceCount)}/{formatNumber(metric.instanceCount)})
    </span>
  );
}

/*
 * Collapsible children of a workflow node, for the Service Workflow Compliance timeline: a step's
 * sub-actions, or a step group's steps and the groups inside it.
 */
function SubActionsPanel({
  node,
  context,
}: {
  node: WorkflowNode<StepRow>;
  context: WorkflowContext;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <svg
          className={`h-3 w-3 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          {node.group ? 'Steps' : 'Sub-actions'} ({countDescendants(node)})
        </span>
      </button>
      {open && <SubActionList nodes={node.children} context={context} />}
    </div>
  );
}

/* One level of child rows; each row renders its own children nested below it, to any depth */
function SubActionList({
  nodes,
  context,
}: {
  nodes: WorkflowNode<StepRow>[];
  context: WorkflowContext;
}) {
  return (
    <div className="relative ml-2 mt-2">
      {/* Sub-action connector line */}
      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gray-200" />
      {nodes.map((child) => {
        const label = context.labelOf(child.actionId);

        if (child.group || !child.step) {
          // A step group, such as a consultation inside a visit: a container with no bar of its own.
          return (
            <div key={child.actionId} className="relative py-1.5 pl-5" data-testid={`workflow-${child.actionId}`}>
              <div className="absolute left-[2px] top-[10px] h-[8px] w-[8px] rounded-full bg-gray-300 ring-2 ring-white" />
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-gray-800">{label}</p>
                  <GroupSummary metric={context.groupMetrics.get(child.actionId)} />
                </div>
                {child.children.length > 0 && <SubActionsPanel node={child} context={context} />}
              </div>
            </div>
          );
        }

        const measure = measureOf(child.step, context);
        const colors = rateColors(measure.pct);
        return (
          <div key={child.actionId} className="relative py-1.5 pl-5" data-testid={`workflow-${child.actionId}`}>
            {/* Sub-action dot */}
            <div className={`absolute left-[2px] top-[10px] h-[8px] w-[8px] rounded-full ${colors.bar} ring-2 ring-white`} />
            <div className="min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-gray-700">{label}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-bold ${colors.text}`}>{measure.pct}%</span>
                  <span className="text-[10px] text-gray-400">
                    {formatNumber(measure.done)}/{formatNumber(measure.total)} {measure.unit}
                    {measure.alongside && <> · {measure.alongside}</>}
                  </span>
                </div>
              </div>
              <div className="mt-0.5 h-1 w-4/5 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${measure.pct}%` }} />
              </div>
            </div>
            {child.children.length > 0 && (
              <SubActionList nodes={child.children} context={context} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ComplianceOverview() {
  const [protocolId, setProtocolId] = useState('');
  const [facilityId, setFacilityId] = useState('');

  const protocols = useProtocols();
  const facilities = useFacilityLookup();

  // Only default to the first protocol once, when the list first loads - not every time
  // protocolId goes back to '' (empty), which also happens when the user deliberately picks
  // "All Protocols". Without this guard that selection was immediately overwritten back to
  // the first protocol by this same effect re-firing (same bug as ProtocolFilter.tsx had).
  const hasDefaulted = useRef(false);
  useEffect(() => {
    if (!hasDefaulted.current && !protocolId && protocols.data && protocols.data.length > 0) {
      hasDefaulted.current = true;
      setProtocolId(protocols.data[0].id);
    }
  }, [protocols.data, protocolId]);

  const summary = useProtocolComplianceSummary(protocolId, facilityId || undefined);
  const stepAnalytics = useStepAnalytics(protocolId, facilityId || undefined);
  const actionOrder = useActionOrder(protocolId);

  const data = summary.data;

  return (
    <>
      <PageHeader title="Compliance Overview" description="Protocol & facility compliance summaries" />

      <Card title="Protocol Compliance">
        <div className="mb-4 flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Protocol</label>
            <select
              value={protocolId}
              onChange={(e) => setProtocolId(e.target.value)}
              className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Protocols</option>
              {protocols.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.url.split('/').pop()} (v{p.version})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Facility</label>
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Facilities</option>
              {facilities.data?.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        {summary.isLoading && <LoadingSpinner />}
        {summary.error && <ErrorAlert error={summary.error} />}

        {data && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard title="Tracked Patients" value={formatNumber(data.totalEnrollments)} description="Total number of patients enrolled and being tracked under this protocol." />
              <MetricCard title="Compliant Patients" value={formatNumber(data.compliantPatients)} denomination={formatNumber(data.totalEnrollments)} description="Patients with no deviations (overdue, missed, or order violations) under this protocol." />
              <MetricCard title="Non-Compliant Patients" value={formatNumber(data.totalEnrollments - data.compliantPatients)} denomination={formatNumber(data.totalEnrollments)} description="Patients with at least one deviation (overdue, missed, or order violation) under this protocol." />
              <MetricCard title="Compliance Rate" value={formatRate(data.complianceRate)} description="Percentage of compliant patients out of total tracked patients under this protocol." />
            </div>

            <div className="mt-1">
              <h4 className="mb-3 text-xs font-semibold text-gray-500 uppercase">Transactions</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {(() => {
                  // 2.0.0: completed / notStarted split steps by whether the work was recorded;
                  // overdue / missed / unjudged are SLA verdicts, so overdue and missed include
                  // steps that were completed after the deadline.
                  const completed = data.stepMetrics.completed ?? 0;
                  const onTime = data.stepMetrics.completedOnTime ?? 0;
                  const late = data.stepMetrics.completedLate ?? 0;
                  const notStarted = data.stepMetrics.notStarted ?? 0;
                  const overdue = data.stepMetrics.overdue ?? 0;
                  const missed = data.stepMetrics.missed ?? 0;
                  const unjudged = data.stepMetrics.slaUnjudged ?? 0;
                  const totalSteps = data.stepMetrics.totalSteps || 1;

                  const tiles = [
                    { key: 'total', label: 'Total Steps', value: totalSteps, denom: totalSteps, color: 'bg-gray-500', text: 'text-gray-800', bg: 'bg-gray-50', desc: 'Total applicable steps across all tracked patients.' },
                    { key: 'completed', label: 'Completed', value: completed, denom: totalSteps, color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', sub: { onTime, late }, desc: 'Steps that have been completed (on time or late).' },
                    { key: 'notStarted', label: 'Not Started', value: notStarted, denom: totalSteps, color: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50', desc: 'Steps whose expected event has not been recorded yet, whether or not their due date has passed.' },
                    { key: 'overdue', label: 'Overdue', value: overdue, denom: totalSteps, color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', desc: 'Steps that passed their due date before being recorded — still outstanding, or completed late — and are not yet missed.' },
                    { key: 'missed', label: 'Missed', value: missed, denom: totalSteps, color: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', desc: 'Steps written off after the allowed window — never recorded, or recorded after the write-off.' },
                    { key: 'unjudged', label: 'Not Yet Judged', value: unjudged, denom: totalSteps, color: 'bg-gray-400', text: 'text-gray-700', bg: 'bg-gray-100', desc: 'Steps with no timeliness verdict yet — no deadline has fallen due. Optional steps have no deadline, so they stay here.' },
                  ];

                  return tiles.map(({ key, label, value, denom, color, text, bg, sub, desc }) => {
                    const pct = Math.round((value / denom) * 100);
                    return (
                      <div key={key} className={`rounded-lg ${bg} p-3 relative group`}>
                        <p className={`text-2xl font-bold ${text}`}>
                          {formatNumber(value)}
                          <span className="text-sm font-normal text-gray-400">/{formatNumber(denom)}</span>
                          {key !== 'total' && (
                            <span className="ml-2 text-base font-semibold text-gray-500">({pct}%)</span>
                          )}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1">
                          <p className="text-xs font-medium text-gray-600">{label}</p>
                          {desc && (
                            <div className="relative">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-gray-400 cursor-help peer">
                                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                              </svg>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-30 mb-2 w-48 rounded-lg border border-gray-200 bg-gray-800 px-3 py-2 text-xs text-white shadow-lg opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity">
                                {desc}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-gray-800" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        {sub && (
                          <div className="mt-2 flex gap-3 border-t border-gray-200 pt-2">
                            <span className="text-[10px] text-blue-600 font-medium">On Time: {sub.onTime}</span>
                            <span className="text-[10px] text-amber-600 font-medium">Late: {sub.late}</span>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Service Workflow Compliance */}
            {stepAnalytics.data && stepAnalytics.data.steps.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase">Service Workflow Compliance</h4>
                </div>
                {(() => {
                  const order = actionOrder.data ?? [];
                  const orderMap = new Map(order.map((e, idx) => [e.actionId, idx]));
                  const parentMap = new Map(order.map((e) => [e.actionId, e.parentActionId]));
                  const titleMap = new Map(order.map((e) => [e.actionId, e.title]));
                  const labelOf = (id: string) =>
                    titleMap.get(id) || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

                  const sortedSteps = [...stepAnalytics.data.steps]
                    .filter((s) => s.totalInstances > 0)
                    .sort((a, b) => (orderMap.get(a.actionId) ?? 999) - (orderMap.get(b.actionId) ?? 999));

                  const completedMap = new Map(sortedSteps.map((s) => [s.actionId, s.completedCount]));

                  // Compute denominator for each step
                  const denominators = new Map<string, number>();
                  let prevTopLevel: string | null = null;
                  const prevSiblingByParent = new Map<string, string>();

                  for (const step of sortedSteps) {
                    const parent = parentMap.get(step.actionId) ?? null;
                    if (!parent) {
                      if (prevTopLevel === null) {
                        denominators.set(step.actionId, data.totalEnrollments);
                      } else {
                        denominators.set(step.actionId, completedMap.get(prevTopLevel) ?? step.totalInstances);
                      }
                      prevTopLevel = step.actionId;
                    } else {
                      const prevSibling = prevSiblingByParent.get(parent);
                      if (prevSibling) {
                        denominators.set(step.actionId, completedMap.get(prevSibling) ?? step.totalInstances);
                      } else {
                        denominators.set(step.actionId, completedMap.get(parent) ?? step.totalInstances);
                      }
                    }
                    if (parent) {
                      prevSiblingByParent.set(parent, step.actionId);
                    }
                  }

                  const context: WorkflowContext = {
                    labelOf,
                    order,
                    denominators,
                    groupMetrics: new Map((stepAnalytics.data.groups ?? []).map((g) => [g.groupActionId, g])),
                  };

                  // Nest steps to any depth (protocols may chain steps several levels deep), inside
                  // their step groups, such as a visit.
                  const tree = buildWorkflowTree(sortedSteps, order);

                  return (
                    <div className="space-y-0 relative">
                      {/* Vertical connector line */}
                      <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-gray-200" />

                      {tree.map((node) => {
                        const label = labelOf(node.actionId);
                        const measure = node.step && !node.group ? measureOf(node.step, context) : null;
                        const colors = rateColors(measure?.pct ?? 0);
                        const missing = measure ? Math.max(measure.total - measure.done, 0) : 0;

                        return (
                          <div key={node.actionId} className="relative pl-10 pb-4" data-testid={`workflow-${node.actionId}`}>
                            {/* Timeline dot - bold & bright (grey for a step group) */}
                            <div className={`absolute left-1.5 top-5 h-4 w-4 rounded-full ${measure ? colors.bar : 'bg-gray-300'} shadow-md z-10 ring-3 ring-white`} />

                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                              {/* Header row */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h5 className="text-sm font-bold text-gray-900">{label}</h5>
                                {measure ? (
                                  <span className={`text-lg font-bold ${colors.text}`}>{measure.pct}%</span>
                                ) : (
                                  <GroupSummary metric={context.groupMetrics.get(node.actionId)} />
                                )}
                              </div>

                              {/* A step group has no measurement of its own - show its steps only. */}
                              {measure && (
                                <>
                                  {/* Progress bar */}
                                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                    <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${measure.pct}%` }} />
                                  </div>

                                  {/* Stats */}
                                  <div className="mt-2 flex items-center gap-2 text-xs">
                                    <span className="text-gray-600">
                                      {formatNumber(measure.done)} of {formatNumber(measure.total)} {measure.unit} completed
                                    </span>
                                    {measure.alongside && <span className="text-gray-500">· {measure.alongside}</span>}
                                    {missing > 0 && (
                                      <span className="text-red-500 font-medium">· {formatNumber(missing)} missing</span>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Collapsible children as sub-timeline nodes, nested to any depth */}
                              {node.children.length > 0 && <SubActionsPanel node={node} context={context} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
