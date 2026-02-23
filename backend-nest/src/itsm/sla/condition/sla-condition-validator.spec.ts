import { validateConditionTree } from './sla-condition-validator';

describe('SlaConditionValidator', () => {
  describe('null / empty tree', () => {
    it('should accept null tree', () => {
      const result = validateConditionTree(null);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept undefined tree', () => {
      const result = validateConditionTree(undefined);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object tree', () => {
      const result = validateConditionTree('invalid' as unknown);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('group validation', () => {
    it('should accept valid AND group', () => {
      const result = validateConditionTree({
        operator: 'AND',
        children: [
          { field: 'priority', operator: 'is', value: 'P1' },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('should accept valid OR group', () => {
      const result = validateConditionTree({
        operator: 'OR',
        children: [
          { field: 'priority', operator: 'is', value: 'P1' },
          { field: 'priority', operator: 'is', value: 'P2' },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('should accept empty children (matches everything)', () => {
      const result = validateConditionTree({
        operator: 'AND',
        children: [],
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid group operator', () => {
      const result = validateConditionTree({
        operator: 'XOR',
        children: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('AND');
    });

    it('should reject non-array children', () => {
      const result = validateConditionTree({
        operator: 'AND',
        children: 'bad',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('leaf validation', () => {
    it('should accept valid leaf with registered field + operator', () => {
      const result = validateConditionTree({
        field: 'priority',
        operator: 'is',
        value: 'P1',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject missing field', () => {
      const result = validateConditionTree({
        operator: 'is',
        value: 'P1',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('field');
    });

    it('should reject missing operator on leaf', () => {
      const result = validateConditionTree({
        field: 'priority',
        value: 'P1',
      });
      expect(result.valid).toBe(false);
    });

    it('should reject unknown field', () => {
      const result = validateConditionTree({
        field: 'nonExistentField',
        operator: 'is',
        value: 'test',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Unknown condition field');
    });

    it('should reject unknown operator', () => {
      const result = validateConditionTree({
        field: 'priority',
        operator: 'matches_regex',
        value: '.*',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Unknown operator');
    });

    it('should reject operator not allowed for field', () => {
      // priority is an enum field, gt is not allowed for enums
      const result = validateConditionTree({
        field: 'priority',
        operator: 'gt',
        value: 'P1',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('not allowed');
    });

    it('should accept unary operators without value', () => {
      const result = validateConditionTree({
        field: 'assignmentGroup',
        operator: 'is_empty',
      });
      expect(result.valid).toBe(true);
    });

    it('should require value for non-unary operators', () => {
      const result = validateConditionTree({
        field: 'priority',
        operator: 'is',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Value is required');
    });

    it('should require array value for in operator', () => {
      const result = validateConditionTree({
        field: 'priority',
        operator: 'in',
        value: 'P1',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('array');
    });

    it('should accept array value for in operator', () => {
      const result = validateConditionTree({
        field: 'priority',
        operator: 'in',
        value: ['P1', 'P2'],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('nested validation', () => {
    it('should validate deeply nested structure', () => {
      const result = validateConditionTree({
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
      });
      expect(result.valid).toBe(true);
    });

    it('should collect errors from nested nodes', () => {
      const result = validateConditionTree({
        operator: 'AND',
        children: [
          { field: 'unknownField1', operator: 'is', value: 'x' },
          {
            operator: 'OR',
            children: [
              { field: 'unknownField2', operator: 'is', value: 'y' },
            ],
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });

  describe('record type filtering', () => {
    it('should pass for INCIDENT fields with INCIDENT record type', () => {
      const result = validateConditionTree(
        { field: 'priority', operator: 'is', value: 'P1' },
        'INCIDENT',
      );
      expect(result.valid).toBe(true);
    });
  });
});
