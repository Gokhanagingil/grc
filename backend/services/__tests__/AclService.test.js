/**
 * AclService Unit Tests
 * 
 * Tests for Access Control List evaluation including:
 * - Permission checking
 * - Record-level ACL
 * - Field-level ACL
 * - Condition evaluation
 */

const AclService = require('../AclService');

describe('AclService', () => {
  describe('evaluateCondition', () => {
    const mockUser = {
      id: 1,
      role: 'user',
      department: 'IT'
    };

    const mockRecord = {
      id: 1,
      created_by: 1,
      owner_id: 1,
      status: 'open',
      department: 'IT'
    };

    it('should return true for owner_id condition when user is owner', () => {
      const condition = { owner_id: '{{user.id}}' };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return false for owner_id condition when user is not owner', () => {
      const condition = { owner_id: '{{user.id}}' };
      const otherUser = { ...mockUser, id: 2 };
      const result = AclService.evaluateCondition(condition, otherUser, mockRecord);
      expect(result).toBe(false);
    });

    it('should return true for created_by condition when user is creator', () => {
      const condition = { created_by: '{{user.id}}' };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return false for created_by condition when user is not creator', () => {
      const condition = { created_by: '{{user.id}}' };
      const otherUser = { ...mockUser, id: 2 };
      const result = AclService.evaluateCondition(condition, otherUser, mockRecord);
      expect(result).toBe(false);
    });

    it('should return true for role-based condition when user has matching role', () => {
      const condition = { role: ['user', 'manager'] };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return false for role-based condition when user does not have matching role', () => {
      const condition = { role: ['admin'] };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(false);
    });

    it('should return true for single role condition when user has matching role', () => {
      const condition = { role: 'user' };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return true for field-based condition when field matches', () => {
      const condition = { type: 'field', field: 'status', operator: 'equals', value: 'open' };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return false for field-based condition when field does not match', () => {
      const condition = { type: 'field', field: 'status', operator: 'equals', value: 'closed' };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(false);
    });

    it('should return true for department condition when department matches', () => {
      const condition = { department: 'IT' };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return false for department condition when department does not match', () => {
      const condition = { department: 'HR' };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(false);
    });

    it('should return true for user_id condition when user id matches', () => {
      const condition = { user_id: 1 };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return true for user_id array condition when user id is in array', () => {
      const condition = { user_id: [1, 2, 3] };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return true for null condition (default allow)', () => {
      const result = AclService.evaluateCondition(null, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return true for empty condition (default allow)', () => {
      const result = AclService.evaluateCondition({}, mockUser, mockRecord);
      expect(result).toBe(true);
    });
  });

  describe('evaluateFieldCondition', () => {
    const mockRecord = {
      status: 'open',
      severity: 'High',
      risk_score: 50
    };

    it('should evaluate contains operator correctly', () => {
      const condition = { type: 'field', field: 'status', operator: 'contains', value: 'op' };
      const result = AclService.evaluateCondition(condition, {}, mockRecord);
      expect(result).toBe(true);
    });

    it('should evaluate greater_than operator correctly', () => {
      const condition = { type: 'field', field: 'risk_score', operator: 'greater_than', value: 40 };
      const result = AclService.evaluateCondition(condition, {}, mockRecord);
      expect(result).toBe(true);
    });

    it('should evaluate less_than operator correctly', () => {
      const condition = { type: 'field', field: 'risk_score', operator: 'less_than', value: 60 };
      const result = AclService.evaluateCondition(condition, {}, mockRecord);
      expect(result).toBe(true);
    });

    it('should evaluate in operator correctly', () => {
      const condition = { type: 'field', field: 'severity', operator: 'in', value: ['High', 'Critical'] };
      const result = AclService.evaluateCondition(condition, {}, mockRecord);
      expect(result).toBe(true);
    });
  });
});
