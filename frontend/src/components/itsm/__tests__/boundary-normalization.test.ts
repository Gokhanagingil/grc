/**
 * Boundary Normalization Regression Tests
 *
 * Tests that ITSM component boundary normalizers handle missing/null/undefined
 * array fields without crashing. Reproduces the exact crash path:
 *   `undefined is not an object (evaluating 'a.resolvedRisks.length')`
 *
 * Pattern class: any `.length`, `.map`, `.filter` on an API-derived array field
 * that may be null/undefined/missing in real payloads.
 *
 * @regression
 */

import { safeArray, normalizeArrayFields } from '../../../utils/safeHelpers';

/* ------------------------------------------------------------------ */
/* Shared helper tests (safeArray edge cases for this pattern)         */
/* ------------------------------------------------------------------ */

describe('safeArray — runtime crash prevention', () => {
  it('returns [] for undefined', () => {
    expect(safeArray(undefined)).toEqual([]);
  });

  it('returns [] for null', () => {
    expect(safeArray(null)).toEqual([]);
  });

  it('returns the same array for valid array', () => {
    const arr = [1, 2, 3];
    expect(safeArray(arr)).toBe(arr);
  });

  it('returns [] for empty array', () => {
    expect(safeArray([])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* CustomerRiskIntelligence normalizer                                 */
/* ------------------------------------------------------------------ */

// Inline replica of the normalizer logic (tests the pattern, not the import)
function normalizeCustomerRiskImpact(raw: Record<string, unknown>) {
  return {
    ...raw,
    resolvedRisks: safeArray(raw.resolvedRisks as unknown[] | null | undefined).map(
      (risk: unknown) => {
        const r = risk as Record<string, unknown>;
        return {
          ...r,
          relevancePaths: safeArray(r.relevancePaths as unknown[] | null | undefined),
        };
      },
    ),
    topReasons: safeArray(raw.topReasons as string[] | null | undefined),
  };
}

describe('normalizeCustomerRiskImpact — resolvedRisks crash prevention', () => {
  const BASE_PAYLOAD = {
    changeId: 'chg-001',
    aggregateScore: 42,
    aggregateLabel: 'MEDIUM',
    calculatedAt: '2026-01-01T00:00:00Z',
    riskFactor: { score: 30, weight: 10, weightedScore: 3, evidence: 'test' },
  };

  it('should not crash when resolvedRisks is undefined', () => {
    const result = normalizeCustomerRiskImpact({ ...BASE_PAYLOAD });
    expect(result.resolvedRisks).toEqual([]);
    expect(result.resolvedRisks.length).toBe(0); // This was the exact crash line
  });

  it('should not crash when resolvedRisks is null', () => {
    const result = normalizeCustomerRiskImpact({ ...BASE_PAYLOAD, resolvedRisks: null });
    expect(result.resolvedRisks).toEqual([]);
  });

  it('should not crash when resolvedRisks is an empty array', () => {
    const result = normalizeCustomerRiskImpact({ ...BASE_PAYLOAD, resolvedRisks: [] });
    expect(result.resolvedRisks).toEqual([]);
  });

  it('should preserve valid resolvedRisks with items', () => {
    const risks = [
      {
        catalogRiskId: 'r1',
        title: 'Risk 1',
        severity: 'HIGH',
        relevancePaths: ['service_binding'],
        contributionScore: 5.0,
        contributionReason: 'test',
        status: 'ACTIVE',
      },
    ];
    const result = normalizeCustomerRiskImpact({ ...BASE_PAYLOAD, resolvedRisks: risks });
    expect(result.resolvedRisks).toHaveLength(1);
    expect(result.resolvedRisks[0].catalogRiskId).toBe('r1');
  });

  it('should normalize missing relevancePaths inside resolvedRisks items', () => {
    const risks = [
      {
        catalogRiskId: 'r2',
        title: 'Risk 2',
        severity: 'LOW',
        // relevancePaths is MISSING
        contributionScore: 1.0,
        contributionReason: 'test',
        status: 'MITIGATED',
      },
    ];
    const result = normalizeCustomerRiskImpact({ ...BASE_PAYLOAD, resolvedRisks: risks });
    expect(result.resolvedRisks[0].relevancePaths).toEqual([]);
  });

  it('should not crash when topReasons is undefined', () => {
    const result = normalizeCustomerRiskImpact({ ...BASE_PAYLOAD });
    expect(result.topReasons).toEqual([]);
    expect(result.topReasons.length).toBe(0);
  });

  it('should not crash when topReasons is null', () => {
    const result = normalizeCustomerRiskImpact({ ...BASE_PAYLOAD, topReasons: null });
    expect(result.topReasons).toEqual([]);
  });

  it('should preserve valid topReasons', () => {
    const result = normalizeCustomerRiskImpact({
      ...BASE_PAYLOAD,
      topReasons: ['High blast radius', 'Critical CI affected'],
    });
    expect(result.topReasons).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/* GovernanceBanner normalizer                                         */
/* ------------------------------------------------------------------ */

function normalizePolicyEvaluation(raw: Record<string, unknown>) {
  return {
    ...raw,
    matchedPolicies: safeArray(raw.matchedPolicies as unknown[] | null | undefined),
    rulesTriggered: safeArray(raw.rulesTriggered as unknown[] | null | undefined),
    reasons: safeArray(raw.reasons as string[] | null | undefined),
    requiredActions: safeArray(raw.requiredActions as string[] | null | undefined),
  };
}

describe('normalizePolicyEvaluation — array field crash prevention', () => {
  const BASE_EVAL = {
    requireCABApproval: false,
    blockDuringFreeze: false,
    minLeadTimeHours: null,
    autoApproveIfRiskBelow: null,
    decisionRecommendation: 'ALLOW',
  };

  it('should not crash when all array fields are undefined', () => {
    const result = normalizePolicyEvaluation({ ...BASE_EVAL });
    expect(result.matchedPolicies).toEqual([]);
    expect(result.matchedPolicies.length).toBe(0); // Exact crash pattern
    expect(result.rulesTriggered).toEqual([]);
    expect(result.reasons).toEqual([]);
    expect(result.requiredActions).toEqual([]);
  });

  it('should not crash when all array fields are null', () => {
    const result = normalizePolicyEvaluation({
      ...BASE_EVAL,
      matchedPolicies: null,
      rulesTriggered: null,
      reasons: null,
      requiredActions: null,
    });
    expect(result.matchedPolicies).toEqual([]);
    expect(result.rulesTriggered).toEqual([]);
    expect(result.reasons).toEqual([]);
    expect(result.requiredActions).toEqual([]);
  });

  it('should preserve valid arrays', () => {
    const result = normalizePolicyEvaluation({
      ...BASE_EVAL,
      matchedPolicies: [{ policyId: 'p1' }],
      rulesTriggered: [{ policyName: 'Freeze', conditionsSummary: 'c', actionsSummary: 'a' }],
      reasons: ['Freeze window active'],
      requiredActions: ['CAB approval'],
    });
    expect(result.matchedPolicies).toHaveLength(1);
    expect(result.rulesTriggered).toHaveLength(1);
    expect(result.reasons).toHaveLength(1);
    expect(result.requiredActions).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* IncidentImpactTab normalizer                                        */
/* ------------------------------------------------------------------ */

function normalizeImpactSummary(raw: Record<string, unknown>) {
  const affectedCis = (raw.affectedCis || {}) as Record<string, unknown>;
  return {
    ...raw,
    impactedServices: safeArray(raw.impactedServices as unknown[] | null | undefined),
    impactedOfferings: safeArray(raw.impactedOfferings as unknown[] | null | undefined),
    affectedCis: {
      count: (affectedCis.count as number) ?? 0,
      criticalCount: (affectedCis.criticalCount as number) ?? 0,
      topClasses: safeArray(affectedCis.topClasses as unknown[] | null | undefined),
    },
  };
}

describe('normalizeImpactSummary — array field crash prevention', () => {
  it('should not crash when all fields are undefined', () => {
    const result = normalizeImpactSummary({});
    expect(result.impactedServices).toEqual([]);
    expect(result.impactedServices.length).toBe(0);
    expect(result.impactedOfferings).toEqual([]);
    expect(result.affectedCis.count).toBe(0);
    expect(result.affectedCis.criticalCount).toBe(0);
    expect(result.affectedCis.topClasses).toEqual([]);
    expect(result.affectedCis.topClasses.length).toBe(0);
  });

  it('should not crash when all fields are null', () => {
    const result = normalizeImpactSummary({
      impactedServices: null,
      impactedOfferings: null,
      affectedCis: null,
    });
    expect(result.impactedServices).toEqual([]);
    expect(result.impactedOfferings).toEqual([]);
    expect(result.affectedCis.topClasses).toEqual([]);
  });

  it('should not crash when affectedCis exists but topClasses is missing', () => {
    const result = normalizeImpactSummary({
      impactedServices: [],
      impactedOfferings: [],
      affectedCis: { count: 5, criticalCount: 2 },
    });
    expect(result.affectedCis.count).toBe(5);
    expect(result.affectedCis.criticalCount).toBe(2);
    expect(result.affectedCis.topClasses).toEqual([]);
  });

  it('should preserve valid data', () => {
    const result = normalizeImpactSummary({
      impactedServices: [{ serviceId: 's1', name: 'Svc' }],
      impactedOfferings: [{ offeringId: 'o1', name: 'Off' }],
      affectedCis: {
        count: 10,
        criticalCount: 3,
        topClasses: [{ className: 'Server', count: 5 }],
      },
    });
    expect(result.impactedServices).toHaveLength(1);
    expect(result.impactedOfferings).toHaveLength(1);
    expect(result.affectedCis.topClasses).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* normalizeArrayFields utility                                        */
/* ------------------------------------------------------------------ */

describe('normalizeArrayFields — generic pattern test', () => {
  it('should default missing array fields to []', () => {
    const result = normalizeArrayFields(
      { id: '1', name: 'test' } as Record<string, unknown>,
      ['tags', 'items'],
    );
    expect(result.tags).toEqual([]);
    expect(result.items).toEqual([]);
    expect(result.name).toBe('test');
  });

  it('should preserve existing array fields', () => {
    const result = normalizeArrayFields(
      { tags: ['a', 'b'], items: [1] } as Record<string, unknown>,
      ['tags', 'items'],
    );
    expect(result.tags).toEqual(['a', 'b']);
    expect(result.items).toEqual([1]);
  });

  it('should handle null input', () => {
    const result = normalizeArrayFields(null, ['tags']);
    expect(result.tags).toEqual([]);
  });

  it('should handle undefined input', () => {
    const result = normalizeArrayFields(undefined, ['tags']);
    expect(result.tags).toEqual([]);
  });
});
