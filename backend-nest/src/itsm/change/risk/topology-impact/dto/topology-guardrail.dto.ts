/**
 * Topology Guardrail DTOs
 *
 * Response contracts for topology-driven change guardrail evaluation.
 * Guardrails provide a simplified PASS/WARN/BLOCK status layer on top
 * of the detailed governance evaluation, with evidence summaries and
 * audit trail support.
 *
 * Phase A: Topology Guardrails Backend
 */

import {
  TopologyGovernanceDecision,
  TopologyGovernanceAction,
  TopologyGovernanceExplainability,
  TopologyPolicyFlags,
} from './topology-governance.dto';

// ============================================================================
// Guardrail Status
// ============================================================================

/**
 * Simplified guardrail status for operational decision-making.
 * - PASS: Change can proceed without topology-related blockers
 * - WARN: Change can proceed but has topology-related warnings requiring attention
 * - BLOCK: Change should not proceed due to critical topology risks
 */
export type GuardrailStatus = 'PASS' | 'WARN' | 'BLOCK';

// ============================================================================
// Guardrail Reason
// ============================================================================

/**
 * A machine-readable + human-explainable reason contributing to the guardrail status.
 */
export interface GuardrailReason {
  /** Machine-readable reason code (e.g. 'HIGH_BLAST_RADIUS', 'SPOF_DETECTED') */
  code: string;
  /** Severity of this reason */
  severity: 'info' | 'warning' | 'critical';
  /** Human-readable explanation */
  message: string;
}

// ============================================================================
// Evidence Summary
// ============================================================================

/**
 * Structured evidence summary from topology analysis.
 * Provides key metrics for quick consumption by operators/dashboards.
 */
export interface GuardrailEvidenceSummary {
  /** Blast radius metrics snapshot */
  blastRadiusMetrics: {
    totalImpactedNodes: number;
    criticalCiCount: number;
    impactedServiceCount: number;
    maxChainDepth: number;
    crossServicePropagation: boolean;
  };
  /** Fragile dependencies detected */
  fragileDependencies: Array<{
    type: string;
    description: string;
    affectedNodeLabel: string;
  }>;
  /** Labels of nodes identified as single points of failure */
  singlePointsOfFailure: string[];
  /** Topology risk score (0-100) */
  topologyRiskScore: number;
  /** Whether topology data was available for evaluation */
  topologyDataAvailable: boolean;
}

// ============================================================================
// Previous Evaluation (for audit trail / diff)
// ============================================================================

/**
 * Summary of a previous guardrail evaluation, used for audit trail comparison.
 */
export interface GuardrailPreviousEvaluation {
  guardrailStatus: GuardrailStatus;
  governanceDecision: TopologyGovernanceDecision;
  topologyRiskScore: number;
  evaluatedAt: string;
}

// ============================================================================
// Full Guardrail Evaluation Response
// ============================================================================

/**
 * Complete topology guardrail evaluation response.
 * Wraps governance evaluation with a simplified PASS/WARN/BLOCK status,
 * evidence summary, reasons, and audit trail.
 */
export interface TopologyGuardrailEvaluationResponse {
  /** The change ID */
  changeId: string;

  /** Simplified guardrail status */
  guardrailStatus: GuardrailStatus;

  /** Original governance decision (for detailed consumption) */
  governanceDecision: TopologyGovernanceDecision;

  /** Machine-readable + explainable reasons */
  reasons: GuardrailReason[];

  /** Recommended/required actions checklist (from governance) */
  recommendedActions: TopologyGovernanceAction[];

  /** Structured evidence summary */
  evidenceSummary: GuardrailEvidenceSummary;

  /** Policy-ready computed flags */
  policyFlags: TopologyPolicyFlags;

  /** Explainability payload (from governance) */
  explainability: TopologyGovernanceExplainability;

  /** When the evaluation was performed (ISO 8601) */
  evaluatedAt: string;

  /** User ID who triggered the evaluation */
  evaluatedBy: string;

  /** Previous evaluation summary (for audit trail comparison) */
  previousEvaluation: GuardrailPreviousEvaluation | null;

  /** Warnings or limitations */
  warnings: string[];
}

/**
 * Mapping from governance decisions to guardrail statuses.
 * Deterministic and testable.
 */
export const GOVERNANCE_TO_GUARDRAIL_MAP: Record<
  TopologyGovernanceDecision,
  GuardrailStatus
> = {
  ALLOWED: 'PASS',
  ADDITIONAL_EVIDENCE_REQUIRED: 'WARN',
  CAB_REQUIRED: 'WARN',
  BLOCKED: 'BLOCK',
};
