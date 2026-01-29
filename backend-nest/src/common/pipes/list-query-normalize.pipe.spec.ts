import { BadRequestException } from '@nestjs/common';
import {
  progressiveFilterDecode,
  normalizeSearchParam,
  normalizeFilterParam,
  normalizeListQuerySort,
} from './list-query-normalize.pipe';

describe('List Query Normalize Pipe', () => {
  describe('progressiveFilterDecode', () => {
    it('should parse valid JSON directly', () => {
      const filter = JSON.stringify({
        field: 'status',
        op: 'is',
        value: 'OPEN',
      });
      const result = progressiveFilterDecode(filter);

      expect(result.success).toBe(true);
      expect(result.decodeAttempts).toBe(0);
      expect(result.parsed).toEqual({
        field: 'status',
        op: 'is',
        value: 'OPEN',
      });
    });

    it('should decode single-encoded filter', () => {
      const filter = { field: 'status', op: 'is', value: 'OPEN' };
      const encoded = encodeURIComponent(JSON.stringify(filter));
      const result = progressiveFilterDecode(encoded);

      expect(result.success).toBe(true);
      expect(result.decodeAttempts).toBe(1);
      expect(result.parsed).toEqual(filter);
    });

    it('should decode double-encoded filter (max 2 attempts)', () => {
      const filter = { field: 'status', op: 'is', value: 'OPEN' };
      const doubleEncoded = encodeURIComponent(
        encodeURIComponent(JSON.stringify(filter)),
      );
      const result = progressiveFilterDecode(doubleEncoded);

      expect(result.success).toBe(true);
      expect(result.decodeAttempts).toBeLessThanOrEqual(2);
      expect(result.parsed).toEqual(filter);
    });

    it('should fail for invalid JSON after max decode attempts', () => {
      const invalidJson = 'not valid json at all';
      const result = progressiveFilterDecode(invalidJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should fail for empty filter string', () => {
      const result = progressiveFilterDecode('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty filter string');
    });

    it('should fail for whitespace-only filter string', () => {
      const result = progressiveFilterDecode('   ');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty filter string');
    });

    it('should handle complex filter tree', () => {
      const filter = {
        and: [
          { field: 'status', op: 'is', value: 'OPEN' },
          { field: 'severity', op: 'is', value: 'HIGH' },
        ],
      };
      const encoded = encodeURIComponent(JSON.stringify(filter));
      const result = progressiveFilterDecode(encoded);

      expect(result.success).toBe(true);
      expect(result.parsed).toEqual(filter);
    });

    it('should handle filter with special characters', () => {
      const filter = { field: 'title', op: 'contains', value: 'test & verify' };
      const encoded = encodeURIComponent(JSON.stringify(filter));
      const result = progressiveFilterDecode(encoded);

      expect(result.success).toBe(true);
      expect(result.parsed).toEqual(filter);
    });
  });

  describe('normalizeSearchParam', () => {
    it('should return undefined for empty search', () => {
      expect(normalizeSearchParam({})).toBeUndefined();
      expect(normalizeSearchParam({ search: '' })).toBeUndefined();
      expect(normalizeSearchParam({ q: '' })).toBeUndefined();
    });

    it('should return undefined for whitespace-only search', () => {
      expect(normalizeSearchParam({ search: '   ' })).toBeUndefined();
      expect(normalizeSearchParam({ q: '   ' })).toBeUndefined();
    });

    it('should prefer search over q', () => {
      expect(normalizeSearchParam({ search: 'hello', q: 'world' })).toBe(
        'hello',
      );
    });

    it('should fall back to q if search is not provided', () => {
      expect(normalizeSearchParam({ q: 'world' })).toBe('world');
    });

    it('should trim search value', () => {
      expect(normalizeSearchParam({ search: '  hello  ' })).toBe('hello');
    });
  });

  describe('normalizeFilterParam', () => {
    it('should return undefined for empty filter', () => {
      expect(normalizeFilterParam({})).toBeUndefined();
      expect(normalizeFilterParam({ filter: '' })).toBeUndefined();
    });

    it('should parse valid JSON filter', () => {
      const filter = { field: 'status', op: 'is', value: 'OPEN' };
      const result = normalizeFilterParam({ filter: JSON.stringify(filter) });

      expect(result).toEqual(filter);
    });

    it('should parse encoded JSON filter', () => {
      const filter = { field: 'status', op: 'is', value: 'OPEN' };
      const encoded = encodeURIComponent(JSON.stringify(filter));
      const result = normalizeFilterParam({ filter: encoded });

      expect(result).toEqual(filter);
    });

    it('should throw BadRequestException for invalid JSON', () => {
      expect(() => normalizeFilterParam({ filter: 'invalid json' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('normalizeListQuerySort', () => {
    it('should parse canonical sort format', () => {
      const result = normalizeListQuerySort(
        { sort: 'createdAt:DESC' },
        'issues',
      );

      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('DESC');
    });

    it('should parse canonical sort format case-insensitively', () => {
      const result = normalizeListQuerySort(
        { sort: 'createdAt:desc' },
        'issues',
      );

      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('DESC');
    });

    it('should use legacy sortBy/sortOrder params', () => {
      const result = normalizeListQuerySort(
        { sortBy: 'title', sortOrder: 'ASC' },
        'issues',
      );

      expect(result.sortBy).toBe('title');
      expect(result.sortOrder).toBe('ASC');
    });

    it('should prefer canonical sort over legacy params', () => {
      const result = normalizeListQuerySort(
        { sort: 'status:ASC', sortBy: 'title', sortOrder: 'DESC' },
        'issues',
      );

      expect(result.sortBy).toBe('status');
      expect(result.sortOrder).toBe('ASC');
    });

    it('should use default sort when no params provided', () => {
      const result = normalizeListQuerySort({}, 'issues');

      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('DESC');
    });

    it('should throw for invalid sort format', () => {
      expect(() =>
        normalizeListQuerySort({ sort: 'invalid' }, 'issues'),
      ).toThrow(BadRequestException);
    });

    it('should throw for invalid sort direction', () => {
      expect(() =>
        normalizeListQuerySort({ sort: 'createdAt:INVALID' }, 'issues'),
      ).toThrow(BadRequestException);
    });

    it('should throw for unknown sort field', () => {
      expect(() =>
        normalizeListQuerySort({ sort: 'unknownField:ASC' }, 'issues'),
      ).toThrow(BadRequestException);
    });

    it('should accept all allowed sort fields for issues', () => {
      const allowedFields = [
        'createdAt',
        'updatedAt',
        'title',
        'type',
        'status',
        'severity',
        'discoveredDate',
        'dueDate',
        'resolvedDate',
      ];

      for (const field of allowedFields) {
        const result = normalizeListQuerySort(
          { sort: `${field}:ASC` },
          'issues',
        );
        expect(result.sortBy).toBe(field);
      }
    });

    it('should accept all allowed sort fields for capas', () => {
      const allowedFields = [
        'createdAt',
        'updatedAt',
        'status',
        'type',
        'priority',
        'dueDate',
        'completedDate',
        'verifiedAt',
        'closedAt',
        'title',
      ];

      for (const field of allowedFields) {
        const result = normalizeListQuerySort(
          { sort: `${field}:ASC` },
          'capas',
        );
        expect(result.sortBy).toBe(field);
      }
    });
  });
});
