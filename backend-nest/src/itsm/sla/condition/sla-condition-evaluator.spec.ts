import { evaluateConditionTree } from './sla-condition-evaluator';
import { SlaConditionNode } from '../sla-definition.entity';

describe('SlaConditionEvaluator', () => {
  describe('null / empty tree', () => {
    it('should match everything when tree is null', () => {
      expect(evaluateConditionTree(null, { priority: 'P1' })).toBe(true);
    });

    it('should match everything when tree is undefined', () => {
      expect(evaluateConditionTree(undefined, { priority: 'P1' })).toBe(true);
    });
  });

  describe('leaf operators', () => {
    it('is — should match equal values', () => {
      const tree: SlaConditionNode = {
        field: 'priority',
        operator: 'is',
        value: 'P1',
      };
      expect(evaluateConditionTree(tree, { priority: 'P1' })).toBe(true);
      expect(evaluateConditionTree(tree, { priority: 'P2' })).toBe(false);
    });

    it('is — should be case-insensitive for strings', () => {
      const tree: SlaConditionNode = {
        field: 'priority',
        operator: 'is',
        value: 'p1',
      };
      expect(evaluateConditionTree(tree, { priority: 'P1' })).toBe(true);
    });

    it('is_not — should match unequal values', () => {
      const tree: SlaConditionNode = {
        field: 'priority',
        operator: 'is_not',
        value: 'P1',
      };
      expect(evaluateConditionTree(tree, { priority: 'P2' })).toBe(true);
      expect(evaluateConditionTree(tree, { priority: 'P1' })).toBe(false);
    });

    it('in — should match when value is in array', () => {
      const tree: SlaConditionNode = {
        field: 'priority',
        operator: 'in',
        value: ['P1', 'P2'],
      };
      expect(evaluateConditionTree(tree, { priority: 'P1' })).toBe(true);
      expect(evaluateConditionTree(tree, { priority: 'P3' })).toBe(false);
    });

    it('not_in — should match when value is not in array', () => {
      const tree: SlaConditionNode = {
        field: 'priority',
        operator: 'not_in',
        value: ['P1', 'P2'],
      };
      expect(evaluateConditionTree(tree, { priority: 'P3' })).toBe(true);
      expect(evaluateConditionTree(tree, { priority: 'P1' })).toBe(false);
    });

    it('contains — should match substring', () => {
      const tree: SlaConditionNode = {
        field: 'category',
        operator: 'contains',
        value: 'network',
      };
      expect(
        evaluateConditionTree(tree, { category: 'NETWORK_ISSUE' }),
      ).toBe(true);
      expect(
        evaluateConditionTree(tree, { category: 'SOFTWARE' }),
      ).toBe(false);
    });

    it('is_empty — should match null/undefined/empty', () => {
      const tree: SlaConditionNode = {
        field: 'assignmentGroup',
        operator: 'is_empty',
        value: null,
      };
      expect(evaluateConditionTree(tree, { assignmentGroup: null })).toBe(
        true,
      );
      expect(evaluateConditionTree(tree, { assignmentGroup: '' })).toBe(true);
      expect(evaluateConditionTree(tree, {})).toBe(true);
      expect(
        evaluateConditionTree(tree, { assignmentGroup: 'TeamA' }),
      ).toBe(false);
    });

    it('is_not_empty — should match non-empty values', () => {
      const tree: SlaConditionNode = {
        field: 'assignmentGroup',
        operator: 'is_not_empty',
        value: null,
      };
      expect(
        evaluateConditionTree(tree, { assignmentGroup: 'TeamA' }),
      ).toBe(true);
      expect(evaluateConditionTree(tree, { assignmentGroup: null })).toBe(
        false,
      );
    });

    it('gt / gte / lt / lte — should compare numerically', () => {
      const gt: SlaConditionNode = {
        field: 'score',
        operator: 'gt',
        value: 50,
      };
      expect(evaluateConditionTree(gt, { score: 60 })).toBe(true);
      expect(evaluateConditionTree(gt, { score: 50 })).toBe(false);

      const gte: SlaConditionNode = {
        field: 'score',
        operator: 'gte',
        value: 50,
      };
      expect(evaluateConditionTree(gte, { score: 50 })).toBe(true);
      expect(evaluateConditionTree(gte, { score: 49 })).toBe(false);

      const lt: SlaConditionNode = {
        field: 'score',
        operator: 'lt',
        value: 50,
      };
      expect(evaluateConditionTree(lt, { score: 40 })).toBe(true);

      const lte: SlaConditionNode = {
        field: 'score',
        operator: 'lte',
        value: 50,
      };
      expect(evaluateConditionTree(lte, { score: 50 })).toBe(true);
    });

    it('unknown operator — should fail closed (not match)', () => {
      const tree: SlaConditionNode = {
        field: 'priority',
        operator: 'regex_match',
        value: '.*',
      };
      expect(evaluateConditionTree(tree, { priority: 'P1' })).toBe(false);
    });
  });

  describe('AND groups', () => {
    it('should match when all children match', () => {
      const tree: SlaConditionNode = {
        operator: 'AND',
        children: [
          { field: 'priority', operator: 'is', value: 'P1' },
          { field: 'impact', operator: 'is', value: 'HIGH' },
        ],
      };
      expect(
        evaluateConditionTree(tree, { priority: 'P1', impact: 'HIGH' }),
      ).toBe(true);
    });

    it('should not match when any child does not match', () => {
      const tree: SlaConditionNode = {
        operator: 'AND',
        children: [
          { field: 'priority', operator: 'is', value: 'P1' },
          { field: 'impact', operator: 'is', value: 'HIGH' },
        ],
      };
      expect(
        evaluateConditionTree(tree, { priority: 'P1', impact: 'LOW' }),
      ).toBe(false);
    });

    it('empty AND group should match everything', () => {
      const tree: SlaConditionNode = {
        operator: 'AND',
        children: [],
      };
      expect(evaluateConditionTree(tree, { priority: 'P1' })).toBe(true);
    });
  });

  describe('OR groups', () => {
    it('should match when any child matches', () => {
      const tree: SlaConditionNode = {
        operator: 'OR',
        children: [
          { field: 'priority', operator: 'is', value: 'P1' },
          { field: 'priority', operator: 'is', value: 'P2' },
        ],
      };
      expect(evaluateConditionTree(tree, { priority: 'P2' })).toBe(true);
    });

    it('should not match when no children match', () => {
      const tree: SlaConditionNode = {
        operator: 'OR',
        children: [
          { field: 'priority', operator: 'is', value: 'P1' },
          { field: 'priority', operator: 'is', value: 'P2' },
        ],
      };
      expect(evaluateConditionTree(tree, { priority: 'P3' })).toBe(false);
    });
  });

  describe('nested groups', () => {
    it('should evaluate nested AND/OR correctly', () => {
      // (priority=P1 OR priority=P2) AND impact=HIGH
      const tree: SlaConditionNode = {
        operator: 'AND',
        children: [
          {
            operator: 'OR',
            children: [
              { field: 'priority', operator: 'is', value: 'P1' },
              { field: 'priority', operator: 'is', value: 'P2' },
            ],
          },
          { field: 'impact', operator: 'is', value: 'HIGH' },
        ],
      };

      expect(
        evaluateConditionTree(tree, { priority: 'P1', impact: 'HIGH' }),
      ).toBe(true);
      expect(
        evaluateConditionTree(tree, { priority: 'P2', impact: 'HIGH' }),
      ).toBe(true);
      expect(
        evaluateConditionTree(tree, { priority: 'P3', impact: 'HIGH' }),
      ).toBe(false);
      expect(
        evaluateConditionTree(tree, { priority: 'P1', impact: 'LOW' }),
      ).toBe(false);
    });
  });
});
