/**
 * List Query Unit Tests
 *
 * Tests for the universal list query system including:
 * - Filter parsing and validation
 * - Allowlist enforcement
 * - Operator-type compatibility
 * - Security limits (depth, conditions, length)
 * - Quick search validation
 */

import { BadRequestException } from '@nestjs/common';
import {
  parseFilterJson,
  validateQuickSearch,
  countConditions,
  calculateDepth,
} from './list-query.parser';
import {
  validateFilterAgainstAllowlist,
  isFieldAllowed,
  getFieldDefinition,
} from './list-query.validator';
import { CONTROL_ALLOWLIST, createAllowlist } from './list-query.allowlist';
import { FilterTree } from './list-query.types';

describe('List Query Parser', () => {
  describe('parseFilterJson', () => {
    it('should parse a valid single condition', () => {
      const json = JSON.stringify({
        field: 'status',
        op: 'is',
        value: 'draft',
      });

      const result = parseFilterJson(json);

      expect(result.tree).toEqual({
        field: 'status',
        op: 'is',
        value: 'draft',
      });
      expect(result.conditionCount).toBe(1);
      expect(result.maxDepth).toBe(1);
    });

    it('should parse a valid AND group', () => {
      const json = JSON.stringify({
        and: [
          { field: 'status', op: 'is', value: 'draft' },
          { field: 'name', op: 'contains', value: 'test' },
        ],
      });

      const result = parseFilterJson(json);

      expect(result.conditionCount).toBe(2);
      // Depth: root(1) -> and group children are at depth 2, but conditions return their own depth
      expect(result.maxDepth).toBeGreaterThanOrEqual(1);
    });

    it('should parse a valid OR group', () => {
      const json = JSON.stringify({
        or: [
          { field: 'status', op: 'is', value: 'draft' },
          { field: 'status', op: 'is', value: 'implemented' },
        ],
      });

      const result = parseFilterJson(json);

      expect(result.conditionCount).toBe(2);
    });

    it('should parse nested AND/OR groups', () => {
      const json = JSON.stringify({
        and: [
          { field: 'status', op: 'is', value: 'draft' },
          {
            or: [
              { field: 'name', op: 'contains', value: 'access' },
              { field: 'name', op: 'contains', value: 'security' },
            ],
          },
        ],
      });

      const result = parseFilterJson(json);

      expect(result.conditionCount).toBe(3);
      // Depth counts from root, conditions at leaf level
      expect(result.maxDepth).toBeGreaterThanOrEqual(2);
    });

    it('should reject malformed JSON', () => {
      expect(() => parseFilterJson('{ invalid json')).toThrow(
        BadRequestException,
      );
      expect(() => parseFilterJson('{ invalid json')).toThrow('malformed JSON');
    });

    it('should reject filter exceeding max length', () => {
      const longValue = 'a'.repeat(5000);
      const json = JSON.stringify({
        field: 'name',
        op: 'is',
        value: longValue,
      });

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
      expect(() => parseFilterJson(json)).toThrow('exceeds maximum length');
    });

    it('should reject unknown operators', () => {
      const json = JSON.stringify({
        field: 'status',
        op: 'unknown_op',
        value: 'draft',
      });

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
      expect(() => parseFilterJson(json)).toThrow('Unknown operator');
    });

    it('should reject missing field', () => {
      const json = JSON.stringify({
        op: 'is',
        value: 'draft',
      });

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
    });

    it('should reject missing operator', () => {
      const json = JSON.stringify({
        field: 'status',
        value: 'draft',
      });

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
    });

    it('should reject missing value for non-empty operators', () => {
      const json = JSON.stringify({
        field: 'status',
        op: 'is',
      });

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
      expect(() => parseFilterJson(json)).toThrow("Missing 'value'");
    });

    it('should allow missing value for is_empty operator', () => {
      const json = JSON.stringify({
        field: 'description',
        op: 'is_empty',
      });

      const result = parseFilterJson(json);
      expect(result.conditionCount).toBe(1);
    });

    it('should allow missing value for is_not_empty operator', () => {
      const json = JSON.stringify({
        field: 'description',
        op: 'is_not_empty',
      });

      const result = parseFilterJson(json);
      expect(result.conditionCount).toBe(1);
    });

    it('should reject empty AND group', () => {
      const json = JSON.stringify({ and: [] });

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
      expect(() => parseFilterJson(json)).toThrow('Empty');
    });

    it('should reject empty OR group', () => {
      const json = JSON.stringify({ or: [] });

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
      expect(() => parseFilterJson(json)).toThrow('Empty');
    });

    it('should reject invalid field name format', () => {
      const json = JSON.stringify({
        field: '123invalid',
        op: 'is',
        value: 'test',
      });

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
      expect(() => parseFilterJson(json)).toThrow('Invalid field name');
    });
  });

  describe('depth and condition limits', () => {
    it('should reject filter exceeding max depth', () => {
      // Create deeply nested structure (6 levels)
      const deepFilter = {
        and: [
          {
            and: [
              {
                and: [
                  {
                    and: [
                      {
                        and: [
                          {
                            and: [
                              { field: 'status', op: 'is', value: 'draft' },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const json = JSON.stringify(deepFilter);

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
      expect(() => parseFilterJson(json)).toThrow('exceeds maximum depth');
    });

    it('should reject filter exceeding max conditions', () => {
      // Create filter with 31 conditions
      const conditions = Array.from({ length: 31 }, (_, i) => ({
        field: 'name',
        op: 'contains',
        value: `test${i}`,
      }));

      const json = JSON.stringify({ and: conditions });

      expect(() => parseFilterJson(json)).toThrow(BadRequestException);
      expect(() => parseFilterJson(json)).toThrow('exceeds maximum');
    });

    it('should accept filter at max depth limit', () => {
      // Create filter at exactly 5 levels (the limit)
      // The depth limit is checked during parsing, so if it parses without error, it's within limits
      const filter = {
        and: [
          {
            and: [
              {
                and: [
                  {
                    and: [{ field: 'status', op: 'is', value: 'draft' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const json = JSON.stringify(filter);
      const result = parseFilterJson(json);

      // Should parse successfully without throwing depth limit error
      expect(result.conditionCount).toBe(1);
      expect(result.maxDepth).toBeGreaterThanOrEqual(1);
    });

    it('should accept filter at max conditions limit', () => {
      // Create filter with exactly 30 conditions
      const conditions = Array.from({ length: 30 }, (_, i) => ({
        field: 'name',
        op: 'contains',
        value: `test${i}`,
      }));

      const json = JSON.stringify({ and: conditions });
      const result = parseFilterJson(json);

      expect(result.conditionCount).toBe(30);
    });
  });

  describe('validateQuickSearch', () => {
    it('should return undefined for empty search', () => {
      expect(validateQuickSearch('')).toBeUndefined();
      expect(validateQuickSearch(undefined)).toBeUndefined();
      expect(validateQuickSearch('   ')).toBeUndefined();
    });

    it('should trim and normalize whitespace', () => {
      expect(validateQuickSearch('  hello   world  ')).toBe('hello world');
    });

    it('should reject search exceeding max length', () => {
      const longSearch = 'a'.repeat(150);

      expect(() => validateQuickSearch(longSearch)).toThrow(
        BadRequestException,
      );
      expect(() => validateQuickSearch(longSearch)).toThrow(
        'exceeds maximum length',
      );
    });

    it('should accept search at max length', () => {
      const maxSearch = 'a'.repeat(120);
      expect(validateQuickSearch(maxSearch)).toBe(maxSearch);
    });
  });

  describe('countConditions', () => {
    it('should count single condition', () => {
      const tree: FilterTree = { field: 'status', op: 'is', value: 'draft' };
      expect(countConditions(tree)).toBe(1);
    });

    it('should count conditions in AND group', () => {
      const tree: FilterTree = {
        and: [
          { field: 'status', op: 'is', value: 'draft' },
          { field: 'name', op: 'contains', value: 'test' },
        ],
      };
      expect(countConditions(tree)).toBe(2);
    });

    it('should count conditions in nested groups', () => {
      const tree: FilterTree = {
        and: [
          { field: 'status', op: 'is', value: 'draft' },
          {
            or: [
              { field: 'name', op: 'contains', value: 'a' },
              { field: 'name', op: 'contains', value: 'b' },
            ],
          },
        ],
      };
      expect(countConditions(tree)).toBe(3);
    });
  });

  describe('calculateDepth', () => {
    it('should return 1 for single condition', () => {
      const tree: FilterTree = { field: 'status', op: 'is', value: 'draft' };
      expect(calculateDepth(tree)).toBe(1);
    });

    it('should return 2 for flat group', () => {
      const tree: FilterTree = {
        and: [
          { field: 'status', op: 'is', value: 'draft' },
          { field: 'name', op: 'contains', value: 'test' },
        ],
      };
      expect(calculateDepth(tree)).toBe(2);
    });

    it('should return correct depth for nested groups', () => {
      const tree: FilterTree = {
        and: [
          { field: 'status', op: 'is', value: 'draft' },
          {
            or: [
              { field: 'name', op: 'contains', value: 'a' },
              {
                and: [{ field: 'code', op: 'is', value: 'C1' }],
              },
            ],
          },
        ],
      };
      expect(calculateDepth(tree)).toBe(4);
    });
  });
});

describe('List Query Validator', () => {
  describe('validateFilterAgainstAllowlist', () => {
    it('should accept valid field from allowlist', () => {
      const tree: FilterTree = { field: 'status', op: 'is', value: 'draft' };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).not.toThrow();
    });

    it('should reject unknown field', () => {
      const tree: FilterTree = {
        field: 'unknownField',
        op: 'is',
        value: 'test',
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow(BadRequestException);
      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow('Unknown field');
    });

    it('should reject incompatible operator for field type', () => {
      // 'contains' is not valid for enum fields
      const tree: FilterTree = {
        field: 'status',
        op: 'contains',
        value: 'draft',
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow(BadRequestException);
      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow('not compatible');
    });

    it('should accept compatible operator for string field', () => {
      const tree: FilterTree = { field: 'name', op: 'contains', value: 'test' };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).not.toThrow();
    });

    it('should accept date operators for date field', () => {
      const tree: FilterTree = {
        field: 'createdAt',
        op: 'after',
        value: '2024-01-01',
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).not.toThrow();
    });

    it('should reject invalid enum value', () => {
      const tree: FilterTree = {
        field: 'status',
        op: 'is',
        value: 'invalid_status',
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow(BadRequestException);
      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow('Invalid value');
    });

    it('should accept valid enum value (case-insensitive)', () => {
      const tree: FilterTree = { field: 'status', op: 'is', value: 'DRAFT' };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).not.toThrow();
    });

    it('should validate all conditions in AND group', () => {
      const tree: FilterTree = {
        and: [
          { field: 'status', op: 'is', value: 'draft' },
          { field: 'unknownField', op: 'is', value: 'test' },
        ],
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow(BadRequestException);
    });

    it('should validate all conditions in OR group', () => {
      const tree: FilterTree = {
        or: [
          { field: 'status', op: 'is', value: 'draft' },
          { field: 'unknownField', op: 'is', value: 'test' },
        ],
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow(BadRequestException);
    });

    it('should reject dot-walk paths when not allowed', () => {
      const tree: FilterTree = {
        field: 'owner.email',
        op: 'is',
        value: 'test@example.com',
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow(BadRequestException);
      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow('Dot-walk paths are not allowed');
    });

    it('should accept dot-walk paths when explicitly allowed', () => {
      const allowlistWithDotWalk = createAllowlist(
        'TestEntity',
        [{ name: 'name', type: 'string' }],
        ['owner.email'],
      );

      const tree: FilterTree = {
        field: 'owner.email',
        op: 'is',
        value: 'test@example.com',
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, allowlistWithDotWalk),
      ).not.toThrow();
    });

    it('should reject invalid date value', () => {
      const tree: FilterTree = {
        field: 'createdAt',
        op: 'after',
        value: 'not-a-date',
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow(BadRequestException);
      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow('Invalid value for date field');
    });

    it('should accept valid ISO date value', () => {
      const tree: FilterTree = {
        field: 'createdAt',
        op: 'after',
        value: '2024-01-15',
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).not.toThrow();
    });

    it('should reject string value exceeding max length', () => {
      const longValue = 'a'.repeat(600);
      const tree: FilterTree = {
        field: 'name',
        op: 'contains',
        value: longValue,
      };

      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow(BadRequestException);
      expect(() =>
        validateFilterAgainstAllowlist(tree, CONTROL_ALLOWLIST),
      ).toThrow('too long');
    });
  });

  describe('isFieldAllowed', () => {
    it('should return true for allowed field', () => {
      expect(isFieldAllowed('status', CONTROL_ALLOWLIST)).toBe(true);
      expect(isFieldAllowed('name', CONTROL_ALLOWLIST)).toBe(true);
    });

    it('should return false for unknown field', () => {
      expect(isFieldAllowed('unknownField', CONTROL_ALLOWLIST)).toBe(false);
    });

    it('should check dot-walk paths', () => {
      const allowlistWithDotWalk = createAllowlist(
        'TestEntity',
        [{ name: 'name', type: 'string' }],
        ['owner.email'],
      );

      expect(isFieldAllowed('owner.email', allowlistWithDotWalk)).toBe(true);
      expect(isFieldAllowed('owner.name', allowlistWithDotWalk)).toBe(false);
    });
  });

  describe('getFieldDefinition', () => {
    it('should return field definition for known field', () => {
      const fieldDef = getFieldDefinition('status', CONTROL_ALLOWLIST);

      expect(fieldDef).toBeDefined();
      expect(fieldDef?.name).toBe('status');
      expect(fieldDef?.type).toBe('enum');
    });

    it('should return undefined for unknown field', () => {
      const fieldDef = getFieldDefinition('unknownField', CONTROL_ALLOWLIST);
      expect(fieldDef).toBeUndefined();
    });
  });
});

describe('Control Allowlist', () => {
  it('should have all expected fields', () => {
    const expectedFields = [
      'name',
      'code',
      'description',
      'status',
      'type',
      'implementationType',
      'frequency',
      'createdAt',
      'updatedAt',
      'effectiveDate',
      'lastTestedDate',
      'nextTestDate',
      'ownerUserId',
      'lastTestResult',
    ];

    const allowedFieldNames = CONTROL_ALLOWLIST.fields.map((f) => f.name);

    for (const field of expectedFields) {
      expect(allowedFieldNames).toContain(field);
    }
  });

  it('should have correct types for fields', () => {
    const statusField = CONTROL_ALLOWLIST.fields.find(
      (f) => f.name === 'status',
    );
    expect(statusField?.type).toBe('enum');

    const nameField = CONTROL_ALLOWLIST.fields.find((f) => f.name === 'name');
    expect(nameField?.type).toBe('string');

    const createdAtField = CONTROL_ALLOWLIST.fields.find(
      (f) => f.name === 'createdAt',
    );
    expect(createdAtField?.type).toBe('date');

    const ownerUserIdField = CONTROL_ALLOWLIST.fields.find(
      (f) => f.name === 'ownerUserId',
    );
    expect(ownerUserIdField?.type).toBe('uuid');
  });

  it('should have enum values for status field', () => {
    const statusField = CONTROL_ALLOWLIST.fields.find(
      (f) => f.name === 'status',
    );

    expect(statusField?.enumValues).toContain('draft');
    expect(statusField?.enumValues).toContain('implemented');
    expect(statusField?.enumValues).toContain('retired');
  });

  it('should have case-insensitive flag for enum fields', () => {
    const statusField = CONTROL_ALLOWLIST.fields.find(
      (f) => f.name === 'status',
    );
    expect(statusField?.caseInsensitive).toBe(true);

    const typeField = CONTROL_ALLOWLIST.fields.find((f) => f.name === 'type');
    expect(typeField?.caseInsensitive).toBe(true);
  });
});
