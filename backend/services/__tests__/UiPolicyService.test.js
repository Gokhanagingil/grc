/**
 * UiPolicyService Unit Tests
 * 
 * Tests for UI Policy functionality including:
 * - Condition evaluation
 * - Action aggregation
 * - Policy validation
 */

const UiPolicyService = require('../UiPolicyService');

describe('UiPolicyService', () => {
  describe('evaluateCondition', () => {
    const mockFormData = {
      status: 'open',
      severity: 'High',
      category: 'Security',
      owner_id: 1
    };

    const mockContext = {
      user: { id: 1, role: 'user' }
    };

    it('should return true for always true condition', () => {
      const condition = { always: true };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate field equals condition correctly', () => {
      const condition = { field: 'status', operator: 'equals', value: 'open' };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate field not_equals condition correctly', () => {
      const condition = { field: 'status', operator: 'not_equals', value: 'closed' };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate field in condition correctly', () => {
      const condition = { field: 'severity', operator: 'in', value: ['High', 'Critical'] };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate field is_empty condition correctly', () => {
      const condition = { field: 'notes', operator: 'is_empty' };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate field is_not_empty condition correctly', () => {
      const condition = { field: 'status', operator: 'is_not_empty' };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate role-based condition correctly', () => {
      const condition = { role: 'user' };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate role array condition correctly', () => {
      const condition = { role: ['user', 'manager'] };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate AND conditions correctly', () => {
      const condition = {
        and: [
          { field: 'status', operator: 'equals', value: 'open' },
          { field: 'severity', operator: 'equals', value: 'High' }
        ]
      };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate OR conditions correctly', () => {
      const condition = {
        or: [
          { field: 'status', operator: 'equals', value: 'closed' },
          { field: 'severity', operator: 'equals', value: 'High' }
        ]
      };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate NOT conditions correctly', () => {
      const condition = {
        not: { field: 'status', operator: 'equals', value: 'closed' }
      };
      const result = UiPolicyService.evaluateCondition(condition, mockFormData, mockContext);
      expect(result).toBe(true);
    });

    it('should return false for null condition', () => {
      const result = UiPolicyService.evaluateCondition(null, mockFormData, mockContext);
      expect(result).toBe(false);
    });
  });

  describe('parseJson', () => {
    it('should return null for null input', () => {
      const result = UiPolicyService.parseJson(null);
      expect(result).toBeNull();
    });

    it('should return object as-is if already an object', () => {
      const obj = { key: 'value' };
      const result = UiPolicyService.parseJson(obj);
      expect(result).toEqual(obj);
    });

    it('should parse valid JSON string', () => {
      const result = UiPolicyService.parseJson('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null for invalid JSON string', () => {
      const result = UiPolicyService.parseJson('invalid json');
      expect(result).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear policy cache', () => {
      UiPolicyService.clearCache();
      expect(UiPolicyService.policyCache.size).toBe(0);
    });
  });

  describe('validatePolicy', () => {
    it('should validate a correct policy', () => {
      const policy = {
        name: 'Test Policy',
        table_name: 'risks',
        condition: { field: 'status', operator: 'equals', value: 'open' },
        actions: [{ type: 'hide', fields: ['internal_notes'] }]
      };
      const result = UiPolicyService.validatePolicy(policy);
      expect(result.valid).toBe(true);
    });

    it('should reject policy without name', () => {
      const policy = {
        table_name: 'risks',
        condition: { field: 'status', operator: 'equals', value: 'open' },
        actions: [{ type: 'hide', fields: ['internal_notes'] }]
      };
      const result = UiPolicyService.validatePolicy(policy);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Policy name is required and must be a string');
    });

    it('should reject policy without table_name', () => {
      const policy = {
        name: 'Test Policy',
        condition: { field: 'status', operator: 'equals', value: 'open' },
        actions: [{ type: 'hide', fields: ['internal_notes'] }]
      };
      const result = UiPolicyService.validatePolicy(policy);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Table name is required and must be a string');
    });

    it('should reject policy without actions', () => {
      const policy = {
        name: 'Test Policy',
        table_name: 'risks',
        condition: { field: 'status', operator: 'equals', value: 'open' }
      };
      const result = UiPolicyService.validatePolicy(policy);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Actions must be a non-empty array');
    });

    it('should reject policy with invalid action type', () => {
      const policy = {
        name: 'Test Policy',
        table_name: 'risks',
        condition: { field: 'status', operator: 'equals', value: 'open' },
        actions: [{ type: 'invalid_action', fields: ['field1'] }]
      };
      const result = UiPolicyService.validatePolicy(policy);
      expect(result.valid).toBe(false);
    });
  });

});
