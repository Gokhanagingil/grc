/**
 * Regression tests for Change Widget Data Normalizers
 *
 * Hotfix: Change page crash — `undefined is not an object (evaluating 'i.tasks.reduce')`
 *
 * Covers:
 * - normalizeSuggestedTaskPackResponse: tasks undefined/null/missing/[]/valid
 * - normalizeGovernanceEvaluationResponse: partial payloads, missing arrays/objects
 * - normalizeGuardrailEvaluationResponse: partial payloads, missing nested objects
 * - safeArray helper
 *
 * @regression
 */

import {
  safeArray,
  normalizeSuggestedTaskPackResponse,
  normalizeGovernanceEvaluationResponse,
  normalizeGuardrailEvaluationResponse,
} from '../changeWidgetNormalizers';

// ============================================================================
// safeArray
// ============================================================================

describe('safeArray', () => {
  it('returns [] for undefined', () => {
    expect(safeArray(undefined)).toEqual([]);
  });

  it('returns [] for null', () => {
    expect(safeArray(null)).toEqual([]);
  });

  it('returns [] for non-array', () => {
    expect(safeArray('string')).toEqual([]);
    expect(safeArray(42)).toEqual([]);
    expect(safeArray({})).toEqual([]);
  });

  it('returns the array if already an array', () => {
    const arr = [1, 2, 3];
    expect(safeArray(arr)).toBe(arr);
  });

  it('returns empty array for empty array input', () => {
    expect(safeArray([])).toEqual([]);
  });
});

// ============================================================================
// normalizeSuggestedTaskPackResponse
// ============================================================================

describe('normalizeSuggestedTaskPackResponse', () => {
  it('returns safe default shape for null input', () => {
    const result = normalizeSuggestedTaskPackResponse(null);
    expect(result).toBeDefined();
    expect(result.tasks).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.totalTasks).toBe(0);
    expect(result.recommendedCount).toBe(0);
    expect(result.changeId).toBe('');
  });

  it('returns safe default shape for undefined input', () => {
    const result = normalizeSuggestedTaskPackResponse(undefined);
    expect(result.tasks).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('returns safe default shape when tasks is undefined', () => {
    const result = normalizeSuggestedTaskPackResponse({
      changeId: 'c1',
      riskLevel: 'HIGH',
      topologyRiskScore: 80,
    } as Record<string, unknown>);
    expect(result.tasks).toEqual([]);
    expect(result.changeId).toBe('c1');
    expect(result.riskLevel).toBe('HIGH');
    expect(result.topologyRiskScore).toBe(80);
  });

  it('returns safe default shape when tasks is null', () => {
    const result = normalizeSuggestedTaskPackResponse({
      changeId: 'c2',
      tasks: null,
    } as Record<string, unknown>);
    expect(result.tasks).toEqual([]);
  });

  it('preserves valid tasks array', () => {
    const task = {
      templateKey: 'validate-db',
      category: 'VALIDATION',
      title: 'Validate DB',
      description: 'Run DB validation',
      priority: 'HIGH',
      reason: 'High risk change',
      triggerSignals: ['topology_risk'],
      recommended: true,
    };
    const result = normalizeSuggestedTaskPackResponse({
      changeId: 'c3',
      tasks: [task],
      totalTasks: 1,
      recommendedCount: 1,
      warnings: ['Partial topology data'],
    } as Record<string, unknown>);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toBe(task);
    expect(result.totalTasks).toBe(1);
    expect(result.recommendedCount).toBe(1);
    expect(result.warnings).toEqual(['Partial topology data']);
  });

  it('preserves empty tasks array', () => {
    const result = normalizeSuggestedTaskPackResponse({
      changeId: 'c4',
      tasks: [],
      totalTasks: 0,
    } as Record<string, unknown>);
    expect(result.tasks).toEqual([]);
    expect(result.totalTasks).toBe(0);
  });

  it('auto-computes totalTasks and recommendedCount from tasks', () => {
    const result = normalizeSuggestedTaskPackResponse({
      changeId: 'c5',
      tasks: [
        { templateKey: 'a', category: 'VALIDATION', title: 'A', description: '', priority: 'LOW', reason: '', triggerSignals: [], recommended: true },
        { templateKey: 'b', category: 'MONITORING', title: 'B', description: '', priority: 'LOW', reason: '', triggerSignals: [], recommended: false },
      ],
    } as Record<string, unknown>);
    expect(result.totalTasks).toBe(2);
    expect(result.recommendedCount).toBe(1);
  });

  it('handles warnings as undefined gracefully', () => {
    const result = normalizeSuggestedTaskPackResponse({
      changeId: 'c6',
      tasks: [],
      warnings: undefined,
    } as Record<string, unknown>);
    expect(result.warnings).toEqual([]);
  });

  it('does not crash with .reduce() on normalized tasks (exact crash pattern)', () => {
    const result = normalizeSuggestedTaskPackResponse(null);
    // This is the exact crash pattern from the bug report:
    // pack.tasks.reduce((acc, task) => { ... }, {})
    expect(() => {
      const init: Record<string, unknown[]> = {};
      result.tasks.reduce((acc, t) => {
        const cat = t.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(t);
        return acc;
      }, init);
    }).not.toThrow();
  });

  it('does not crash with .filter() on normalized tasks', () => {
    const result = normalizeSuggestedTaskPackResponse({ changeId: 'c7' } as Record<string, unknown>);
    expect(() => {
      result.tasks.filter(() => true);
    }).not.toThrow();
  });

  it('does not crash with .map() on normalized tasks', () => {
    const result = normalizeSuggestedTaskPackResponse({ changeId: 'c8' } as Record<string, unknown>);
    expect(() => {
      result.tasks.map((t) => t);
    }).not.toThrow();
  });

  it('does not crash with .length on normalized tasks', () => {
    const result = normalizeSuggestedTaskPackResponse(undefined);
    expect(() => {
      void result.tasks.length;
    }).not.toThrow();
    expect(result.tasks.length).toBe(0);
  });

  it('does not crash with .length on normalized warnings', () => {
    const result = normalizeSuggestedTaskPackResponse({ changeId: 'c9' } as Record<string, unknown>);
    expect(() => {
      void result.warnings.length;
    }).not.toThrow();
    expect(result.warnings.length).toBe(0);
  });
});

// ============================================================================
// normalizeGovernanceEvaluationResponse
// ============================================================================

describe('normalizeGovernanceEvaluationResponse', () => {
  it('returns null for null input', () => {
    expect(normalizeGovernanceEvaluationResponse(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeGovernanceEvaluationResponse(undefined)).toBeNull();
  });

  it('returns null when decision is missing (no meaningful data)', () => {
    expect(normalizeGovernanceEvaluationResponse({ changeId: 'c1' })).toBeNull();
  });

  it('returns safe shape with all arrays/objects defaulted for partial payload', () => {
    const result = normalizeGovernanceEvaluationResponse({
      changeId: 'c1',
      decision: 'BLOCKED',
    });
    expect(result).not.toBeNull();
    expect(result!.decision).toBe('BLOCKED');
    expect(result!.recommendedActions).toEqual([]);
    expect(result!.warnings).toEqual([]);
    expect(result!.explainability.summary).toBe('');
    expect(result!.explainability.factors).toEqual([]);
    expect(result!.explainability.matchedPolicyNames).toEqual([]);
    expect(result!.explainability.topDependencyPaths).toEqual([]);
  });

  it('does not crash with .filter() on recommendedActions', () => {
    const result = normalizeGovernanceEvaluationResponse({
      decision: 'CAB_REQUIRED',
    });
    expect(() => {
      result!.recommendedActions.filter((a) => a.required && !a.satisfied);
    }).not.toThrow();
  });

  it('does not crash with .length on warnings', () => {
    const result = normalizeGovernanceEvaluationResponse({
      decision: 'ALLOWED',
    });
    expect(result!.warnings.length).toBe(0);
  });

  it('does not crash with .map() on explainability.factors', () => {
    const result = normalizeGovernanceEvaluationResponse({
      decision: 'ALLOWED',
      explainability: { summary: 'test' },
    });
    expect(() => {
      result!.explainability.factors.map((f) => f.key);
    }).not.toThrow();
  });

  it('preserves valid data', () => {
    const action = { key: 'backout', label: 'Add backout plan', reason: 'Missing', required: true, satisfied: false };
    const factor = { key: 'risk', label: 'Risk', value: 'HIGH', severity: 'critical' as const, explanation: 'Score > 80' };
    const result = normalizeGovernanceEvaluationResponse({
      changeId: 'c2',
      decision: 'BLOCKED',
      recommendedActions: [action],
      warnings: ['High risk'],
      explainability: {
        summary: 'Blocked due to high risk',
        factors: [factor],
        matchedPolicyNames: ['DefaultPolicy'],
        topDependencyPaths: [{ nodeLabels: ['A', 'B'], depth: 2 }],
      },
      topologyDataAvailable: true,
      topologyRiskScore: 90,
      evaluatedAt: '2024-01-01T00:00:00Z',
    });
    expect(result!.recommendedActions).toHaveLength(1);
    expect(result!.warnings).toEqual(['High risk']);
    expect(result!.explainability.factors).toHaveLength(1);
    expect(result!.explainability.matchedPolicyNames).toEqual(['DefaultPolicy']);
    expect(result!.explainability.topDependencyPaths).toHaveLength(1);
  });
});

// ============================================================================
// normalizeGuardrailEvaluationResponse
// ============================================================================

describe('normalizeGuardrailEvaluationResponse', () => {
  it('returns null for null input', () => {
    expect(normalizeGuardrailEvaluationResponse(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeGuardrailEvaluationResponse(undefined)).toBeNull();
  });

  it('returns null when guardrailStatus is missing', () => {
    expect(normalizeGuardrailEvaluationResponse({ changeId: 'c1' })).toBeNull();
  });

  it('returns safe shape with all defaults for partial payload', () => {
    const result = normalizeGuardrailEvaluationResponse({
      changeId: 'c1',
      guardrailStatus: 'WARN',
    });
    expect(result).not.toBeNull();
    expect(result!.guardrailStatus).toBe('WARN');
    expect(result!.reasons).toEqual([]);
    expect(result!.recommendedActions).toEqual([]);
    expect(result!.warnings).toEqual([]);
    expect(result!.evidenceSummary.blastRadiusMetrics.totalImpactedNodes).toBe(0);
    expect(result!.evidenceSummary.singlePointsOfFailure).toEqual([]);
    expect(result!.evidenceSummary.fragileDependencies).toEqual([]);
    expect(result!.explainability.summary).toBe('');
    expect(result!.explainability.factors).toEqual([]);
    expect(result!.policyFlags.topologyRiskScore).toBe(0);
  });

  it('does not crash with .length on reasons/warnings', () => {
    const result = normalizeGuardrailEvaluationResponse({
      guardrailStatus: 'PASS',
    });
    expect(result!.reasons.length).toBe(0);
    expect(result!.warnings.length).toBe(0);
  });

  it('does not crash on .filter() on recommendedActions', () => {
    const result = normalizeGuardrailEvaluationResponse({
      guardrailStatus: 'BLOCK',
    });
    expect(() => {
      result!.recommendedActions.filter((a) => a.required && !a.satisfied);
    }).not.toThrow();
  });

  it('safely accesses nested evidenceSummary.blastRadiusMetrics', () => {
    const result = normalizeGuardrailEvaluationResponse({
      guardrailStatus: 'WARN',
      evidenceSummary: null,
    });
    expect(result!.evidenceSummary.blastRadiusMetrics.totalImpactedNodes).toBe(0);
    expect(result!.evidenceSummary.blastRadiusMetrics.crossServicePropagation).toBe(false);
  });

  it('preserves valid nested data', () => {
    const result = normalizeGuardrailEvaluationResponse({
      changeId: 'c2',
      guardrailStatus: 'BLOCK',
      governanceDecision: 'BLOCKED',
      reasons: [{ code: 'HIGH_RISK', severity: 'critical', message: 'Score > 80' }],
      recommendedActions: [{ key: 'backout', label: 'Add backout', reason: 'Missing', required: true, satisfied: false }],
      warnings: ['Critical'],
      evidenceSummary: {
        blastRadiusMetrics: {
          totalImpactedNodes: 15,
          criticalCiCount: 3,
          impactedServiceCount: 5,
          maxChainDepth: 4,
          crossServicePropagation: true,
        },
        singlePointsOfFailure: ['DB-Primary'],
        fragileDependencies: [{ affectedNodeLabel: 'Cache', description: 'No redundancy', type: 'no_redundancy' }],
        topologyRiskScore: 85,
        topologyDataAvailable: true,
      },
      policyFlags: { topologyRiskScore: 85 },
      evaluatedAt: '2024-01-01T00:00:00Z',
    });
    expect(result!.reasons).toHaveLength(1);
    expect(result!.evidenceSummary.blastRadiusMetrics.totalImpactedNodes).toBe(15);
    expect(result!.evidenceSummary.singlePointsOfFailure).toEqual(['DB-Primary']);
  });
});
