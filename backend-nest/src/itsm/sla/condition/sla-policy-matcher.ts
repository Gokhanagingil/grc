/**
 * SLA Policy Matcher
 *
 * The heart of SLA Engine 2.0.
 * Deterministic policy selection logic for a given record context.
 *
 * Steps:
 *  1. Filter active policies by appliesToRecordType + tenant + effective window
 *  2. Evaluate condition tree against record context
 *  3. Rank matches by priority_weight DESC, specificity DESC, createdAt ASC, id ASC
 *  4. Select winning policy (or "no match")
 *  5. Produce explainable evaluation output
 */
import {
  SlaDefinition,
  isConditionGroup,
  SlaConditionNode,
} from '../sla-definition.entity';

import {
  evaluateConditionTree,
  RecordContext,
} from './sla-condition-evaluator';

// ── Result types ───────────────────────────────────────────────────

export interface PolicyEvaluationEntry {
  policyId: string;
  policyName: string;
  matched: boolean;
  priorityWeight: number;
  specificityScore: number;
  reason: string;
}

export interface SlaMatchResult {
  matched: boolean;
  selectedPolicy: SlaDefinition | null;
  selectedPolicyId: string | null;
  selectedPolicyName: string | null;
  responseTimeSeconds: number | null;
  resolutionTimeSeconds: number | null;
  matchReason: string;
  evaluatedCount: number;
  evaluationDetails: PolicyEvaluationEntry[];
}

// ── Specificity Scoring ────────────────────────────────────────────

/**
 * Compute a specificity score for a condition tree.
 *
 * Scoring rules (simple, deterministic, documented):
 *  - Each leaf condition = +10
 *  - Exact operators (is) = +3 bonus
 *  - in/not_in = +1 bonus (less specific than exact)
 *  - Nested groups add +1 per nesting level
 *  - Empty / null tree = 0 (catches everything)
 */
export function computeSpecificityScore(
  tree: SlaConditionNode | null | undefined,
): number {
  if (!tree) return 0;
  return scoreNode(tree, 0);
}

function scoreNode(node: SlaConditionNode, depth: number): number {
  if (isConditionGroup(node)) {
    let score = depth > 0 ? 1 : 0; // nesting bonus
    for (const child of node.children) {
      score += scoreNode(child, depth + 1);
    }
    return score;
  }

  // Leaf
  const leaf = node;
  let score = 10; // base per-leaf
  if (leaf.operator === 'is') score += 3;
  else if (leaf.operator === 'in' || leaf.operator === 'not_in') score += 1;
  return score;
}

// ── Matching Engine ────────────────────────────────────────────────

/**
 * Match a record context against a list of SLA definitions.
 *
 * @param definitions - pre-filtered active definitions for this tenant + record type
 * @param context - key/value record context (e.g., from an incident)
 * @param now - current time for effective window check
 */
export function matchPolicies(
  definitions: SlaDefinition[],
  context: RecordContext,
  now: Date = new Date(),
): SlaMatchResult {
  const evaluationDetails: PolicyEvaluationEntry[] = [];

  // Step 1: Filter by effective window
  const candidates = definitions.filter((def) => {
    if (def.effectiveFrom && now < new Date(def.effectiveFrom)) return false;
    if (def.effectiveTo && now > new Date(def.effectiveTo)) return false;
    return true;
  });

  // Step 2: Evaluate each candidate
  const matched: {
    def: SlaDefinition;
    specificity: number;
    entry: PolicyEvaluationEntry;
  }[] = [];

  for (const def of candidates) {
    const specificity = computeSpecificityScore(def.conditionTree);
    let didMatch = false;
    let reason = '';

    try {
      didMatch = evaluateConditionTree(def.conditionTree, context);
      reason = didMatch
        ? buildMatchReason(def, context)
        : 'Condition tree did not match record context';
    } catch (err) {
      reason = `Evaluation error: ${err instanceof Error ? err.message : String(err)}`;
      didMatch = false;
    }

    const entry: PolicyEvaluationEntry = {
      policyId: def.id,
      policyName: def.name,
      matched: didMatch,
      priorityWeight: def.priorityWeight,
      specificityScore: specificity,
      reason,
    };

    evaluationDetails.push(entry);

    if (didMatch) {
      matched.push({ def, specificity, entry });
    }
  }

  if (matched.length === 0) {
    return {
      matched: false,
      selectedPolicy: null,
      selectedPolicyId: null,
      selectedPolicyName: null,
      responseTimeSeconds: null,
      resolutionTimeSeconds: null,
      matchReason: `No policy matched out of ${candidates.length} evaluated`,
      evaluatedCount: candidates.length,
      evaluationDetails,
    };
  }

  // Step 3: Rank deterministically
  matched.sort((a, b) => {
    // 1) priority_weight descending
    if (b.def.priorityWeight !== a.def.priorityWeight) {
      return b.def.priorityWeight - a.def.priorityWeight;
    }
    // 2) specificity descending
    if (b.specificity !== a.specificity) {
      return b.specificity - a.specificity;
    }
    // 3) createdAt ascending (older first)
    const aTime = new Date(a.def.createdAt).getTime();
    const bTime = new Date(b.def.createdAt).getTime();
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    // 4) id ascending (final deterministic tie-breaker)
    return a.def.id.localeCompare(b.def.id);
  });

  const winner = matched[0];

  // Resolve target times: prefer v2 fields, fall back to legacy
  const responseTimeSeconds =
    winner.def.responseTimeSeconds ??
    (String(winner.def.metric) === 'RESPONSE_TIME'
      ? winner.def.targetSeconds
      : null);
  const resolutionTimeSeconds =
    winner.def.resolutionTimeSeconds ??
    (String(winner.def.metric) === 'RESOLUTION_TIME'
      ? winner.def.targetSeconds
      : null);

  return {
    matched: true,
    selectedPolicy: winner.def,
    selectedPolicyId: winner.def.id,
    selectedPolicyName: winner.def.name,
    responseTimeSeconds,
    resolutionTimeSeconds,
    matchReason: winner.entry.reason,
    evaluatedCount: candidates.length,
    evaluationDetails,
  };
}

// ── Reason Builder ─────────────────────────────────────────────────

function buildMatchReason(def: SlaDefinition, context: RecordContext): string {
  const parts: string[] = [`Matched policy "${def.name}"`];

  if (def.conditionTree && isConditionGroup(def.conditionTree)) {
    const leafSummaries = collectLeafSummaries(def.conditionTree, context);
    if (leafSummaries.length > 0) {
      parts.push(leafSummaries.join(', '));
    }
  } else if (def.conditionTree) {
    // Single leaf at root
    const leaf = def.conditionTree;
    parts.push(`${leaf.field} ${leaf.operator} ${formatValue(leaf.value)}`);
  } else {
    parts.push('(no conditions - matches all)');
  }

  parts.push(`[weight=${def.priorityWeight}]`);
  return parts.join(': ');
}

function collectLeafSummaries(
  node: SlaConditionNode,
  context: RecordContext,
): string[] {
  if (isConditionGroup(node)) {
    const summaries: string[] = [];
    for (const child of node.children) {
      summaries.push(...collectLeafSummaries(child, context));
    }
    return summaries;
  }

  const leaf = node;
  const recordVal = context[leaf.field];
  return [
    `${leaf.field}=${formatValue(recordVal)} ${leaf.operator} ${formatValue(leaf.value)}`,
  ];
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (Array.isArray(val)) return `[${(val as string[]).join(',')}]`;
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}
