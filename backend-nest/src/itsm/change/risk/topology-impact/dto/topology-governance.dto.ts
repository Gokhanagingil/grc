/**
 * Topology Governance DTOs
 *
 * Response contracts for topology-aware change governance
 * auto-enforcement (Phase-C, Phase 1).
 */

/**
 * Governance decision recommendation level.
 */
export type TopologyGovernanceDecision =
  | 'ALLOWED'
  | 'CAB_REQUIRED'
  | 'BLOCKED'
  | 'ADDITIONAL_EVIDENCE_REQUIRED';

/**
 * A single topology factor that contributed to the governance decision.
 */
export interface TopologyGovernanceFactor {
  /** Factor key */
  key: string;
  /** Human-readable label */
  label: string;
  /** Factor value (string, number, or boolean) */
  value: string | number | boolean;
  /** Severity contribution: how much this factor influenced the decision */
  severity: 'info' | 'warning' | 'critical';
  /** Short explanation of why this factor matters */
  explanation: string;
}

/**
 * A single recommended action from the governance evaluation.
 */
export interface TopologyGovernanceAction {
  /** Action key (for programmatic consumption) */
  key: string;
  /** Human-readable label */
  label: string;
  /** Whether this action is required (vs. recommended) */
  required: boolean;
  /** Whether this action is already satisfied */
  satisfied: boolean;
  /** Reason why this action is required/recommended */
  reason: string;
}

/**
 * Explainability payload for governance decisions.
 */
export interface TopologyGovernanceExplainability {
  /** Concise summary of why this decision was made */
  summary: string;
  /** Detailed factors that contributed to the decision */
  factors: TopologyGovernanceFactor[];
  /** Top dependency paths that contributed (capped for payload size) */
  topDependencyPaths: Array<{
    nodeLabels: string[];
    depth: number;
  }>;
  /** Policy rules that matched (if any) */
  matchedPolicyNames: string[];
}

/**
 * Policy-ready computed flags from topology analysis.
 */
export interface TopologyPolicyFlags {
  /** Topology risk score (0-100) */
  topologyRiskScore: number;
  /** Whether blast radius is considered high */
  topologyHighBlastRadius: boolean;
  /** Count of fragility signals detected */
  topologyFragilitySignalsCount: number;
  /** Whether a critical dependency is touched */
  topologyCriticalDependencyTouched: boolean;
  /** Whether single point of failure risk exists */
  topologySinglePointOfFailureRisk: boolean;
}

/**
 * Full topology governance evaluation response.
 */
export interface TopologyGovernanceEvaluationResponse {
  /** The change ID */
  changeId: string;
  /** Overall governance decision */
  decision: TopologyGovernanceDecision;
  /** Policy-ready computed flags from topology analysis */
  policyFlags: TopologyPolicyFlags;
  /** Recommended/required actions checklist */
  recommendedActions: TopologyGovernanceAction[];
  /** Explainability payload */
  explainability: TopologyGovernanceExplainability;
  /** Whether topology data was available for evaluation */
  topologyDataAvailable: boolean;
  /** When the evaluation was performed */
  evaluatedAt: string;
  /** Warnings or limitations */
  warnings: string[];
}
