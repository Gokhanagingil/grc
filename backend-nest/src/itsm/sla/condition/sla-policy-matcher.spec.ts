import {
  matchPolicies,
  computeSpecificityScore,
  SlaMatchResult,
} from './sla-policy-matcher';
import { SlaDefinition, SlaMetric, SlaSchedule } from '../sla-definition.entity';

const makePolicy = (
  overrides: Partial<SlaDefinition> = {},
): SlaDefinition => {
  return {
    id: 'def-1',
    tenantId: 'tenant-1',
    name: 'Test SLA',
    description: null,
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 3600,
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    businessStartHour: 9,
    businessEndHour: 17,
    businessDays: [1, 2, 3, 4, 5],
    priorityFilter: null,
    serviceIdFilter: null,
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    isActive: true,
    order: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    tenant: {} as never,
    appliesToRecordType: 'INCIDENT',
    conditionTree: null,
    responseTimeSeconds: null,
    resolutionTimeSeconds: null,
    priorityWeight: 0,
    stopProcessing: false,
    effectiveFrom: null,
    effectiveTo: null,
    version: 2,
    ...overrides,
  } as SlaDefinition;
};

describe('SlaConditionPolicyMatcher', () => {
  describe('computeSpecificityScore', () => {
    it('should return 0 for null tree', () => {
      expect(computeSpecificityScore(null)).toBe(0);
    });

    it('should return 0 for undefined tree', () => {
      expect(computeSpecificityScore(undefined)).toBe(0);
    });

    it('should score single leaf with is operator = 13', () => {
      const score = computeSpecificityScore({
        field: 'priority',
        operator: 'is',
        value: 'P1',
      });
      expect(score).toBe(13); // 10 base + 3 for 'is'
    });

    it('should score single leaf with in operator = 11', () => {
      const score = computeSpecificityScore({
        field: 'priority',
        operator: 'in',
        value: ['P1', 'P2'],
      });
      expect(score).toBe(11); // 10 base + 1 for 'in'
    });

    it('should score multiple leaves in AND group', () => {
      const score = computeSpecificityScore({
        operator: 'AND',
        children: [
          { field: 'priority', operator: 'is', value: 'P1' },
          { field: 'impact', operator: 'is', value: 'HIGH' },
          { field: 'serviceId', operator: 'is', value: 'svc-1' },
        ],
      });
      // 3 leaves × (10+3) = 39
      expect(score).toBe(39);
    });

    it('should add nesting bonus for nested groups', () => {
      const flat = computeSpecificityScore({
        operator: 'AND',
        children: [
          { field: 'priority', operator: 'is', value: 'P1' },
        ],
      });

      const nested = computeSpecificityScore({
        operator: 'AND',
        children: [
          {
            operator: 'OR',
            children: [
              { field: 'priority', operator: 'is', value: 'P1' },
            ],
          },
        ],
      });

      expect(nested).toBeGreaterThan(flat);
    });
  });

  describe('matchPolicies', () => {
    it('should return no match when no policies provided', () => {
      const result = matchPolicies([], { priority: 'P1' });
      expect(result.matched).toBe(false);
      expect(result.selectedPolicy).toBeNull();
      expect(result.evaluatedCount).toBe(0);
    });

    it('should match policy with null condition tree (catches all)', () => {
      const policies = [
        makePolicy({
          conditionTree: null,
          responseTimeSeconds: 3600,
          resolutionTimeSeconds: 14400,
        }),
      ];
      const result = matchPolicies(policies, { priority: 'P1' });
      expect(result.matched).toBe(true);
      expect(result.selectedPolicyId).toBe('def-1');
    });

    it('should match policy with matching condition', () => {
      const policies = [
        makePolicy({
          conditionTree: {
            operator: 'AND',
            children: [
              { field: 'priority', operator: 'is', value: 'P1' },
            ],
          },
          responseTimeSeconds: 3600,
          resolutionTimeSeconds: 14400,
        }),
      ];
      const result = matchPolicies(policies, { priority: 'P1' });
      expect(result.matched).toBe(true);
    });

    it('should not match policy with non-matching condition', () => {
      const policies = [
        makePolicy({
          conditionTree: {
            operator: 'AND',
            children: [
              { field: 'priority', operator: 'is', value: 'P1' },
            ],
          },
        }),
      ];
      const result = matchPolicies(policies, { priority: 'P3' });
      expect(result.matched).toBe(false);
    });

    it('should return correct target times from v2 fields', () => {
      const policies = [
        makePolicy({
          conditionTree: null,
          responseTimeSeconds: 3600,
          resolutionTimeSeconds: 14400,
        }),
      ];
      const result = matchPolicies(policies, {});
      expect(result.responseTimeSeconds).toBe(3600);
      expect(result.resolutionTimeSeconds).toBe(14400);
    });

    describe('precedence', () => {
      it('should prefer higher priorityWeight', () => {
        const policies = [
          makePolicy({
            id: 'low-weight',
            name: 'Low Weight',
            priorityWeight: 10,
            conditionTree: null,
          }),
          makePolicy({
            id: 'high-weight',
            name: 'High Weight',
            priorityWeight: 100,
            conditionTree: null,
          }),
        ];
        const result = matchPolicies(policies, {});
        expect(result.selectedPolicyId).toBe('high-weight');
      });

      it('should use specificity as tie-breaker', () => {
        const policies = [
          makePolicy({
            id: 'generic',
            name: 'Generic',
            priorityWeight: 50,
            conditionTree: {
              operator: 'AND',
              children: [
                { field: 'priority', operator: 'is', value: 'P1' },
              ],
            },
          }),
          makePolicy({
            id: 'specific',
            name: 'Specific',
            priorityWeight: 50,
            conditionTree: {
              operator: 'AND',
              children: [
                { field: 'priority', operator: 'is', value: 'P1' },
                { field: 'impact', operator: 'is', value: 'HIGH' },
              ],
            },
          }),
        ];
        const result = matchPolicies(policies, {
          priority: 'P1',
          impact: 'HIGH',
        });
        expect(result.selectedPolicyId).toBe('specific');
      });

      it('should use createdAt as second tie-breaker', () => {
        const policies = [
          makePolicy({
            id: 'newer',
            name: 'Newer',
            priorityWeight: 50,
            conditionTree: null,
            createdAt: new Date('2026-02-01T00:00:00Z'),
          }),
          makePolicy({
            id: 'older',
            name: 'Older',
            priorityWeight: 50,
            conditionTree: null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
          }),
        ];
        const result = matchPolicies(policies, {});
        expect(result.selectedPolicyId).toBe('older');
      });

      it('should use id as final tie-breaker', () => {
        const ts = new Date('2026-01-01T00:00:00Z');
        const policies = [
          makePolicy({
            id: 'bbb',
            name: 'B',
            priorityWeight: 50,
            conditionTree: null,
            createdAt: ts,
          }),
          makePolicy({
            id: 'aaa',
            name: 'A',
            priorityWeight: 50,
            conditionTree: null,
            createdAt: ts,
          }),
        ];
        const result = matchPolicies(policies, {});
        expect(result.selectedPolicyId).toBe('aaa');
      });
    });

    describe('effective window', () => {
      it('should exclude policies before effectiveFrom', () => {
        const policies = [
          makePolicy({
            conditionTree: null,
            effectiveFrom: new Date('2026-06-01T00:00:00Z'),
          }),
        ];
        const result = matchPolicies(
          policies,
          {},
          new Date('2026-03-01T00:00:00Z'),
        );
        expect(result.matched).toBe(false);
      });

      it('should exclude policies after effectiveTo', () => {
        const policies = [
          makePolicy({
            conditionTree: null,
            effectiveTo: new Date('2025-12-31T00:00:00Z'),
          }),
        ];
        const result = matchPolicies(
          policies,
          {},
          new Date('2026-03-01T00:00:00Z'),
        );
        expect(result.matched).toBe(false);
      });

      it('should include policies within effective window', () => {
        const policies = [
          makePolicy({
            conditionTree: null,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
            effectiveTo: new Date('2026-12-31T00:00:00Z'),
          }),
        ];
        const result = matchPolicies(
          policies,
          {},
          new Date('2026-06-15T00:00:00Z'),
        );
        expect(result.matched).toBe(true);
      });
    });

    describe('explainability', () => {
      it('should include evaluation details for all policies', () => {
        const policies = [
          makePolicy({
            id: 'p1',
            name: 'Policy 1',
            conditionTree: {
              operator: 'AND',
              children: [
                { field: 'priority', operator: 'is', value: 'P1' },
              ],
            },
          }),
          makePolicy({
            id: 'p2',
            name: 'Policy 2',
            conditionTree: {
              operator: 'AND',
              children: [
                { field: 'priority', operator: 'is', value: 'P2' },
              ],
            },
          }),
        ];
        const result = matchPolicies(policies, { priority: 'P1' });
        expect(result.evaluationDetails).toHaveLength(2);
        expect(result.evaluationDetails[0].matched).toBe(true);
        expect(result.evaluationDetails[1].matched).toBe(false);
      });

      it('should include match reason', () => {
        const policies = [
          makePolicy({
            conditionTree: {
              operator: 'AND',
              children: [
                { field: 'priority', operator: 'is', value: 'P1' },
              ],
            },
          }),
        ];
        const result = matchPolicies(policies, { priority: 'P1' });
        expect(result.matchReason).toContain('Matched');
        expect(result.matchReason).toContain('priority');
      });
    });

    describe('no-match behavior', () => {
      it('should not crash and return clear no-match result', () => {
        const policies = [
          makePolicy({
            conditionTree: {
              operator: 'AND',
              children: [
                { field: 'priority', operator: 'is', value: 'P1' },
              ],
            },
          }),
        ];
        const result = matchPolicies(policies, { priority: 'P5' });
        expect(result.matched).toBe(false);
        expect(result.selectedPolicy).toBeNull();
        expect(result.matchReason).toContain('No policy matched');
        expect(result.evaluatedCount).toBe(1);
      });
    });

    describe('determinism', () => {
      it('should produce the same result for the same input', () => {
        const policies = [
          makePolicy({
            id: 'p1',
            name: 'Policy 1',
            priorityWeight: 50,
            conditionTree: null,
            createdAt: new Date('2026-01-01'),
          }),
          makePolicy({
            id: 'p2',
            name: 'Policy 2',
            priorityWeight: 50,
            conditionTree: null,
            createdAt: new Date('2026-01-02'),
          }),
        ];

        const results: SlaMatchResult[] = [];
        for (let i = 0; i < 10; i++) {
          results.push(matchPolicies(policies, { priority: 'P1' }));
        }

        // All results should select the same policy
        const allSamePolicy = results.every(
          (r) => r.selectedPolicyId === results[0].selectedPolicyId,
        );
        expect(allSamePolicy).toBe(true);
      });
    });
  });
});
