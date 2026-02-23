/**
 * Topology Impact DTOs
 *
 * Response contracts for topology-driven change risk and
 * major incident RCA intelligence endpoints.
 *
 * Phase 2 additions (backward-compatible optional fields):
 * - Impact buckets (direct/downstream/critical-path/unknown-confidence)
 * - Service/offering-centric summary metrics
 * - Topology completeness confidence score
 * - Risk factor explainability fields
 * - RCA evidence weighting + contradiction markers
 * - Deterministic ranking algorithm documentation
 */

// ============================================================================
// Change Topology Impact
// ============================================================================

/**
 * Impact bucket classification for an impacted node.
 *
 * Classification rules (deterministic, highest-priority wins):
 *   critical_path > unknown_confidence > direct > downstream
 *
 * - direct: depth === 1 from a root CI
 * - downstream: depth > 1 via dependency chain
 * - critical_path: high/critical criticality OR service-type node
 * - unknown_confidence: missing className (no class semantics) or isolated CI
 */
export type ImpactBucket =
  | 'direct'
  | 'downstream'
  | 'critical_path'
  | 'unknown_confidence';

/**
 * A single impacted node discovered via topology traversal.
 */
export interface TopologyImpactedNode {
  /** Node ID (CI id, or service:<uuid>, offering:<uuid>) */
  id: string;
  /** Node type */
  type: 'ci' | 'service' | 'service_offering';
  /** Human-readable label */
  label: string;
  /** CI class name (e.g. 'server', 'database') */
  className?: string;
  /** Depth from the change's root CI/service in the graph */
  depth: number;
  /** Criticality if known */
  criticality?: string;
  /** Environment (production, staging, etc.) */
  environment?: string;
  /** Impact bucket classification (Phase 2) */
  impactBucket?: ImpactBucket;
}

/**
 * A dependency path from root to an impacted node.
 */
export interface TopologyImpactPath {
  /** Ordered list of node IDs from root to target */
  nodeIds: string[];
  /** Ordered list of node labels for display */
  nodeLabels: string[];
  /** Total depth of this path */
  depth: number;
  /** Relationship types along the path */
  relationTypes: string[];
}

/**
 * Fragility signal - indicates single points of failure or lack of redundancy.
 */
export interface FragilitySignal {
  /** Type of fragility detected */
  type:
    | 'single_point_of_failure'
    | 'no_redundancy'
    | 'high_fan_out'
    | 'deep_chain';
  /** Node ID where the fragility is detected */
  nodeId: string;
  /** Human-readable label of the node */
  nodeLabel: string;
  /** Explanation of the fragility */
  reason: string;
  /** Severity: how impactful this fragility is (0-100) */
  severity: number;
}

// ============================================================================
// Phase 2: Impact Buckets Summary
// ============================================================================

/**
 * Summary of impacted nodes by bucket category.
 */
export interface ImpactBucketsSummary {
  /** Nodes directly connected to root CIs (depth=1) */
  direct: number;
  /** Nodes reachable via downstream dependency chain (depth>1) */
  downstream: number;
  /** Nodes on critical paths (high-criticality or service-connected) */
  criticalPath: number;
  /** Nodes with incomplete data (missing rels, missing class) */
  unknownConfidence: number;
}

// ============================================================================
// Phase 2: Topology Completeness Confidence
// ============================================================================

/**
 * Confidence assessment for topology data completeness.
 * Helps analysts understand how reliable the blast radius analysis is.
 *
 * Scoring algorithm (deterministic):
 *   Start at 100, subtract each degrading factor's impact.
 *   Floor at 0. Label thresholds: >=80 HIGH, >=60 MEDIUM, >=30 LOW, <30 VERY_LOW.
 */
export interface TopologyCompletenessConfidence {
  /** Overall confidence score (0-100). Higher = more complete topology data */
  score: number;
  /** Human-readable confidence label */
  label: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
  /** Factors that reduce confidence */
  degradingFactors: TopologyConfidenceFactor[];
  /** Total CIs with missing class information */
  missingClassCount: number;
  /** Total CIs with no outgoing relationships (potential data gaps) */
  isolatedNodeCount: number;
  /** Whether any health rules were available for validation */
  healthRulesAvailable: boolean;
}

/**
 * A single factor that degrades topology confidence.
 */
export interface TopologyConfidenceFactor {
  /** Machine-readable factor code */
  code: string;
  /** Human-readable description */
  description: string;
  /** How much this factor degrades confidence (0-100) */
  impact: number;
}

// ============================================================================
// Phase 2: Risk Factor Explainability
// ============================================================================

/**
 * A single explainable risk factor contributing to the overall risk score.
 *
 * Each factor maps 1:1 to a weight in TOPOLOGY_RISK_WEIGHTS.
 * contribution = (sub-score / 100) * maxContribution
 * The sum of all contributions equals topologyRiskScore.
 */
export interface TopologyRiskFactor {
  /** Machine-readable factor key (matches TOPOLOGY_RISK_WEIGHTS key) */
  key: string;
  /** Human-readable label */
  label: string;
  /** Actual contribution to overall score (0 to maxContribution) */
  contribution: number;
  /** Maximum possible contribution (the weight for this factor) */
  maxContribution: number;
  /** Human-readable reason explaining why this factor scored as it did */
  reason: string;
  /** Severity level */
  severity: 'critical' | 'warning' | 'info';
}

/**
 * Metrics breakdown for topology-based blast radius.
 */
export interface TopologyBlastRadiusMetrics {
  /** Total impacted node count */
  totalImpactedNodes: number;
  /** Impacted nodes by depth level */
  impactedByDepth: Record<number, number>;
  /** Impacted services count */
  impactedServiceCount: number;
  /** Impacted service offering count */
  impactedOfferingCount: number;
  /** Impacted CI count */
  impactedCiCount: number;
  /** Number of critical CIs impacted */
  criticalCiCount: number;
  /** Maximum dependency chain depth */
  maxChainDepth: number;
  /** Whether the blast radius crosses service boundaries */
  crossServicePropagation: boolean;
  /** Number of distinct services the blast radius touches */
  crossServiceCount: number;
}

/**
 * Full topology impact response for a change.
 */
export interface TopologyImpactResponse {
  /** The change ID this impact was computed for */
  changeId: string;
  /** The root node IDs used for traversal (service CIs, etc.) */
  rootNodeIds: string[];
  /** Blast radius metrics */
  metrics: TopologyBlastRadiusMetrics;
  /** Top impacted nodes (sorted by criticality/depth) */
  impactedNodes: TopologyImpactedNode[];
  /** Top contributing dependency paths */
  topPaths: TopologyImpactPath[];
  /** Fragility signals detected */
  fragilitySignals: FragilitySignal[];
  /** Topology risk sub-score (0-100) */
  topologyRiskScore: number;
  /** Human-readable explanation of why this change is risky from topology perspective */
  riskExplanation: string;
  /** When the analysis was computed */
  computedAt: string;
  /** Warnings or limitations */
  warnings: string[];

  // Phase 2 additions (backward-compatible — optional fields)

  /** Impact buckets summary: direct / downstream / critical-path / unknown */
  impactBuckets?: ImpactBucketsSummary;
  /** Count of impacted services (service-centric metric) */
  impactedServicesCount?: number;
  /** Count of impacted service offerings */
  impactedOfferingsCount?: number;
  /** Count of impacted critical CIs */
  impactedCriticalCisCount?: number;
  /** Topology completeness confidence assessment */
  completenessConfidence?: TopologyCompletenessConfidence;
  /** Explainable risk factors contributing to the topologyRiskScore */
  riskFactors?: TopologyRiskFactor[];
}

// ============================================================================
// Major Incident RCA Topology Hypotheses
// ============================================================================

/**
 * A single RCA hypothesis for a major incident.
 */
export interface RcaHypothesis {
  /** Unique hypothesis ID (deterministic, derived from type + nodeId) */
  id: string;
  /** Hypothesis type/rule that generated it */
  type:
    | 'common_upstream_dependency'
    | 'recent_change_on_shared_node'
    | 'single_point_of_failure'
    | 'high_impact_node'
    | 'cross_service_dependency';
  /** Confidence / relevance score (0-100, deterministic rule-based) */
  score: number;
  /** The suspect node ID */
  suspectNodeId: string;
  /** The suspect node label */
  suspectNodeLabel: string;
  /** The suspect node type */
  suspectNodeType: 'ci' | 'service' | 'service_offering';
  /** Human-readable explanation of why this node is a suspect */
  explanation: string;
  /** Evidence supporting this hypothesis */
  evidence: RcaEvidence[];
  /** Affected service IDs that this hypothesis explains */
  affectedServiceIds: string[];
  /** Recommended follow-up actions */
  recommendedActions: RcaRecommendedAction[];

  // Phase 2 additions (backward-compatible)

  /** Weighted evidence score (sum of evidence weights, normalized 0-100) */
  evidenceWeight?: number;
  /** Contradiction markers — signals that reduce confidence */
  contradictions?: RcaContradiction[];
  /** Number of corroborating evidence items */
  corroboratingEvidenceCount?: number;
  /** Number of contradicting signals */
  contradictionCount?: number;
}

/**
 * A piece of evidence supporting an RCA hypothesis.
 */
export interface RcaEvidence {
  /** Type of evidence */
  type:
    | 'topology_path'
    | 'recent_change'
    | 'health_violation'
    | 'customer_risk'
    | 'incident_history';
  /** Human-readable description */
  description: string;
  /** Optional reference ID (e.g., change ID, health rule ID) */
  referenceId?: string;
  /** Optional reference label */
  referenceLabel?: string;
  /** Evidence weight (0-100): how strongly this evidence supports the hypothesis (Phase 2) */
  weight?: number;
  /** Whether this evidence is topology-path based (higher confidence) vs heuristic */
  isTopologyBased?: boolean;
}

/**
 * A contradiction marker for an RCA hypothesis (Phase 2).
 * Signals that reduce confidence in the hypothesis.
 */
export interface RcaContradiction {
  /** Machine-readable contradiction code */
  code: string;
  /** Human-readable description of what contradicts the hypothesis */
  description: string;
  /** How much this contradiction reduces confidence (0-50) */
  confidenceReduction: number;
}

/**
 * A recommended follow-up action from an RCA hypothesis.
 */
export interface RcaRecommendedAction {
  /** Action type */
  type:
    | 'create_problem'
    | 'link_problem'
    | 'create_known_error'
    | 'create_change_task';
  /** Human-readable label */
  label: string;
  /** Reason why this action is recommended */
  reason: string;
  /** Confidence in this recommendation (0-100) */
  confidence: number;
}

/**
 * Full RCA topology hypotheses response for a major incident.
 */
export interface RcaTopologyHypothesesResponse {
  /** The major incident ID */
  majorIncidentId: string;
  /** Root service(s) used for analysis */
  rootServiceIds: string[];
  /** Linked CI IDs from the major incident */
  linkedCiIds: string[];
  /** Ranked hypotheses (sorted by score desc) */
  hypotheses: RcaHypothesis[];
  /** Total number of nodes analyzed */
  nodesAnalyzed: number;
  /** When the analysis was computed */
  computedAt: string;
  /** Warnings or limitations */
  warnings: string[];

  // Phase 2 additions

  /**
   * Ranking algorithm description (Phase 2).
   * Documents how hypotheses were ranked for transparency/audit.
   *
   * Algorithm: "weighted_evidence_v1"
   *   1) Base score from RCA_BASE_SCORES[type]
   *   2) + bonus for corroborating evidence + affected scope
   *   3) - sum of contradiction.confidenceReduction
   *   4) Clamp to [0, 100], sort desc, cap at MAX_HYPOTHESES
   */
  rankingAlgorithm?: string;
}
