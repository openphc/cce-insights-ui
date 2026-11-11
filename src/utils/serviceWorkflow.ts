/**
 * Builds the Service Workflow Compliance tree from the flat step-analytics rows + the protocol's
 * action order, to any depth.
 *
 * Protocols can chain steps several levels deep (e.g. Kenya SHA: consent-request →
 * consent-verification → visit-encounter → medication-request → medication-dispense). Only
 * steps with data are shown; each one is nested under its **nearest shown ancestor**, and
 * becomes top-level when no ancestor is shown — so no data-bearing step is ever hidden.
 *
 * A **step group**, such as a visit, never has step data of its own. It is shown as a container
 * (`step: null`, `group: true`) whenever a step inside it, at any depth, has data. A group inside a
 * group, such as a consultation inside a visit, is nested inside it, not shown beside it.
 */
export interface WorkflowStepInput {
  actionId: string;
  totalInstances: number;
}

export interface WorkflowOrderEntry {
  actionId: string;
  parentActionId: string | null;
  /** true for a step group, such as a visit. */
  group?: boolean;
}

export interface WorkflowNode<T extends WorkflowStepInput> {
  actionId: string;
  /** Its own step-analytics row; null for a step group, which has no step data of its own. */
  step: T | null;
  /** true for a step group, such as a visit. */
  group: boolean;
  /** Its children, in action order, each with its own children. */
  children: WorkflowNode<T>[];
}

/** The action's ancestors, nearest first (guarding against a cycle in a malformed order). */
function ancestorsOf(actionId: string, parentOf: Map<string, string | null>): string[] {
  const seen = new Set([actionId]);
  const out: string[] = [];
  for (let p = parentOf.get(actionId) ?? null; p && !seen.has(p); p = parentOf.get(p) ?? null) {
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function buildWorkflowTree<T extends WorkflowStepInput>(
  steps: T[],
  order: WorkflowOrderEntry[],
): WorkflowNode<T>[] {
  const orderMap = new Map(order.map((e, i) => [e.actionId, i] as const));
  const parentOf = new Map(order.map((e) => [e.actionId, e.parentActionId ?? null] as const));
  const groupIds = new Set(order.filter((e) => e.group).map((e) => e.actionId));
  const orderIdx = (id: string) => orderMap.get(id) ?? 999;

  const dataOf = new Map(steps.filter((s) => s.totalInstances > 0).map((s) => [s.actionId, s] as const));

  // Every step with data, and every step group around one.
  const shown = new Set(dataOf.keys());
  for (const actionId of dataOf.keys()) {
    for (const a of ancestorsOf(actionId, parentOf)) if (groupIds.has(a)) shown.add(a);
  }

  const ids = [...shown].sort((a, b) => orderIdx(a) - orderIdx(b));
  const nodes = new Map(
    ids.map((id) => [id, { actionId: id, step: dataOf.get(id) ?? null, group: groupIds.has(id), children: [] } as WorkflowNode<T>]),
  );

  const roots: WorkflowNode<T>[] = [];
  for (const id of ids) {
    const anc = ancestorsOf(id, parentOf).find((a) => nodes.has(a));
    if (anc) nodes.get(anc)!.children.push(nodes.get(id)!);
    else roots.push(nodes.get(id)!);
  }
  return roots;
}

/** Number of steps below `node`, at every depth; the step groups among them are not counted. */
export function countDescendants<T extends WorkflowStepInput>(node: WorkflowNode<T>): number {
  return node.children.reduce((n, c) => n + (c.step ? 1 : 0) + countDescendants(c), 0);
}

/** Whether an action sits inside a step group, at any depth: its step can repeat, once per visit. */
export function isInAGroup(actionId: string, order: WorkflowOrderEntry[]): boolean {
  const parentOf = new Map(order.map((e) => [e.actionId, e.parentActionId ?? null] as const));
  const groupIds = new Set(order.filter((e) => e.group).map((e) => e.actionId));
  return ancestorsOf(actionId, parentOf).some((a) => groupIds.has(a));
}
