import {
  evaluateRule,
  calculateQualityScore,
  CiRecord,
} from '../health-evaluator';
import {
  HealthRuleType,
  HealthRuleCondition,
} from '../../cmdb-health-rule.entity';

function makeCi(overrides: Partial<CiRecord> = {}): CiRecord {
  return {
    id: 'ci-1',
    name: 'Test CI',
    ownedBy: null,
    managedBy: null,
    description: 'A test CI',
    classId: 'class-1',
    lifecycle: 'installed',
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('health-evaluator', () => {
  describe('MISSING_OWNER rule', () => {
    const condition: HealthRuleCondition = {
      type: HealthRuleType.MISSING_OWNER,
    };
    const emptyRels = new Map<string, number>();
    const emptySvc = new Map<string, number>();

    it('flags CIs with no owner and no manager', () => {
      const cis = [makeCi({ id: 'ci-1', ownedBy: null, managedBy: null })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(1);
      expect(findings[0].ciId).toBe('ci-1');
    });

    it('does not flag CIs with an owner', () => {
      const cis = [makeCi({ id: 'ci-1', ownedBy: 'user-1' })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(0);
    });

    it('does not flag CIs with a manager', () => {
      const cis = [makeCi({ id: 'ci-1', managedBy: 'user-1' })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(0);
    });
  });

  describe('STALE_CI rule', () => {
    const condition: HealthRuleCondition = {
      type: HealthRuleType.STALE_CI,
      params: { maxDays: 30 },
    };
    const emptyRels = new Map<string, number>();
    const emptySvc = new Map<string, number>();

    it('flags CIs not updated within maxDays', () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 60);
      const cis = [makeCi({ id: 'ci-1', updatedAt: staleDate })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(1);
      expect(findings[0].details).toHaveProperty('reason');
    });

    it('does not flag recently updated CIs', () => {
      const cis = [makeCi({ id: 'ci-1', updatedAt: new Date() })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(0);
    });

    it('defaults to 90 days when no params', () => {
      const condNoParams: HealthRuleCondition = {
        type: HealthRuleType.STALE_CI,
      };
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const cis = [makeCi({ id: 'ci-1', updatedAt: oldDate })];
      const findings = evaluateRule(condNoParams, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(1);
    });
  });

  describe('NO_RELATIONSHIPS rule', () => {
    const condition: HealthRuleCondition = {
      type: HealthRuleType.NO_RELATIONSHIPS,
    };
    const emptySvc = new Map<string, number>();

    it('flags CIs with no relationships', () => {
      const cis = [makeCi({ id: 'ci-1' })];
      const emptyRels = new Map<string, number>();
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(1);
    });

    it('does not flag CIs with relationships', () => {
      const cis = [makeCi({ id: 'ci-1' })];
      const rels = new Map<string, number>([['ci-1', 3]]);
      const findings = evaluateRule(condition, cis, rels, emptySvc);
      expect(findings).toHaveLength(0);
    });
  });

  describe('MISSING_DESCRIPTION rule', () => {
    const condition: HealthRuleCondition = {
      type: HealthRuleType.MISSING_DESCRIPTION,
    };
    const emptyRels = new Map<string, number>();
    const emptySvc = new Map<string, number>();

    it('flags CIs with null description', () => {
      const cis = [makeCi({ id: 'ci-1', description: null })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(1);
    });

    it('flags CIs with empty description', () => {
      const cis = [makeCi({ id: 'ci-1', description: '  ' })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(1);
    });

    it('does not flag CIs with a description', () => {
      const cis = [makeCi({ id: 'ci-1', description: 'Good desc' })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(0);
    });
  });

  describe('MISSING_CLASS rule', () => {
    const condition: HealthRuleCondition = {
      type: HealthRuleType.MISSING_CLASS,
    };
    const emptyRels = new Map<string, number>();
    const emptySvc = new Map<string, number>();

    it('flags CIs with no classId', () => {
      const cis = [makeCi({ id: 'ci-1', classId: '' })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(1);
    });

    it('does not flag CIs with a classId', () => {
      const cis = [makeCi({ id: 'ci-1', classId: 'cls-1' })];
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(0);
    });
  });

  describe('SERVICE_NO_OFFERING rule', () => {
    const condition: HealthRuleCondition = {
      type: HealthRuleType.SERVICE_NO_OFFERING,
    };
    const emptyRels = new Map<string, number>();

    it('flags service CIs with no offerings', () => {
      const cis = [makeCi({ id: 'ci-1', lifecycle: 'service' })];
      const emptySvc = new Map<string, number>();
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(1);
    });

    it('does not flag service CIs with offerings', () => {
      const cis = [makeCi({ id: 'ci-1', lifecycle: 'service' })];
      const svc = new Map<string, number>([['ci-1', 2]]);
      const findings = evaluateRule(condition, cis, emptyRels, svc);
      expect(findings).toHaveLength(0);
    });

    it('does not flag non-service CIs', () => {
      const cis = [makeCi({ id: 'ci-1', lifecycle: 'installed' })];
      const emptySvc = new Map<string, number>();
      const findings = evaluateRule(condition, cis, emptyRels, emptySvc);
      expect(findings).toHaveLength(0);
    });
  });

  describe('CUSTOM rule', () => {
    it('returns empty findings', () => {
      const condition: HealthRuleCondition = {
        type: HealthRuleType.CUSTOM,
      };
      const cis = [makeCi()];
      const findings = evaluateRule(condition, cis, new Map(), new Map());
      expect(findings).toHaveLength(0);
    });
  });

  describe('calculateQualityScore', () => {
    it('returns 100 when there are no CIs', () => {
      expect(calculateQualityScore(0, 0)).toBe(100);
    });

    it('returns 100 when there are no open findings', () => {
      expect(calculateQualityScore(50, 0)).toBe(100);
    });

    it('returns 0 when every CI has a finding', () => {
      expect(calculateQualityScore(10, 10)).toBe(0);
    });

    it('returns 50 when half the CIs have findings', () => {
      expect(calculateQualityScore(100, 50)).toBe(50);
    });

    it('calculates correct fractional score', () => {
      const score = calculateQualityScore(100, 25);
      expect(score).toBe(75);
    });

    it('clamps at 0 when findings exceed CIs', () => {
      expect(calculateQualityScore(5, 10)).toBe(0);
    });
  });

  describe('multiple CIs', () => {
    it('correctly identifies multiple findings', () => {
      const condition: HealthRuleCondition = {
        type: HealthRuleType.MISSING_OWNER,
      };
      const cis = [
        makeCi({ id: 'ci-1', ownedBy: null, managedBy: null }),
        makeCi({ id: 'ci-2', ownedBy: 'user-1' }),
        makeCi({ id: 'ci-3', ownedBy: null, managedBy: null }),
      ];
      const findings = evaluateRule(condition, cis, new Map(), new Map());
      expect(findings).toHaveLength(2);
      expect(findings.map((f) => f.ciId)).toEqual(['ci-1', 'ci-3']);
    });
  });
});
