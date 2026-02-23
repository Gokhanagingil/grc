/**
 * Change Widget Data Normalizers
 *
 * Scoped normalizer layer for all Change-page embedded widgets.
 * Ensures every API-derived payload entering a widget has safe defaults
 * for arrays, nested objects, and aggregate fields — preventing runtime
 * crashes like `undefined is not an object (evaluating 'i.tasks.reduce')`.
 *
 * Usage: call the appropriate normalizer in each widget's onFetch callback
 * inside ItsmChangeDetail before passing data to the widget component.
 *
 * Hotfix: Change page crash stabilization.
 */

import type {
  SuggestedTaskPackResponseData,
  SuggestedTaskData,
  TopologyGovernanceEvaluationData,
  TopologyGovernanceDecision,
  TopologyGovernanceFactor,
  TopologyGovernanceAction,
  TopologyPolicyFlags,
  TopologyGuardrailEvaluationData,
  GuardrailStatus,
  GuardrailReason,
} from '../../services/grcClient';

// ============================================================================
// Shared helpers
// ============================================================================

/** Safely coerce a value to an array. Returns [] for null/undefined/non-array. */
export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

/** Safely coerce a value to a string. Returns fallback for null/undefined. */
function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** Safely coerce a value to a number. Returns fallback for null/undefined/NaN. */
function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

/** Safely coerce a value to a boolean. Returns fallback for null/undefined. */
function safeBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

// ============================================================================
// SuggestedTaskPackResponseData normalizer
// ============================================================================

/**
 * Default shape for SuggestedTaskPackResponseData.
 * Prevents crashes when API returns partial/null fields like `tasks`.
 */
const DEFAULT_TASK_PACK: SuggestedTaskPackResponseData = {
  changeId: '',
  riskLevel: 'LOW',
  topologyRiskScore: 0,
  tasks: [],
  totalTasks: 0,
  recommendedCount: 0,
  generatedAt: new Date().toISOString(),
  warnings: [],
};

/**
 * Normalize a raw SuggestedTaskPackResponseData payload.
 * Ensures `tasks` is always an array and all scalar fields have safe defaults.
 *
 * Root cause fix: `pack.tasks.reduce(...)` crashes when `tasks` is undefined/null.
 */
export function normalizeSuggestedTaskPackResponse(
  raw: Record<string, unknown> | SuggestedTaskPackResponseData | null | undefined,
): SuggestedTaskPackResponseData {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_TASK_PACK };

  const r = raw as Record<string, unknown>;

  const tasks: SuggestedTaskData[] = safeArray<SuggestedTaskData>(r.tasks);

  return {
    changeId: safeString(r.changeId),
    riskLevel: safeString(r.riskLevel, 'LOW'),
    topologyRiskScore: safeNumber(r.topologyRiskScore),
    tasks,
    totalTasks: safeNumber(r.totalTasks, tasks.length),
    recommendedCount: safeNumber(r.recommendedCount, tasks.filter((t) => t.recommended).length),
    generatedAt: safeString(r.generatedAt, new Date().toISOString()),
    warnings: safeArray<string>(r.warnings),
  };
}

// ============================================================================
// TopologyGovernanceEvaluationData normalizer
// ============================================================================

/** Default explainability shape */
const DEFAULT_EXPLAINABILITY: TopologyGovernanceEvaluationData['explainability'] = {
  summary: '',
  factors: [],
  matchedPolicyNames: [],
  topDependencyPaths: [],
};

/**
 * Normalize a raw TopologyGovernanceEvaluationData payload.
 * Ensures `recommendedActions`, `warnings`, and `explainability` sub-fields
 * are always arrays/objects with safe defaults.
 */
export function normalizeGovernanceEvaluationResponse(
  raw: Record<string, unknown> | TopologyGovernanceEvaluationData | null | undefined,
): TopologyGovernanceEvaluationData | null {
  if (!raw || typeof raw !== 'object') return null;

  const r = raw as Record<string, unknown>;
  if (!r.decision) return null; // no meaningful data

  const rawExplainability = (r.explainability ?? {}) as Record<string, unknown>;

  const rawPolicyFlags = (r.policyFlags ?? {}) as Record<string, unknown>;

  return {
    changeId: safeString(r.changeId),
    decision: safeString(r.decision, 'ALLOWED') as TopologyGovernanceDecision,
    policyFlags: normalizePolicyFlags(rawPolicyFlags),
    topologyDataAvailable: safeBool(r.topologyDataAvailable),
    recommendedActions: safeArray<TopologyGovernanceAction>(r.recommendedActions),
    warnings: safeArray<string>(r.warnings),
    evaluatedAt: safeString(r.evaluatedAt, new Date().toISOString()),
    explainability: {
      summary: safeString(rawExplainability.summary),
      factors: safeArray<TopologyGovernanceFactor>(rawExplainability.factors),
      matchedPolicyNames: safeArray<string>(rawExplainability.matchedPolicyNames),
      topDependencyPaths: safeArray<{ nodeLabels: string[]; depth: number }>(
        rawExplainability.topDependencyPaths,
      ),
    },
  };
}

// ============================================================================
// TopologyGuardrailEvaluationData normalizer
// ============================================================================

// ============================================================================
// Shared PolicyFlags normalizer
// ============================================================================

/** Normalize raw TopologyPolicyFlags to ensure all fields have safe defaults. */
function normalizePolicyFlags(raw: Record<string, unknown>): TopologyPolicyFlags {
  return {
    topologyRiskScore: safeNumber(raw.topologyRiskScore),
    topologyHighBlastRadius: safeBool(raw.topologyHighBlastRadius),
    topologyFragilitySignalsCount: safeNumber(raw.topologyFragilitySignalsCount),
    topologyCriticalDependencyTouched: safeBool(raw.topologyCriticalDependencyTouched),
    topologySinglePointOfFailureRisk: safeBool(raw.topologySinglePointOfFailureRisk),
  };
}

/** Default evidence summary shape */
const DEFAULT_EVIDENCE_SUMMARY = {
  blastRadiusMetrics: {
    totalImpactedNodes: 0,
    criticalCiCount: 0,
    impactedServiceCount: 0,
    maxChainDepth: 0,
    crossServicePropagation: false,
  },
  fragileDependencies: [] as Array<{ affectedNodeLabel: string; description: string; type: string }>,
  singlePointsOfFailure: [] as string[],
  topologyRiskScore: 0,
  topologyDataAvailable: false,
};

/**
 * Normalize a raw TopologyGuardrailEvaluationData payload.
 * Ensures `reasons`, `warnings`, `recommendedActions`, `evidenceSummary`,
 * `explainability`, and `policyFlags` all have safe defaults.
 */
export function normalizeGuardrailEvaluationResponse(
  raw: Record<string, unknown> | TopologyGuardrailEvaluationData | null | undefined,
): TopologyGuardrailEvaluationData | null {
  if (!raw || typeof raw !== 'object') return null;

  const r = raw as Record<string, unknown>;
  if (!r.guardrailStatus) return null; // no meaningful data

  const rawEv = (r.evidenceSummary ?? {}) as Record<string, unknown>;
  const rawBr = (rawEv.blastRadiusMetrics ?? {}) as Record<string, unknown>;
  const rawExplain = (r.explainability ?? {}) as Record<string, unknown>;
  const rawPolicyFlags = (r.policyFlags ?? {}) as Record<string, unknown>;

  return {
    changeId: safeString(r.changeId),
    guardrailStatus: safeString(r.guardrailStatus, 'PASS') as GuardrailStatus,
    governanceDecision: safeString(r.governanceDecision, 'ALLOWED') as TopologyGovernanceDecision,
    reasons: safeArray<GuardrailReason>(r.reasons),
    recommendedActions: safeArray<TopologyGovernanceAction>(r.recommendedActions),
    warnings: safeArray<string>(r.warnings),
    evaluatedAt: safeString(r.evaluatedAt, new Date().toISOString()),
    evidenceSummary: {
      blastRadiusMetrics: {
        totalImpactedNodes: safeNumber(rawBr.totalImpactedNodes),
        criticalCiCount: safeNumber(rawBr.criticalCiCount),
        impactedServiceCount: safeNumber(rawBr.impactedServiceCount),
        maxChainDepth: safeNumber(rawBr.maxChainDepth),
        crossServicePropagation: safeBool(rawBr.crossServicePropagation),
      },
      fragileDependencies: safeArray(rawEv.fragileDependencies),
      singlePointsOfFailure: safeArray<string>(rawEv.singlePointsOfFailure),
      topologyRiskScore: safeNumber(rawEv.topologyRiskScore),
      topologyDataAvailable: safeBool(rawEv.topologyDataAvailable),
    },
    explainability: {
      summary: safeString(rawExplain.summary),
      factors: safeArray<TopologyGovernanceFactor>(rawExplain.factors),
      matchedPolicyNames: safeArray<string>(rawExplain.matchedPolicyNames),
      topDependencyPaths: safeArray<{ nodeLabels: string[]; depth: number }>(
        rawExplain.topDependencyPaths,
      ),
    },
    policyFlags: normalizePolicyFlags(rawPolicyFlags),
    previousEvaluation: r.previousEvaluation as TopologyGuardrailEvaluationData['previousEvaluation'],
    evaluatedBy: safeString(r.evaluatedBy, 'system'),
  };
}
