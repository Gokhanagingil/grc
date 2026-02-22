/**
 * Topology Intelligence - Shared utilities
 * Score labeling, error classification, formatting helpers
 */

import type {
  TopologyImpactResponseData,
  TopologyBlastRadiusMetrics,
  RcaHypothesisData,
  FragilitySignalType,
  RcaHypothesisType,
} from '../../services/grcClient';

// ============================================================================
// Risk Level / Score Labeling
// ============================================================================

export type TopologyRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export function getTopologyRiskLevel(score: number): TopologyRiskLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'NONE';
}

export function getRiskLevelColor(level: TopologyRiskLevel): 'error' | 'warning' | 'info' | 'success' | 'default' {
  switch (level) {
    case 'CRITICAL': return 'error';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'info';
    case 'LOW': return 'success';
    default: return 'default';
  }
}

export function getConfidenceLabel(score: number): string {
  if (score >= 0.8) return 'Very High';
  if (score >= 0.6) return 'High';
  if (score >= 0.4) return 'Medium';
  if (score >= 0.2) return 'Low';
  return 'Very Low';
}

export function getConfidenceColor(score: number): 'error' | 'warning' | 'info' | 'success' | 'default' {
  if (score >= 0.8) return 'error';
  if (score >= 0.6) return 'warning';
  if (score >= 0.4) return 'info';
  if (score >= 0.2) return 'success';
  return 'default';
}

// ============================================================================
// Fragility Signal Labels
// ============================================================================

export const FRAGILITY_SIGNAL_LABELS: Record<FragilitySignalType, string> = {
  single_point_of_failure: 'Single Point of Failure',
  no_redundancy: 'No Redundancy',
  high_fan_out: 'High Fan-Out',
  deep_chain: 'Deep Dependency Chain',
};

export function getFragilitySignalLabel(type: FragilitySignalType): string {
  return FRAGILITY_SIGNAL_LABELS[type] || type;
}

// ============================================================================
// RCA Hypothesis Type Labels
// ============================================================================

export const RCA_HYPOTHESIS_TYPE_LABELS: Record<RcaHypothesisType, string> = {
  common_upstream_dependency: 'Common Upstream Dependency',
  recent_change_on_shared_node: 'Recent Change on Shared Node',
  single_point_of_failure: 'Single Point of Failure',
  high_impact_node: 'High Impact Node',
  cross_service_dependency: 'Cross-Service Dependency',
};

export function getRcaHypothesisTypeLabel(type: RcaHypothesisType): string {
  return RCA_HYPOTHESIS_TYPE_LABELS[type] || type;
}

// ============================================================================
// Node Type Labels
// ============================================================================

export function getNodeTypeLabel(type: string): string {
  switch (type) {
    case 'ci': return 'Configuration Item';
    case 'service': return 'Service';
    case 'service_offering': return 'Service Offering';
    default: return type;
  }
}

export function getNodeTypeShortLabel(type: string): string {
  switch (type) {
    case 'ci': return 'CI';
    case 'service': return 'SVC';
    case 'service_offering': return 'OFF';
    default: return type;
  }
}

// ============================================================================
// API Error Classification
// ============================================================================

export type TopologyApiErrorType = 'unauthorized' | 'forbidden' | 'not_found' | 'server_error' | 'network' | 'unknown';

export interface ClassifiedTopologyError {
  type: TopologyApiErrorType;
  message: string;
  retryable: boolean;
}

export function classifyTopologyApiError(error: unknown): ClassifiedTopologyError {
  if (error && typeof error === 'object') {
    const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
    const status = err.response?.status;
    const serverMessage = err.response?.data?.message;

    if (status === 401) {
      return {
        type: 'unauthorized',
        message: 'Session expired. Please log in again.',
        retryable: false,
      };
    }
    if (status === 403) {
      return {
        type: 'forbidden',
        message: 'You do not have permission to view topology intelligence data.',
        retryable: false,
      };
    }
    if (status === 404) {
      return {
        type: 'not_found',
        message: serverMessage || 'Topology data not available. Ensure a service is bound to this record.',
        retryable: false,
      };
    }
    if (status && status >= 500) {
      return {
        type: 'server_error',
        message: 'Topology analysis service encountered an error. Please try again.',
        retryable: true,
      };
    }
    if (err.message === 'Network Error' || err.message?.includes('timeout')) {
      return {
        type: 'network',
        message: 'Unable to reach topology analysis service. Check your connection.',
        retryable: true,
      };
    }
  }
  return {
    type: 'unknown',
    message: 'An unexpected error occurred while loading topology data.',
    retryable: true,
  };
}

// ============================================================================
// Impact Data Normalization
// ============================================================================

/**
 * Default blast radius metrics - safe zero-value fallback.
 * Used when topology response has missing/partial metrics.
 */
const DEFAULT_METRICS: TopologyBlastRadiusMetrics = {
  totalImpactedNodes: 0,
  impactedByDepth: {},
  impactedServiceCount: 0,
  impactedOfferingCount: 0,
  impactedCiCount: 0,
  criticalCiCount: 0,
  maxChainDepth: 0,
  crossServicePropagation: false,
  crossServiceCount: 0,
};

/**
 * Normalize a raw topology impact response into a safe, fully-typed shape.
 * Handles:
 * - Missing or partial `metrics` (fills defaults)
 * - Missing `fragilitySignals` / `warnings` / `topPaths` / `impactedNodes` (→ [])
 * - `topologyRiskScore` missing (→ 0)
 * - Various response envelope shapes (data.summary.X, data.metrics.X, data.X)
 */
export function normalizeTopologyImpactResponse(
  raw: Record<string, unknown> | null | undefined,
): TopologyImpactResponseData | null {
  if (!raw || typeof raw !== 'object') return null;

  // Try to find metrics from various nesting shapes
  const rawMetrics = (raw.metrics ?? raw.summary ?? {}) as Partial<TopologyBlastRadiusMetrics>;
  const metrics: TopologyBlastRadiusMetrics = {
    totalImpactedNodes: rawMetrics.totalImpactedNodes ?? DEFAULT_METRICS.totalImpactedNodes,
    impactedByDepth: rawMetrics.impactedByDepth ?? DEFAULT_METRICS.impactedByDepth,
    impactedServiceCount: rawMetrics.impactedServiceCount ?? DEFAULT_METRICS.impactedServiceCount,
    impactedOfferingCount: rawMetrics.impactedOfferingCount ?? DEFAULT_METRICS.impactedOfferingCount,
    impactedCiCount: rawMetrics.impactedCiCount ?? DEFAULT_METRICS.impactedCiCount,
    criticalCiCount: rawMetrics.criticalCiCount ?? DEFAULT_METRICS.criticalCiCount,
    maxChainDepth: rawMetrics.maxChainDepth ?? DEFAULT_METRICS.maxChainDepth,
    crossServicePropagation: rawMetrics.crossServicePropagation ?? DEFAULT_METRICS.crossServicePropagation,
    crossServiceCount: rawMetrics.crossServiceCount ?? DEFAULT_METRICS.crossServiceCount,
  };

  return {
    changeId: (raw.changeId as string) ?? '',
    rootNodeIds: Array.isArray(raw.rootNodeIds) ? raw.rootNodeIds : [],
    metrics,
    impactedNodes: Array.isArray(raw.impactedNodes) ? raw.impactedNodes : [],
    topPaths: Array.isArray(raw.topPaths) ? raw.topPaths : [],
    fragilitySignals: Array.isArray(raw.fragilitySignals) ? raw.fragilitySignals : [],
    topologyRiskScore: typeof raw.topologyRiskScore === 'number' ? raw.topologyRiskScore : 0,
    riskExplanation: (raw.riskExplanation as string) ?? '',
    computedAt: (raw.computedAt as string) ?? new Date().toISOString(),
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };
}

// ============================================================================
// Impact Summary Helpers
// ============================================================================

export function getImpactSummaryText(impact: TopologyImpactResponseData | null | undefined): string {
  if (!impact) return 'No topology impact data available';
  const metrics = impact.metrics ?? DEFAULT_METRICS;
  const parts: string[] = [];

  if ((metrics.totalImpactedNodes ?? 0) > 0) {
    parts.push(`${metrics.totalImpactedNodes} impacted node${metrics.totalImpactedNodes !== 1 ? 's' : ''}`);
  }
  if ((metrics.impactedServiceCount ?? 0) > 0) {
    parts.push(`${metrics.impactedServiceCount} service${metrics.impactedServiceCount !== 1 ? 's' : ''}`);
  }
  if ((metrics.impactedOfferingCount ?? 0) > 0) {
    parts.push(`${metrics.impactedOfferingCount} offering${metrics.impactedOfferingCount !== 1 ? 's' : ''}`);
  }
  if ((metrics.criticalCiCount ?? 0) > 0) {
    parts.push(`${metrics.criticalCiCount} critical CI${metrics.criticalCiCount !== 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No impacted nodes detected';
}

export function getRcaSummaryText(hypotheses: RcaHypothesisData[]): string {
  if (hypotheses.length === 0) return 'No topology-based hypotheses generated';
  const top = hypotheses[0];
  return `Top candidate: ${top.suspectNodeLabel} (${(top.score * 100).toFixed(0)}% confidence)`;
}

// ============================================================================
// Safe data unwrapping
// ============================================================================

export function unwrapTopologyResponse<T>(response: unknown): T | null {
  if (!response || typeof response !== 'object') return null;
  const resp = response as { data?: { data?: T; success?: boolean } & Record<string, unknown> };
  // Handle { data: { success: true, data: T } } (NestJS ResponseTransformInterceptor)
  if (resp?.data?.data !== undefined) return resp.data.data;
  // Handle { data: T } (flat envelope)
  if (resp?.data && typeof resp.data === 'object' && !('success' in resp.data)) {
    return resp.data as unknown as T;
  }
  return null;
}
