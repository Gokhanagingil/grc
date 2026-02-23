/**
 * Topology Intelligence - Shared utilities
 * Score labeling, error classification, formatting helpers
 */

import type {
  TopologyImpactResponseData,
  TopologyBlastRadiusMetrics,
  RcaHypothesisData,
  RcaTopologyHypothesesResponseData,
  FragilitySignalType,
  RcaHypothesisType,
  ImpactBucketsSummary,
  TopologyCompletenessConfidence,
  TopologyRiskFactor,
  RcaContradiction,
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

  // Phase 2: Normalize optional impact buckets
  const rawBuckets = raw.impactBuckets as Partial<ImpactBucketsSummary> | undefined;
  const impactBuckets: ImpactBucketsSummary | undefined = rawBuckets
    ? {
        direct: typeof rawBuckets.direct === 'number' ? rawBuckets.direct : 0,
        downstream: typeof rawBuckets.downstream === 'number' ? rawBuckets.downstream : 0,
        criticalPath: typeof rawBuckets.criticalPath === 'number' ? rawBuckets.criticalPath : 0,
        unknownConfidence: typeof rawBuckets.unknownConfidence === 'number' ? rawBuckets.unknownConfidence : 0,
      }
    : undefined;

  // Phase 2: Normalize optional completeness confidence
  const rawConfidence = raw.completenessConfidence as Partial<TopologyCompletenessConfidence> | undefined;
  const completenessConfidence: TopologyCompletenessConfidence | undefined =
    rawConfidence && typeof rawConfidence.score === 'number'
      ? {
          score: rawConfidence.score,
          label: rawConfidence.label ?? 'VERY_LOW',
          degradingFactors: Array.isArray(rawConfidence.degradingFactors) ? rawConfidence.degradingFactors : [],
          missingClassCount: typeof rawConfidence.missingClassCount === 'number' ? rawConfidence.missingClassCount : 0,
          isolatedNodeCount: typeof rawConfidence.isolatedNodeCount === 'number' ? rawConfidence.isolatedNodeCount : 0,
          healthRulesAvailable: typeof rawConfidence.healthRulesAvailable === 'boolean' ? rawConfidence.healthRulesAvailable : false,
        }
      : undefined;

  // Phase 2: Normalize optional risk factors
  const rawRiskFactors = raw.riskFactors;
  const riskFactors: TopologyRiskFactor[] | undefined = Array.isArray(rawRiskFactors)
    ? rawRiskFactors.map((f: Record<string, unknown>) => ({
        key: (f.key as string) ?? '',
        label: (f.label as string) ?? '',
        contribution: typeof f.contribution === 'number' ? f.contribution : 0,
        maxContribution: typeof f.maxContribution === 'number' ? f.maxContribution : 0,
        reason: (f.reason as string) ?? '',
        severity: (['critical', 'warning', 'info'].includes(f.severity as string)
          ? f.severity as 'critical' | 'warning' | 'info'
          : 'info'),
      }))
    : undefined;

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
    // Phase 2 optional fields (undefined if not present — feature-by-data)
    impactBuckets,
    impactedServicesCount: typeof raw.impactedServicesCount === 'number' ? raw.impactedServicesCount : undefined,
    impactedOfferingsCount: typeof raw.impactedOfferingsCount === 'number' ? raw.impactedOfferingsCount : undefined,
    impactedCriticalCisCount: typeof raw.impactedCriticalCisCount === 'number' ? raw.impactedCriticalCisCount : undefined,
    completenessConfidence,
    riskFactors,
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

// ============================================================================
// Phase 2: RCA Response Normalization
// ============================================================================

/**
 * Normalize RCA topology hypotheses response with Phase-2 field defaults.
 * Ensures evidence weights, contradictions, and ranking algorithm are safely handled.
 */
export function normalizeRcaResponse(
  raw: RcaTopologyHypothesesResponseData | null | undefined,
): RcaTopologyHypothesesResponseData | null {
  if (!raw || typeof raw !== 'object') return null;

  const hypotheses = Array.isArray(raw.hypotheses)
    ? raw.hypotheses.map((h) => ({
        ...h,
        evidence: Array.isArray(h.evidence)
          ? h.evidence.map((e) => ({
              ...e,
              weight: typeof e.weight === 'number' ? e.weight : undefined,
              isTopologyBased: typeof e.isTopologyBased === 'boolean' ? e.isTopologyBased : undefined,
            }))
          : [],
        affectedServiceIds: Array.isArray(h.affectedServiceIds) ? h.affectedServiceIds : [],
        recommendedActions: Array.isArray(h.recommendedActions) ? h.recommendedActions : [],
        // Phase 2 optional fields
        evidenceWeight: typeof h.evidenceWeight === 'number' ? h.evidenceWeight : undefined,
        contradictions: Array.isArray(h.contradictions)
          ? h.contradictions.map((c: RcaContradiction) => ({
              code: c.code ?? '',
              description: c.description ?? '',
              confidenceReduction: typeof c.confidenceReduction === 'number' ? c.confidenceReduction : 0,
            }))
          : undefined,
        corroboratingEvidenceCount: typeof h.corroboratingEvidenceCount === 'number'
          ? h.corroboratingEvidenceCount
          : undefined,
        contradictionCount: typeof h.contradictionCount === 'number'
          ? h.contradictionCount
          : undefined,
      }))
    : [];

  return {
    majorIncidentId: raw.majorIncidentId ?? '',
    rootServiceIds: Array.isArray(raw.rootServiceIds) ? raw.rootServiceIds : [],
    linkedCiIds: Array.isArray(raw.linkedCiIds) ? raw.linkedCiIds : [],
    hypotheses,
    nodesAnalyzed: typeof raw.nodesAnalyzed === 'number' ? raw.nodesAnalyzed : 0,
    computedAt: raw.computedAt ?? new Date().toISOString(),
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    rankingAlgorithm: typeof raw.rankingAlgorithm === 'string' ? raw.rankingAlgorithm : undefined,
  };
}

// ============================================================================
// Phase 2: Data Mode Detection
// ============================================================================

/** Topology data mode — determines UI presentation level */
export type TopologyDataMode = 'enhanced' | 'legacy' | 'empty';

/**
 * Detect whether topology impact data includes Phase-2 enhanced fields.
 * Returns 'enhanced' if any Phase-2 field is present, 'legacy' if core fields exist,
 * or 'empty' if no meaningful data.
 */
export function detectTopologyDataMode(impact: TopologyImpactResponseData | null | undefined): TopologyDataMode {
  if (!impact) return 'empty';
  if (
    impact.impactBuckets !== undefined ||
    impact.completenessConfidence !== undefined ||
    impact.riskFactors !== undefined
  ) {
    return 'enhanced';
  }
  return 'legacy';
}

/**
 * Detect whether RCA data includes Phase-2 enhanced fields.
 */
export function detectRcaDataMode(
  data: RcaTopologyHypothesesResponseData | null | undefined,
): TopologyDataMode {
  if (!data || !Array.isArray(data.hypotheses) || data.hypotheses.length === 0) return 'empty';
  if (
    data.rankingAlgorithm !== undefined ||
    data.hypotheses.some((h) => h.evidenceWeight !== undefined || h.contradictions !== undefined)
  ) {
    return 'enhanced';
  }
  return 'legacy';
}

// ============================================================================
// Phase 2: Confidence Label Helpers (0-100 scale)
// ============================================================================

/** Get human label for topology completeness confidence (0-100 scale) */
export function getCompletenessConfidenceLabel(score: number): string {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  if (score >= 30) return 'Low';
  return 'Very Low';
}

/** Get color for topology completeness confidence (0-100 scale) */
export function getCompletenessConfidenceColor(score: number): 'success' | 'info' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'info';
  if (score >= 30) return 'warning';
  return 'error';
}

/** Get severity color for risk factor */
export function getRiskFactorSeverityColor(severity: string): 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'critical': return 'error';
    case 'warning': return 'warning';
    default: return 'info';
  }
}
