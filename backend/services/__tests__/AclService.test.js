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

    it('should return true for owner-based condition when user is owner', () => {
      const condition = { type: 'owner', field: 'created_by' };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return false for owner-based condition when user is not owner', () => {
      const condition = { type: 'owner', field: 'created_by' };
      const otherUser = { ...mockUser, id: 2 };
      const result = AclService.evaluateCondition(condition, otherUser, mockRecord);
      expect(result).toBe(false);
    });

    it('should return true for role-based condition when user has matching role', () => {
      const condition = { type: 'role', roles: ['user', 'manager'] };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return false for role-based condition when user does not have matching role', () => {
      const condition = { type: 'role', roles: ['admin'] };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(false);
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

    it('should handle AND conditions correctly', () => {
      const condition = {
        and: [
          { type: 'owner', field: 'created_by' },
          { type: 'field', field: 'status', operator: 'equals', value: 'open' }
        ]
      };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should handle OR conditions correctly', () => {
      const condition = {
        or: [
          { type: 'role', roles: ['admin'] },
          { type: 'owner', field: 'created_by' }
        ]
      };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should handle NOT conditions correctly', () => {
      const condition = {
        not: { type: 'role', roles: ['admin'] }
      };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return true for always true condition', () => {
      const condition = { always: true };
      const result = AclService.evaluateCondition(condition, mockUser, mockRecord);
      expect(result).toBe(true);
    });

    it('should return false for null condition', () => {
      const result = AclService.evaluateCondition(null, mockUser, mockRecord);
      expect(result).toBe(false);
    });
  });

  describe('can', () => {
    const adminUser = { id: 1, role: 'admin' };
    const regularUser = { id: 2, role: 'user' };

    it('should allow admin users to perform any action', async () => {
      const result = await AclService.can(adminUser, 'read', 'risks');
      expect(result.allowed).toBe(true);
    });

    it('should check permissions for non-admin users', async () => {
      const result = await AclService.can(regularUser, 'read', 'risks');
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('deniedFields');
      expect(result).toHaveProperty('maskedFields');
    });
  });

  describe('filterRecords', () => {
    const adminUser = { id: 1, role: 'admin' };
    const regularUser = { id: 2, role: 'user' };

    const mockRecords = [
      { id: 1, title: 'Risk 1', created_by: 1, confidential_notes: 'Secret' },
      { id: 2, title: 'Risk 2', created_by: 2, confidential_notes: 'Secret' },
      { id: 3, title: 'Risk 3', created_by: 3, confidential_notes: 'Secret' }
    ];

    it('should return all records for admin users', async () => {
      const result = await AclService.filterRecords(adminUser, 'risks', mockRecords);
      expect(result.length).toBe(3);
    });

    it('should filter records based on ACL rules for non-admin users', async () => {
      const result = await AclService.filterRecords(regularUser, 'risks', mockRecords);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
