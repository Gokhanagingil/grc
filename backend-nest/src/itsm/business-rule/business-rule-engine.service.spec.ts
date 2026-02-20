import { BusinessRuleEngineService } from './business-rule-engine.service';
import { BusinessRule, BusinessRuleTrigger } from './business-rule.entity';

const makeRule = (overrides: Partial<BusinessRule> = {}): BusinessRule =>
  ({
    id: 'rule-1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    name: 'Test Rule',
    description: null,
    tableName: 'itsm_incidents',
    trigger: BusinessRuleTrigger.BEFORE_UPDATE,
    conditions: null,
    actions: [],
    isActive: true,
    order: 100,
    stopProcessing: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    tenant: {} as never,
    ...overrides,
  }) as BusinessRule;

describe('BusinessRuleEngineService', () => {
  let service: BusinessRuleEngineService;

  beforeEach(() => {
    service = new BusinessRuleEngineService();
  });

  describe('evaluateRules', () => {
    it('should skip inactive rules', () => {
      const rules = [
        makeRule({
          isActive: false,
          actions: [{ type: 'set_field', field: 'priority', value: 'p1' }],
        }),
      ];
      const results = service.evaluateRules(rules, { status: 'open' });
      expect(results).toHaveLength(0);
    });

    it('should apply rule with no conditions', () => {
      const rules = [
        makeRule({
          actions: [
            {
              type: 'set_field',
              field: 'assignmentGroup',
              value: 'IT Support',
            },
          ],
        }),
      ];
      const results = service.evaluateRules(rules, { status: 'open' });
      expect(results).toHaveLength(1);
      expect(results[0].applied).toBe(true);
      expect(results[0].fieldUpdates).toEqual({
        assignmentGroup: 'IT Support',
      });
    });

    it('should apply rule when conditions match', () => {
      const rules = [
        makeRule({
          conditions: [{ field: 'priority', operator: 'eq', value: 'p1' }],
          actions: [
            {
              type: 'set_field',
              field: 'assignmentGroup',
              value: 'Critical Team',
            },
          ],
        }),
      ];
      const results = service.evaluateRules(rules, { priority: 'p1' });
      expect(results[0].applied).toBe(true);
      expect(results[0].fieldUpdates).toEqual({
        assignmentGroup: 'Critical Team',
      });
    });

    it('should not apply rule when conditions do not match', () => {
      const rules = [
        makeRule({
          conditions: [{ field: 'priority', operator: 'eq', value: 'p1' }],
          actions: [
            {
              type: 'set_field',
              field: 'assignmentGroup',
              value: 'Critical Team',
            },
          ],
        }),
      ];
      const results = service.evaluateRules(rules, { priority: 'p4' });
      expect(results[0].applied).toBe(false);
    });

    it('should execute rules in order', () => {
      const rules = [
        makeRule({
          name: 'Rule B',
          order: 200,
          actions: [
            { type: 'set_field', field: 'category', value: 'software' },
          ],
        }),
        makeRule({
          name: 'Rule A',
          order: 100,
          actions: [
            {
              type: 'set_field',
              field: 'assignmentGroup',
              value: 'IT Support',
            },
          ],
        }),
      ];
      const results = service.evaluateRules(rules, {});
      expect(results[0].ruleName).toBe('Rule A');
      expect(results[1].ruleName).toBe('Rule B');
    });

    it('should stop on reject action', () => {
      const rules = [
        makeRule({
          name: 'Reject Rule',
          order: 100,
          conditions: [{ field: 'status', operator: 'eq', value: 'closed' }],
          actions: [
            { type: 'reject', message: 'Cannot modify closed records' },
          ],
        }),
        makeRule({
          name: 'Set Field Rule',
          order: 200,
          actions: [
            { type: 'set_field', field: 'assignmentGroup', value: 'IT' },
          ],
        }),
      ];
      const results = service.evaluateRules(rules, { status: 'closed' });
      expect(results).toHaveLength(1);
      expect(results[0].rejected).toBe(true);
      expect(results[0].rejectMessage).toBe('Cannot modify closed records');
    });
  });

  describe('applyBeforeRules', () => {
    it('should aggregate field updates from multiple rules', () => {
      const rules = [
        makeRule({
          name: 'Rule 1',
          order: 100,
          actions: [
            {
              type: 'set_field',
              field: 'assignmentGroup',
              value: 'IT Support',
            },
          ],
        }),
        makeRule({
          name: 'Rule 2',
          order: 200,
          actions: [
            { type: 'set_field', field: 'category', value: 'software' },
          ],
        }),
      ];
      const result = service.applyBeforeRules(rules, {});
      expect(result.rejected).toBe(false);
      expect(result.fieldUpdates).toEqual({
        assignmentGroup: 'IT Support',
        category: 'software',
      });
    });

    it('should return rejected with message', () => {
      const rules = [
        makeRule({
          actions: [{ type: 'reject', message: 'Not allowed' }],
        }),
      ];
      const result = service.applyBeforeRules(rules, {});
      expect(result.rejected).toBe(true);
      expect(result.rejectMessage).toBe('Not allowed');
    });

    it('should handle changed operator', () => {
      const rules = [
        makeRule({
          conditions: [{ field: 'status', operator: 'changed' }],
          actions: [{ type: 'set_field', field: 'updatedFlag', value: 'true' }],
        }),
      ];
      const resultWithChange = service.applyBeforeRules(
        rules,
        { status: 'in_progress' },
        { status: 'in_progress' },
      );
      expect(resultWithChange.fieldUpdates).toEqual({ updatedFlag: 'true' });

      const resultWithoutChange = service.applyBeforeRules(
        rules,
        { status: 'open' },
        undefined,
      );
      expect(resultWithoutChange.fieldUpdates).toEqual({});
    });
  });

  describe('condition operators', () => {
    it('should evaluate in operator correctly', () => {
      const rules = [
        makeRule({
          conditions: [
            { field: 'priority', operator: 'in', value: ['p1', 'p2'] },
          ],
          actions: [{ type: 'set_field', field: 'flag', value: 'high' }],
        }),
      ];
      expect(service.evaluateRules(rules, { priority: 'p1' })[0].applied).toBe(
        true,
      );
      expect(service.evaluateRules(rules, { priority: 'p4' })[0].applied).toBe(
        false,
      );
    });

    it('should evaluate not_in operator correctly', () => {
      const rules = [
        makeRule({
          conditions: [
            {
              field: 'status',
              operator: 'not_in',
              value: ['closed', 'resolved'],
            },
          ],
          actions: [{ type: 'set_field', field: 'flag', value: 'active' }],
        }),
      ];
      expect(service.evaluateRules(rules, { status: 'open' })[0].applied).toBe(
        true,
      );
      expect(
        service.evaluateRules(rules, { status: 'closed' })[0].applied,
      ).toBe(false);
    });

    it('should evaluate is_set and is_empty operators', () => {
      const rulesIsSet = [
        makeRule({
          conditions: [{ field: 'assignee', operator: 'is_set' }],
          actions: [{ type: 'set_field', field: 'flag', value: 'assigned' }],
        }),
      ];
      expect(
        service.evaluateRules(rulesIsSet, { assignee: 'user-1' })[0].applied,
      ).toBe(true);
      expect(
        service.evaluateRules(rulesIsSet, { assignee: null })[0].applied,
      ).toBe(false);

      const rulesIsEmpty = [
        makeRule({
          conditions: [{ field: 'assignee', operator: 'is_empty' }],
          actions: [{ type: 'set_field', field: 'flag', value: 'unassigned' }],
        }),
      ];
      expect(
        service.evaluateRules(rulesIsEmpty, { assignee: null })[0].applied,
      ).toBe(true);
      expect(
        service.evaluateRules(rulesIsEmpty, { assignee: '' })[0].applied,
      ).toBe(true);
    });
  });

  describe('stopProcessing', () => {
    it('should stop evaluating subsequent rules when stopProcessing is true', () => {
      const rules = [
        makeRule({
          name: 'Rule 1 - Stop',
          order: 100,
          stopProcessing: true,
          actions: [
            { type: 'set_field', field: 'category', value: 'hardware' },
          ],
        }),
        makeRule({
          name: 'Rule 2 - Should Not Run',
          order: 200,
          actions: [
            { type: 'set_field', field: 'priority', value: 'p1' },
          ],
        }),
      ];
      const results = service.evaluateRules(rules, {});
      expect(results).toHaveLength(1);
      expect(results[0].ruleName).toBe('Rule 1 - Stop');
      expect(results[0].applied).toBe(true);
      expect(results[0].fieldUpdates).toEqual({ category: 'hardware' });
    });

    it('should continue evaluating when stopProcessing is false', () => {
      const rules = [
        makeRule({
          name: 'Rule 1',
          order: 100,
          stopProcessing: false,
          actions: [
            { type: 'set_field', field: 'category', value: 'hardware' },
          ],
        }),
        makeRule({
          name: 'Rule 2',
          order: 200,
          stopProcessing: false,
          actions: [
            { type: 'set_field', field: 'priority', value: 'p1' },
          ],
        }),
      ];
      const results = service.evaluateRules(rules, {});
      expect(results).toHaveLength(2);
      expect(results[0].ruleName).toBe('Rule 1');
      expect(results[1].ruleName).toBe('Rule 2');
    });

    it('should not stop when stopProcessing rule conditions do not match', () => {
      const rules = [
        makeRule({
          name: 'Stop Rule',
          order: 100,
          stopProcessing: true,
          conditions: [{ field: 'priority', operator: 'eq', value: 'p1' }],
          actions: [
            { type: 'set_field', field: 'flag', value: 'stopped' },
          ],
        }),
        makeRule({
          name: 'Next Rule',
          order: 200,
          actions: [
            { type: 'set_field', field: 'category', value: 'software' },
          ],
        }),
      ];
      const results = service.evaluateRules(rules, { priority: 'p4' });
      expect(results).toHaveLength(2);
      expect(results[0].applied).toBe(false);
      expect(results[1].applied).toBe(true);
    });

    it('should respect stopProcessing with applyBeforeRules', () => {
      const rules = [
        makeRule({
          name: 'Rule 1',
          order: 100,
          stopProcessing: true,
          actions: [
            { type: 'set_field', field: 'assignmentGroup', value: 'Team A' },
          ],
        }),
        makeRule({
          name: 'Rule 2',
          order: 200,
          actions: [
            { type: 'set_field', field: 'assignmentGroup', value: 'Team B' },
          ],
        }),
      ];
      const result = service.applyBeforeRules(rules, {});
      expect(result.rejected).toBe(false);
      expect(result.fieldUpdates).toEqual({ assignmentGroup: 'Team A' });
    });
  });

  describe('field-change detection', () => {
    it('should fire rule only when specific field changed', () => {
      const rules = [
        makeRule({
          conditions: [{ field: 'state', operator: 'changed' }],
          actions: [
            { type: 'set_field', field: 'stateChangedFlag', value: 'true' },
          ],
        }),
      ];
      const withChange = service.evaluateRules(
        rules,
        { state: 'resolved' },
        { state: 'resolved' },
      );
      expect(withChange[0].applied).toBe(true);

      const withoutChange = service.evaluateRules(
        rules,
        { state: 'open' },
        { priority: 'p2' },
      );
      expect(withoutChange[0].applied).toBe(false);

      const noChanges = service.evaluateRules(
        rules,
        { state: 'open' },
        undefined,
      );
      expect(noChanges[0].applied).toBe(false);
    });

    it('should combine changed with other conditions', () => {
      const rules = [
        makeRule({
          conditions: [
            { field: 'state', operator: 'changed' },
            { field: 'priority', operator: 'eq', value: 'p1' },
          ],
          actions: [
            { type: 'set_field', field: 'escalated', value: 'true' },
          ],
        }),
      ];
      const both = service.evaluateRules(
        rules,
        { state: 'resolved', priority: 'p1' },
        { state: 'resolved' },
      );
      expect(both[0].applied).toBe(true);

      const onlyChanged = service.evaluateRules(
        rules,
        { state: 'resolved', priority: 'p4' },
        { state: 'resolved' },
      );
      expect(onlyChanged[0].applied).toBe(false);
    });
  });

  describe('trigger semantics', () => {
    it('should support all four trigger types', () => {
      const triggers = [
        BusinessRuleTrigger.BEFORE_INSERT,
        BusinessRuleTrigger.AFTER_INSERT,
        BusinessRuleTrigger.BEFORE_UPDATE,
        BusinessRuleTrigger.AFTER_UPDATE,
      ];
      for (const trigger of triggers) {
        const rules = [
          makeRule({
            trigger,
            actions: [
              { type: 'set_field', field: 'flag', value: trigger },
            ],
          }),
        ];
        const results = service.evaluateRules(rules, {});
        expect(results[0].applied).toBe(true);
        expect(results[0].fieldUpdates).toEqual({ flag: trigger });
      }
    });
  });

  describe('ordering + stopProcessing combined', () => {
    it('should execute in order and stop at the correct rule', () => {
      const rules = [
        makeRule({
          name: 'Rule C',
          order: 300,
          actions: [
            { type: 'set_field', field: 'c', value: 'yes' },
          ],
        }),
        makeRule({
          name: 'Rule A',
          order: 100,
          actions: [
            { type: 'set_field', field: 'a', value: 'yes' },
          ],
        }),
        makeRule({
          name: 'Rule B',
          order: 200,
          stopProcessing: true,
          actions: [
            { type: 'set_field', field: 'b', value: 'yes' },
          ],
        }),
      ];
      const results = service.evaluateRules(rules, {});
      expect(results).toHaveLength(2);
      expect(results[0].ruleName).toBe('Rule A');
      expect(results[1].ruleName).toBe('Rule B');
    });
  });
});
