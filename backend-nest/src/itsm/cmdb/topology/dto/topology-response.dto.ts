/**
 * Topology Response DTOs
 *
 * Stable, frontend-friendly response contract for topology graph data.
 * Designed for extensibility (Phase C: annotations for change risk / RCA).
 */

export interface TopologyNode {
  id: string;
  type: 'ci' | 'service' | 'service_offering';
  label: string;
  /** CI class name (e.g. 'server', 'database', 'application') */
  className?: string;
  /** CI class ID */
  classId?: string;
  /** Class lineage: ancestor names from root to current (e.g. ['Hardware', 'Computer', 'Server']) */
  classLineage?: string[];
  /** Lifecycle/status of the node */
  status?: string;
  /** Criticality level */
  criticality?: string;
  /** Owner email or user id */
  owner?: string;
  /** Environment (production, staging, etc.) */
  environment?: string;
  /** IP address for CIs */
  ipAddress?: string;
  /** Service tier */
  tier?: string;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  /** Human-readable label for the relationship type (from semantics catalog) */
  relationLabel?: string;
  /** Direction label for display */
  direction?: 'upstream' | 'downstream' | 'bidirectional';
  /** Directionality from semantics catalog */
  directionality?: 'unidirectional' | 'bidirectional';
  /** Risk propagation hint from semantics catalog */
  riskPropagation?: 'forward' | 'reverse' | 'both' | 'none';
  /** Relationship strength (future use) */
  strength?: number;
  /** Whether this edge was inferred rather than explicit */
  inferred: boolean;
}

export interface TopologyMeta {
  rootNodeId: string;
  depth: number;
  nodeCount: number;
  edgeCount: number;
  /** True if the graph was truncated due to node/edge cap */
  truncated: boolean;
  /** Warning messages (e.g. 'Graph truncated at 200 nodes') */
  warnings: string[];
}

/**
 * Phase C extension point: annotations for change risk / RCA overlays.
 * In v1 this is mostly empty / minimal. Future phases will populate these.
 */
export interface TopologyAnnotations {
  /** Node IDs to highlight (e.g. blast radius, affected CIs) */
  highlightedNodeIds?: string[];
  /** Edge IDs to highlight */
  highlightedEdgeIds?: string[];
  /** Per-node badges (e.g. { nodeId: { type: 'risk', label: 'High' } }) */
  badgesByNodeId?: Record<
    string,
    { type: string; label: string; color?: string }
  >;
}

export interface TopologyResponse {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  meta: TopologyMeta;
  /** Phase C extension point for future overlays */
  annotations: TopologyAnnotations;
}
