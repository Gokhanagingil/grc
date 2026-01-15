/**
 * Unit tests for listQueryUtils
 *
 * Tests for:
 * - normalizeFilter()
 * - buildListQueryParams() - ensures no double-encoding
 * - parseListQuery() - handles single/double encoded filters
 */

import {
  parseListQuery,
  buildListQueryParams,
  normalizeFilter,
  parseSort,
  buildSort,
  serializeFilterTree,
  isFilterEmpty,
  countFilterConditions,
  extractFilterConditions,
  buildApiParams,
  DEFAULT_LIST_QUERY_STATE,
} from '../listQueryUtils';
import { FilterTree, FilterCondition } from '../../components/common/AdvancedFilter/types';

describe('listQueryUtils', () => {
  describe('normalizeFilter', () => {
    it('should return null for null input', () => {
      expect(normalizeFilter(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(normalizeFilter(undefined)).toBeNull();
    });

    it('should wrap a single condition in an AND group', () => {
      const condition: FilterCondition = {
        field: 'name',
        op: 'contains',
        value: 'test',
      };
      const result = normalizeFilter(condition);
      expect(result).toEqual({ and: [condition] });
    });

    it('should return AND group as-is', () => {
      const filter: FilterTree = {
        and: [
          { field: 'name', op: 'contains', value: 'test' },
          { field: 'status', op: 'is', value: 'active' },
        ],
      };
      const result = normalizeFilter(filter);
      expect(result).toEqual(filter);
    });

    it('should return OR group as-is', () => {
      const filter: FilterTree = {
        or: [
          { field: 'name', op: 'contains', value: 'test' },
          { field: 'status', op: 'is', value: 'active' },
        ],
      };
      const result = normalizeFilter(filter);
      expect(result).toEqual(filter);
    });

    it('should return empty AND group as-is', () => {
      const filter: FilterTree = { and: [] };
      const result = normalizeFilter(filter);
      expect(result).toEqual(filter);
    });

    it('should return empty OR group as-is', () => {
      const filter: FilterTree = { or: [] };
      const result = normalizeFilter(filter);
      expect(result).toEqual(filter);
    });
  });

  describe('buildListQueryParams', () => {
    it('should build params with default values excluded', () => {
      const params = buildListQueryParams({
        page: 1,
        pageSize: 10,
        search: '',
        sort: 'createdAt:DESC',
        filterTree: null,
      });
      expect(params.toString()).toBe('');
    });

    it('should include non-default values', () => {
      const params = buildListQueryParams({
        page: 2,
        pageSize: 25,
        search: 'test',
        sort: 'name:ASC',
        filterTree: null,
      });
      expect(params.get('page')).toBe('2');
      expect(params.get('pageSize')).toBe('25');
      expect(params.get('search')).toBe('test');
      expect(params.get('sort')).toBe('name:ASC');
    });

    it('should NOT double-encode filter (no %257B)', () => {
      const filter: FilterTree = {
        and: [{ field: 'name', op: 'contains', value: 'test' }],
      };
      const params = buildListQueryParams({
        page: 1,
        pageSize: 10,
        search: '',
        sort: 'createdAt:DESC',
        filterTree: filter,
      });
      
      const filterParam = params.get('filter');
      expect(filterParam).not.toBeNull();
      
      // The filter should be valid JSON (single-encoded)
      expect(() => JSON.parse(filterParam!)).not.toThrow();
      
      // The toString() should NOT contain double-encoded characters
      const queryString = params.toString();
      expect(queryString).not.toContain('%257B'); // Double-encoded {
      expect(queryString).not.toContain('%257D'); // Double-encoded }
      expect(queryString).not.toContain('%2522'); // Double-encoded "
    });

    it('should include all values when includeDefaults is true', () => {
      const params = buildListQueryParams(
        {
          page: 1,
          pageSize: 10,
          search: '',
          sort: 'createdAt:DESC',
          filterTree: null,
        },
        true
      );
      expect(params.get('page')).toBe('1');
      expect(params.get('pageSize')).toBe('10');
      expect(params.get('sort')).toBe('createdAt:DESC');
    });
  });

  describe('parseListQuery', () => {
    it('should parse empty search params with defaults', () => {
      const params = new URLSearchParams();
      const result = parseListQuery(params);
      expect(result).toEqual(DEFAULT_LIST_QUERY_STATE);
    });

    it('should parse all query params', () => {
      const params = new URLSearchParams({
        page: '3',
        pageSize: '25',
        search: 'test query',
        sort: 'name:ASC',
      });
      const result = parseListQuery(params);
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(25);
      expect(result.search).toBe('test query');
      expect(result.sort).toBe('name:ASC');
    });

    it('should parse single-encoded filter', () => {
      const filter: FilterTree = {
        and: [{ field: 'name', op: 'contains', value: 'test' }],
      };
      const params = new URLSearchParams({
        filter: JSON.stringify(filter),
      });
      const result = parseListQuery(params);
      expect(result.filterTree).toEqual(filter);
    });

    it('should handle double-encoded filter for backward compatibility', () => {
      const filter: FilterTree = {
        and: [{ field: 'name', op: 'contains', value: 'test' }],
      };
      // Simulate double-encoding: JSON.stringify then encodeURIComponent
      const doubleEncoded = encodeURIComponent(JSON.stringify(filter));
      const params = new URLSearchParams({
        filter: doubleEncoded,
      });
      const result = parseListQuery(params);
      expect(result.filterTree).toEqual(filter);
    });

    it('should use custom defaults', () => {
      const params = new URLSearchParams();
      const result = parseListQuery(params, {
        pageSize: 50,
        sort: 'updatedAt:DESC',
      });
      expect(result.pageSize).toBe(50);
      expect(result.sort).toBe('updatedAt:DESC');
    });

    it('should parse string input', () => {
      const result = parseListQuery('page=2&search=hello');
      expect(result.page).toBe(2);
      expect(result.search).toBe('hello');
    });

    it('should handle invalid filter JSON gracefully', () => {
      const params = new URLSearchParams({
        filter: 'not-valid-json',
      });
      const result = parseListQuery(params);
      expect(result.filterTree).toBeNull();
    });
  });

  describe('parseSort', () => {
    it('should parse valid sort string', () => {
      expect(parseSort('name:ASC')).toEqual({ field: 'name', direction: 'ASC' });
      expect(parseSort('createdAt:DESC')).toEqual({ field: 'createdAt', direction: 'DESC' });
    });

    it('should return null for invalid sort string', () => {
      expect(parseSort('')).toBeNull();
      expect(parseSort('invalid')).toBeNull();
      expect(parseSort('name:INVALID')).toBeNull();
    });
  });

  describe('buildSort', () => {
    it('should build valid sort string', () => {
      expect(buildSort('name', 'ASC')).toBe('name:ASC');
      expect(buildSort('createdAt', 'DESC')).toBe('createdAt:DESC');
    });
  });

  describe('serializeFilterTree', () => {
    it('should return null for null input', () => {
      expect(serializeFilterTree(null)).toBeNull();
    });

    it('should serialize filter tree to JSON', () => {
      const filter: FilterTree = {
        and: [{ field: 'name', op: 'contains', value: 'test' }],
      };
      const result = serializeFilterTree(filter);
      expect(result).toBe(JSON.stringify(filter));
    });
  });

  describe('isFilterEmpty', () => {
    it('should return true for null', () => {
      expect(isFilterEmpty(null)).toBe(true);
    });

    it('should return true for empty AND group', () => {
      expect(isFilterEmpty({ and: [] })).toBe(true);
    });

    it('should return true for empty OR group', () => {
      expect(isFilterEmpty({ or: [] })).toBe(true);
    });

    it('should return false for non-empty filter', () => {
      expect(isFilterEmpty({ and: [{ field: 'name', op: 'contains', value: 'test' }] })).toBe(false);
    });
  });

  describe('countFilterConditions', () => {
    it('should return 0 for null', () => {
      expect(countFilterConditions(null)).toBe(0);
    });

    it('should count conditions in AND group', () => {
      const filter: FilterTree = {
        and: [
          { field: 'name', op: 'contains', value: 'test' },
          { field: 'status', op: 'is', value: 'active' },
        ],
      };
      expect(countFilterConditions(filter)).toBe(2);
    });

    it('should count conditions in OR group', () => {
      const filter: FilterTree = {
        or: [
          { field: 'name', op: 'contains', value: 'test' },
          { field: 'status', op: 'is', value: 'active' },
          { field: 'type', op: 'is', value: 'manual' },
        ],
      };
      expect(countFilterConditions(filter)).toBe(3);
    });

    it('should count nested conditions', () => {
      const filter: FilterTree = {
        and: [
          { field: 'name', op: 'contains', value: 'test' },
          {
            or: [
              { field: 'status', op: 'is', value: 'active' },
              { field: 'status', op: 'is', value: 'pending' },
            ],
          },
        ],
      };
      expect(countFilterConditions(filter)).toBe(3);
    });
  });

  describe('extractFilterConditions', () => {
    it('should return empty array for null', () => {
      expect(extractFilterConditions(null)).toEqual([]);
    });

    it('should extract conditions from AND group', () => {
      const conditions: FilterCondition[] = [
        { field: 'name', op: 'contains', value: 'test' },
        { field: 'status', op: 'is', value: 'active' },
      ];
      const filter: FilterTree = { and: conditions };
      expect(extractFilterConditions(filter)).toEqual(conditions);
    });

    it('should extract conditions from nested groups', () => {
      const filter: FilterTree = {
        and: [
          { field: 'name', op: 'contains', value: 'test' },
          {
            or: [
              { field: 'status', op: 'is', value: 'active' },
              { field: 'status', op: 'is', value: 'pending' },
            ],
          },
        ],
      };
      const result = extractFilterConditions(filter);
      expect(result).toHaveLength(3);
    });
  });

  describe('buildApiParams', () => {
    it('should build API params from state', () => {
      const state = {
        page: 2,
        pageSize: 25,
        search: 'test',
        sort: 'name:ASC',
        filterTree: null,
      };
      const result = buildApiParams(state);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(25);
      expect(result.search).toBe('test');
      expect(result.sortBy).toBe('name');
      expect(result.sortOrder).toBe('ASC');
    });

    it('should include filter when present', () => {
      const filter: FilterTree = {
        and: [{ field: 'name', op: 'contains', value: 'test' }],
      };
      const state = {
        page: 1,
        pageSize: 10,
        search: '',
        sort: 'createdAt:DESC',
        filterTree: filter,
      };
      const result = buildApiParams(state);
      expect(result.filter).toBe(JSON.stringify(filter));
    });

    it('should not include empty search', () => {
      const state = {
        page: 1,
        pageSize: 10,
        search: '',
        sort: 'createdAt:DESC',
        filterTree: null,
      };
      const result = buildApiParams(state);
      expect(result.search).toBeUndefined();
    });
  });
});
