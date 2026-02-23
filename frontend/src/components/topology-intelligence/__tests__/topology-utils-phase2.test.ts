/**
 * Topology Intelligence Phase 2 — Normalization & Utility Tests
 *
 * Tests for:
 *   - normalizeTopologyImpactResponse with Phase-2 fields
 *   - normalizeRcaResponse with Phase-2 fields
 *   - detectTopologyDataMode / detectRcaDataMode
 *   - getCompletenessConfidenceLabel / getCompletenessConfidenceColor
 *   - getRiskFactorSeverityColor
 *   - Legacy payload backward compatibility
 *   - Missing optional fields
 *
 * @regression
 */

import {
  normalizeTopologyImpactResponse,
  normalizeRcaResponse,
  detectTopologyDataMode,
  detectRcaDataMode,
  getCompletenessConfidenceLabel,
  getCompletenessConfidenceColor,
  getRiskFactorSeverityColor,
} from '../topology-utils';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const LEGACY_TOPOLOGY_PAYLOAD: Record<string, unknown> = {
  changeId: 'chg-001',
  rootNodeIds: ['node-1'],
  metrics: {
    totalImpactedNodes: 5,
    impactedByDepth: { 1: 3, 2: 2 },
    impactedServiceCount: 2,
    impactedOfferingCount: 1,
    impactedCiCount: 4,
    criticalCiCount: 1,
    maxChainDepth: 2,
    crossServicePropagation: true,
    crossServiceCount: 2,
  },
  impactedNodes: [
    { id: 'n1', type: 'ci', label: 'Server A', depth: 1 },
  ],
  topPaths: [],
  fragilitySignals: [],
  topologyRiskScore: 65,
  riskExplanation: 'High blast radius',
  computedAt: '2026-01-01T00:00:00Z',
  warnings: ['Partial data'],
};

const ENHANCED_TOPOLOGY_PAYLOAD: Record<string, unknown> = {
  ...LEGACY_TOPOLOGY_PAYLOAD,
  impactBuckets: {
    direct: 2,
    downstream: 3,
    criticalPath: 1,
    unknownConfidence: 0,
  },
  impactedServicesCount: 2,
  impactedOfferingsCount: 1,
  impactedCriticalCisCount: 1,
  completenessConfidence: {
    score: 72,
    label: 'MEDIUM',
    degradingFactors: [
      { code: 'NO_HEALTH_RULES', description: 'No health rules', impact: 15 },
    ],
    missingClassCount: 3,
    isolatedNodeCount: 1,
    healthRulesAvailable: false,
  },
  riskFactors: [
    {
      key: 'blast_radius',
      label: 'Blast Radius',
      contribution: 25,
      maxContribution: 40,
      reason: 'High number of impacted nodes',
      severity: 'critical',
    },
    {
      key: 'cross_service',
      label: 'Cross-Service Impact',
      contribution: 10,
      maxContribution: 20,
      reason: 'Propagates across service boundaries',
      severity: 'warning',
    },
  ],
};

const LEGACY_RCA_PAYLOAD = {
  majorIncidentId: 'mi-001',
  rootServiceIds: ['svc-1'],
  linkedCiIds: ['ci-1'],
  hypotheses: [
    {
      id: 'h1',
      type: 'common_upstream_dependency' as const,
      score: 0.85,
      suspectNodeId: 'node-1',
      suspectNodeLabel: 'DB Server',
      suspectNodeType: 'ci' as const,
      explanation: 'Common upstream dependency',
      evidence: [
        { type: 'topology_path' as const, description: 'Direct path found' },
      ],
      affectedServiceIds: ['svc-1'],
      recommendedActions: [],
    },
  ],
  nodesAnalyzed: 10,
  computedAt: '2026-01-01T00:00:00Z',
  warnings: [],
};

const ENHANCED_RCA_PAYLOAD = {
  ...LEGACY_RCA_PAYLOAD,
  rankingAlgorithm: 'weighted_evidence_v2',
  hypotheses: [
    {
      ...LEGACY_RCA_PAYLOAD.hypotheses[0],
      evidenceWeight: 4.2,
      contradictions: [
        {
          code: 'RECENT_HEALTHY_CHECK',
          description: 'Node passed health check 5 min ago',
          confidenceReduction: 10,
        },
      ],
      corroboratingEvidenceCount: 3,
      contradictionCount: 1,
      evidence: [
        {
          type: 'topology_path' as const,
          description: 'Direct path found',
          weight: 2.5,
          isTopologyBased: true,
        },
        {
          type: 'recent_change' as const,
          description: 'Change deployed 30 min ago',
          weight: 1.7,
          isTopologyBased: false,
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* normalizeTopologyImpactResponse                                     */
/* ------------------------------------------------------------------ */

describe('normalizeTopologyImpactResponse', () => {
  it('should return null for null input', () => {
    expect(normalizeTopologyImpactResponse(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(normalizeTopologyImpactResponse(undefined)).toBeNull();
  });

  it('should normalize legacy payload without Phase-2 fields', () => {
    const result = normalizeTopologyImpactResponse(LEGACY_TOPOLOGY_PAYLOAD);
    expect(result).not.toBeNull();
    expect(result!.changeId).toBe('chg-001');
    expect(result!.topologyRiskScore).toBe(65);
    expect(result!.metrics.totalImpactedNodes).toBe(5);
    expect(result!.impactedNodes).toHaveLength(1);
    expect(result!.warnings).toEqual(['Partial data']);

    // Phase-2 fields should be undefined
    expect(result!.impactBuckets).toBeUndefined();
    expect(result!.completenessConfidence).toBeUndefined();
    expect(result!.riskFactors).toBeUndefined();
    expect(result!.impactedServicesCount).toBeUndefined();
  });

  it('should normalize enhanced payload with Phase-2 fields', () => {
    const result = normalizeTopologyImpactResponse(ENHANCED_TOPOLOGY_PAYLOAD);
    expect(result).not.toBeNull();

    // Core fields preserved
    expect(result!.changeId).toBe('chg-001');
    expect(result!.topologyRiskScore).toBe(65);

    // Phase-2 impact buckets
    expect(result!.impactBuckets).toBeDefined();
    expect(result!.impactBuckets!.direct).toBe(2);
    expect(result!.impactBuckets!.downstream).toBe(3);
    expect(result!.impactBuckets!.criticalPath).toBe(1);
    expect(result!.impactBuckets!.unknownConfidence).toBe(0);

    // Phase-2 counts
    expect(result!.impactedServicesCount).toBe(2);
    expect(result!.impactedOfferingsCount).toBe(1);
    expect(result!.impactedCriticalCisCount).toBe(1);

    // Phase-2 confidence
    expect(result!.completenessConfidence).toBeDefined();
    expect(result!.completenessConfidence!.score).toBe(72);
    expect(result!.completenessConfidence!.label).toBe('MEDIUM');
    expect(result!.completenessConfidence!.degradingFactors).toHaveLength(1);
    expect(result!.completenessConfidence!.healthRulesAvailable).toBe(false);

    // Phase-2 risk factors
    expect(result!.riskFactors).toBeDefined();
    expect(result!.riskFactors).toHaveLength(2);
    expect(result!.riskFactors![0].key).toBe('blast_radius');
    expect(result!.riskFactors![0].severity).toBe('critical');
    expect(result!.riskFactors![1].contribution).toBe(10);
  });

  it('should handle partial Phase-2 fields gracefully', () => {
    const partial: Record<string, unknown> = {
      ...LEGACY_TOPOLOGY_PAYLOAD,
      impactBuckets: { direct: 1 }, // Missing other fields
      completenessConfidence: { score: 50 }, // Minimal
    };
    const result = normalizeTopologyImpactResponse(partial);
    expect(result).not.toBeNull();
    expect(result!.impactBuckets!.direct).toBe(1);
    expect(result!.impactBuckets!.downstream).toBe(0); // defaulted
    expect(result!.completenessConfidence!.score).toBe(50);
    expect(result!.completenessConfidence!.label).toBe('VERY_LOW'); // defaulted
    expect(result!.completenessConfidence!.degradingFactors).toEqual([]);
  });

  it('should handle missing metrics gracefully', () => {
    const result = normalizeTopologyImpactResponse({});
    expect(result).not.toBeNull();
    expect(result!.metrics.totalImpactedNodes).toBe(0);
    expect(result!.topologyRiskScore).toBe(0);
    expect(result!.impactedNodes).toEqual([]);
  });

  it('should not crash on non-array impactedNodes', () => {
    const result = normalizeTopologyImpactResponse({
      impactedNodes: 'not-an-array',
    });
    expect(result).not.toBeNull();
    expect(result!.impactedNodes).toEqual([]);
  });

  it('should handle invalid riskFactors severity', () => {
    const payload: Record<string, unknown> = {
      ...LEGACY_TOPOLOGY_PAYLOAD,
      riskFactors: [
        { key: 'test', label: 'Test', contribution: 5, maxContribution: 10, reason: 'Test', severity: 'invalid' },
      ],
    };
    const result = normalizeTopologyImpactResponse(payload);
    expect(result!.riskFactors![0].severity).toBe('info'); // defaults to info
  });
});

/* ------------------------------------------------------------------ */
/* normalizeRcaResponse                                                */
/* ------------------------------------------------------------------ */

describe('normalizeRcaResponse', () => {
  it('should return null for null input', () => {
    expect(normalizeRcaResponse(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(normalizeRcaResponse(undefined)).toBeNull();
  });

  it('should normalize legacy RCA payload without Phase-2 fields', () => {
    const result = normalizeRcaResponse(LEGACY_RCA_PAYLOAD);
    expect(result).not.toBeNull();
    expect(result!.majorIncidentId).toBe('mi-001');
    expect(result!.hypotheses).toHaveLength(1);
    expect(result!.hypotheses[0].score).toBe(0.85);
    expect(result!.hypotheses[0].evidence).toHaveLength(1);

    // Phase-2 fields should be undefined
    expect(result!.rankingAlgorithm).toBeUndefined();
    expect(result!.hypotheses[0].evidenceWeight).toBeUndefined();
    expect(result!.hypotheses[0].contradictions).toBeUndefined();
  });

  it('should normalize enhanced RCA payload with Phase-2 fields', () => {
    const result = normalizeRcaResponse(ENHANCED_RCA_PAYLOAD);
    expect(result).not.toBeNull();

    // Phase-2 ranking algorithm
    expect(result!.rankingAlgorithm).toBe('weighted_evidence_v2');

    // Phase-2 hypothesis fields
    const h = result!.hypotheses[0];
    expect(h.evidenceWeight).toBe(4.2);
    expect(h.contradictionCount).toBe(1);
    expect(h.corroboratingEvidenceCount).toBe(3);

    // Contradictions
    expect(h.contradictions).toHaveLength(1);
    expect(h.contradictions![0].code).toBe('RECENT_HEALTHY_CHECK');
    expect(h.contradictions![0].confidenceReduction).toBe(10);

    // Evidence weights
    expect(h.evidence[0].weight).toBe(2.5);
    expect(h.evidence[0].isTopologyBased).toBe(true);
    expect(h.evidence[1].weight).toBe(1.7);
    expect(h.evidence[1].isTopologyBased).toBe(false);
  });

  it('should default missing array fields safely', () => {
    const raw = {
      majorIncidentId: 'mi-002',
      hypotheses: [
        {
          id: 'h2',
          type: 'single_point_of_failure',
          score: 0.5,
          suspectNodeId: 'n2',
          suspectNodeLabel: 'App Server',
          suspectNodeType: 'service',
          explanation: 'Test',
          // Missing evidence, affectedServiceIds, recommendedActions
        },
      ],
      nodesAnalyzed: 5,
      computedAt: '2026-01-01T00:00:00Z',
      // Missing warnings, rootServiceIds, linkedCiIds
    } as Record<string, unknown>;

    const result = normalizeRcaResponse(raw as never);
    expect(result).not.toBeNull();
    expect(result!.rootServiceIds).toEqual([]);
    expect(result!.linkedCiIds).toEqual([]);
    expect(result!.warnings).toEqual([]);
    expect(result!.hypotheses[0].evidence).toEqual([]);
    expect(result!.hypotheses[0].affectedServiceIds).toEqual([]);
    expect(result!.hypotheses[0].recommendedActions).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* detectTopologyDataMode                                              */
/* ------------------------------------------------------------------ */

describe('detectTopologyDataMode', () => {
  it('should return "empty" for null', () => {
    expect(detectTopologyDataMode(null)).toBe('empty');
  });

  it('should return "empty" for undefined', () => {
    expect(detectTopologyDataMode(undefined)).toBe('empty');
  });

  it('should return "legacy" for payload without Phase-2 fields', () => {
    const result = normalizeTopologyImpactResponse(LEGACY_TOPOLOGY_PAYLOAD);
    expect(detectTopologyDataMode(result)).toBe('legacy');
  });

  it('should return "enhanced" for payload with Phase-2 fields', () => {
    const result = normalizeTopologyImpactResponse(ENHANCED_TOPOLOGY_PAYLOAD);
    expect(detectTopologyDataMode(result)).toBe('enhanced');
  });
});

/* ------------------------------------------------------------------ */
/* detectRcaDataMode                                                   */
/* ------------------------------------------------------------------ */

describe('detectRcaDataMode', () => {
  it('should return "empty" for null', () => {
    expect(detectRcaDataMode(null)).toBe('empty');
  });

  it('should return "legacy" for legacy RCA data', () => {
    expect(detectRcaDataMode(LEGACY_RCA_PAYLOAD)).toBe('legacy');
  });

  it('should return "enhanced" for enhanced RCA data', () => {
    expect(detectRcaDataMode(ENHANCED_RCA_PAYLOAD)).toBe('enhanced');
  });

  it('should return "empty" for data with empty hypotheses', () => {
    expect(detectRcaDataMode({ ...LEGACY_RCA_PAYLOAD, hypotheses: [] })).toBe('empty');
  });
});

/* ------------------------------------------------------------------ */
/* Phase 2 label/color helpers                                         */
/* ------------------------------------------------------------------ */

describe('getCompletenessConfidenceLabel', () => {
  it('should return "High" for score >= 80', () => {
    expect(getCompletenessConfidenceLabel(80)).toBe('High');
    expect(getCompletenessConfidenceLabel(100)).toBe('High');
  });

  it('should return "Medium" for score >= 60', () => {
    expect(getCompletenessConfidenceLabel(60)).toBe('Medium');
    expect(getCompletenessConfidenceLabel(79)).toBe('Medium');
  });

  it('should return "Low" for score >= 30', () => {
    expect(getCompletenessConfidenceLabel(30)).toBe('Low');
    expect(getCompletenessConfidenceLabel(59)).toBe('Low');
  });

  it('should return "Very Low" for score < 30', () => {
    expect(getCompletenessConfidenceLabel(0)).toBe('Very Low');
    expect(getCompletenessConfidenceLabel(29)).toBe('Very Low');
  });
});

describe('getCompletenessConfidenceColor', () => {
  it('should return "success" for high confidence', () => {
    expect(getCompletenessConfidenceColor(80)).toBe('success');
  });

  it('should return "info" for medium confidence', () => {
    expect(getCompletenessConfidenceColor(60)).toBe('info');
  });

  it('should return "warning" for low confidence', () => {
    expect(getCompletenessConfidenceColor(30)).toBe('warning');
  });

  it('should return "error" for very low confidence', () => {
    expect(getCompletenessConfidenceColor(10)).toBe('error');
  });
});

describe('getRiskFactorSeverityColor', () => {
  it('should return "error" for critical', () => {
    expect(getRiskFactorSeverityColor('critical')).toBe('error');
  });

  it('should return "warning" for warning', () => {
    expect(getRiskFactorSeverityColor('warning')).toBe('warning');
  });

  it('should return "info" for info and unknown values', () => {
    expect(getRiskFactorSeverityColor('info')).toBe('info');
    expect(getRiskFactorSeverityColor('unknown')).toBe('info');
  });
});
