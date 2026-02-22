/**
 * Topology Impact DTOs
 *
 * Response contracts for topology-driven change risk and
 * major incident RCA intelligence endpoints.
 */

// ============================================================================
// Change Topology Impact
// ============================================================================

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
}
