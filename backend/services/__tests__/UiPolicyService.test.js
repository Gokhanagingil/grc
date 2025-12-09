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

  describe('getApplicableActions', () => {
    const mockFormData = {
      status: 'closed',
      severity: 'High'
    };

    const mockContext = {
      user: { id: 1, role: 'user' }
    };

    it('should return aggregated actions object', async () => {
      const result = await UiPolicyService.getApplicableActions('risks', mockFormData, mockContext);
      expect(result).toHaveProperty('hide');
      expect(result).toHaveProperty('show');
      expect(result).toHaveProperty('readonly');
      expect(result).toHaveProperty('editable');
      expect(result).toHaveProperty('mandatory');
      expect(result).toHaveProperty('optional');
      expect(result).toHaveProperty('disable');
    });

    it('should return arrays for each action type', async () => {
      const result = await UiPolicyService.getApplicableActions('risks', mockFormData, mockContext);
      expect(Array.isArray(result.hide)).toBe(true);
      expect(Array.isArray(result.readonly)).toBe(true);
      expect(Array.isArray(result.mandatory)).toBe(true);
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
      expect(result.errors).toContain('Policy name is required');
    });

    it('should reject policy without table_name', () => {
      const policy = {
        name: 'Test Policy',
        condition: { field: 'status', operator: 'equals', value: 'open' },
        actions: [{ type: 'hide', fields: ['internal_notes'] }]
      };
      const result = UiPolicyService.validatePolicy(policy);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Table name is required');
    });

    it('should reject policy without actions', () => {
      const policy = {
        name: 'Test Policy',
        table_name: 'risks',
        condition: { field: 'status', operator: 'equals', value: 'open' }
      };
      const result = UiPolicyService.validatePolicy(policy);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one action is required');
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

  describe('getPolicies', () => {
    it('should return array of policies for a table', async () => {
      const result = await UiPolicyService.getPolicies('risks');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
