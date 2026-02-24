/**
 * Suggested Task Pack DTOs
 *
 * Response contracts for topology-driven operational task suggestions
 * and closed-loop traceability summaries.
 *
 * Phase-C, Phase 3: Topology-aware Operational Tasking.
 */
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
} from 'class-validator';

// ============================================================================
// Suggested Task Pack
// ============================================================================

/**
 * A single suggested task derived from topology analysis + risk level.
 */
export interface SuggestedTask {
  /** Deterministic task template key */
  templateKey: string;
  /** Category of the task */
  category:
    | 'VALIDATION'
    | 'ROLLBACK_READINESS'
    | 'DEPENDENCY_COMMUNICATION'
    | 'MONITORING'
    | 'DOCUMENTATION';
  /** Pre-filled task title */
  title: string;
  /** Pre-filled task description */
  description: string;
  /** Priority suggestion */
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  /** Why this task is suggested (topology factor) */
  reason: string;
  /** Which topology signals triggered this suggestion */
  triggerSignals: string[];
  /** Whether this task is strongly recommended vs optional */
  recommended: boolean;
}

/**
 * Full suggested task pack response for a change.
 */
export interface SuggestedTaskPackResponse {
  /** The change ID */
  changeId: string;
  /** Risk level used for task generation */
  riskLevel: string;
  /** Topology risk score (0-100) */
  topologyRiskScore: number;
  /** Suggested tasks grouped by category */
  tasks: SuggestedTask[];
  /** Total number of tasks suggested */
  totalTasks: number;
  /** Number of strongly recommended tasks */
  recommendedCount: number;
  /** When the pack was generated */
  generatedAt: string;
  /** Warnings or limitations */
  warnings: string[];
}

// ============================================================================
// Closed-Loop Traceability
// ============================================================================

/**
 * A single node in the traceability chain.
 */
export interface TraceabilityNode {
  /** Record type */
  type:
    | 'CHANGE'
    | 'MAJOR_INCIDENT'
    | 'PROBLEM'
    | 'KNOWN_ERROR'
    | 'PIR'
    | 'PIR_ACTION'
    | 'TOPOLOGY_ANALYSIS'
    | 'GOVERNANCE_DECISION'
    | 'RCA_HYPOTHESIS';
  /** Record ID */
  id: string;
  /** Display label */
  label: string;
  /** Current status */
  status: string;
  /** When the record was created */
  createdAt: string;
  /** Additional context (e.g., score, decision type) */
  meta?: Record<string, unknown>;
}

/**
 * A directed edge in the traceability chain.
 */
export interface TraceabilityEdge {
  /** Source node ID */
  fromId: string;
  /** Target node ID */
  toId: string;
  /** Relationship type */
  relation:
    | 'TRIGGERED'
    | 'CREATED_FROM'
    | 'ANALYZED_BY'
    | 'DECIDED_BY'
    | 'RESULTED_IN'
    | 'LINKED_TO';
  /** Human-readable label for the edge */
  label: string;
}

/**
 * Full traceability summary response.
 */
export interface TraceabilitySummaryResponse {
  /** The root record this traceability is anchored to */
  rootId: string;
  /** The root record type */
  rootType: 'CHANGE' | 'MAJOR_INCIDENT';
  /** All nodes in the traceability chain */
  nodes: TraceabilityNode[];
  /** All edges connecting nodes */
  edges: TraceabilityEdge[];
  /** Human-readable summary of the chain */
  summary: string;
  /** Chain completeness metrics */
  metrics: {
    totalNodes: number;
    totalEdges: number;
    hasTopologyAnalysis: boolean;
    hasGovernanceDecision: boolean;
    hasOrchestrationActions: boolean;
    completenessScore: number; // 0-100
  };
  /** When the summary was generated */
  generatedAt: string;
}

// ============================================================================
// Request DTOs
// ============================================================================

/**
 * Request to create selected tasks from the suggested pack.
 */
export class CreateTasksFromPackDto {
  @IsUUID()
  @IsNotEmpty()
  changeId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  templateKeys: string[];

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
