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

    it('should return null for invalid condition (empty field)', () => {
      const condition = { field: '', op: 'contains', value: 'test' } as FilterCondition;
      const result = normalizeFilter(condition);
      expect(result).toBeNull();
    });

    it('should filter out invalid conditions from AND group', () => {
      const filter: FilterTree = {
        and: [
          { field: 'name', op: 'contains', value: 'test' },
          { field: '', op: 'is', value: 'invalid' }, // Invalid - empty field
        ],
      };
      const result = normalizeFilter(filter);
      expect(result).toEqual({
        and: [{ field: 'name', op: 'contains', value: 'test' }],
      });
    });

    it('should filter out invalid conditions from OR group', () => {
      const filter: FilterTree = {
        or: [
          { field: '', op: 'contains', value: 'invalid' }, // Invalid - empty field
          { field: 'status', op: 'is', value: 'active' },
        ],
      };
      const result = normalizeFilter(filter);
      expect(result).toEqual({
        or: [{ field: 'status', op: 'is', value: 'active' }],
      });
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
      expect(params.get('q')).toBe('test'); // Uses canonical 'q' parameter
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

    it('should use q parameter for search (canonical)', () => {
      const params = buildListQueryParams({
        page: 1,
        pageSize: 10,
        search: 'test query',
        sort: 'createdAt:DESC',
        filterTree: null,
      });
      expect(params.get('q')).toBe('test query');
      expect(params.get('search')).toBeNull();
    });

    it('should round-trip q parameter through build -> parse', () => {
      const state = {
        page: 2,
        pageSize: 25,
        search: 'round trip test',
        sort: 'name:ASC',
        filterTree: null,
      };
      const params = buildListQueryParams(state, true);
      const parsed = parseListQuery(params);
      expect(parsed.q).toBe('round trip test');
      expect(parsed.search).toBe('round trip test');
      expect(parsed.page).toBe(2);
      expect(parsed.pageSize).toBe(25);
      expect(parsed.sort).toBe('name:ASC');
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

    it('should handle triple-encoded filter for legacy tolerance', () => {
      const filter: FilterTree = {
        and: [{ field: 'status', op: 'is', value: 'active' }],
      };
      // Simulate triple-encoding (very rare legacy case)
      const tripleEncoded = encodeURIComponent(encodeURIComponent(JSON.stringify(filter)));
      const params = new URLSearchParams({
        filter: tripleEncoded,
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

    it('should handle filter with special characters', () => {
      const filter: FilterTree = {
        and: [{ field: 'name', op: 'contains', value: 'test & value' }],
      };
      const params = new URLSearchParams({
        filter: JSON.stringify(filter),
      });
      const result = parseListQuery(params);
      expect(result.filterTree).toEqual(filter);
    });

    it('should parse q parameter (canonical quick search)', () => {
      const params = new URLSearchParams({
        q: 'quick search term',
      });
      const result = parseListQuery(params);
      expect(result.q).toBe('quick search term');
      expect(result.search).toBe('quick search term');
    });

    it('should prefer q over legacy search parameter', () => {
      const params = new URLSearchParams({
        q: 'canonical',
        search: 'legacy',
      });
      const result = parseListQuery(params);
      expect(result.q).toBe('canonical');
      expect(result.search).toBe('canonical');
    });

    it('should fall back to search parameter when q is not present', () => {
      const params = new URLSearchParams({
        search: 'legacy search',
      });
      const result = parseListQuery(params);
      expect(result.q).toBe('legacy search');
      expect(result.search).toBe('legacy search');
    });

    it('should parse sortField and sortOrder from sort string', () => {
      const params = new URLSearchParams({
        sort: 'name:ASC',
      });
      const result = parseListQuery(params);
      expect(result.sortField).toBe('name');
      expect(result.sortOrder).toBe('ASC');
    });

    it('should use default sortField and sortOrder when sort is invalid', () => {
      const params = new URLSearchParams({
        sort: 'invalid',
      });
      const result = parseListQuery(params);
      // Invalid sort falls back to default 'createdAt:DESC'
      expect(result.sortField).toBe('createdAt');
      expect(result.sortOrder).toBe('DESC');
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

  describe('sort round-trip', () => {
    it('should round-trip sort through parse -> build -> parse', () => {
      const originalSort = 'updatedAt:DESC';
      const parsed = parseSort(originalSort);
      expect(parsed).not.toBeNull();
      const rebuilt = buildSort(parsed!.field, parsed!.direction);
      expect(rebuilt).toBe(originalSort);
      const reparsed = parseSort(rebuilt);
      expect(reparsed).toEqual(parsed);
    });

    it('should round-trip sort through URL params', () => {
      const state = {
        page: 1,
        pageSize: 10,
        search: '',
        sort: 'name:ASC',
        filterTree: null,
      };
      const params = buildListQueryParams(state, true);
      const parsed = parseListQuery(params);
      expect(parsed.sort).toBe(state.sort);
    });

    it('should preserve sort in buildApiParams (canonical only, no legacy params)', () => {
      const state = {
        page: 1,
        pageSize: 10,
        search: '',
        sort: 'createdAt:DESC',
        filterTree: null,
      };
      const apiParams = buildApiParams(state);
      // Should ONLY send canonical sort param, NOT legacy sortBy/sortOrder
      expect(apiParams.sort).toBe('createdAt:DESC');
      expect(apiParams.sortBy).toBeUndefined();
      expect(apiParams.sortOrder).toBeUndefined();
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
    it('should build API params from state (canonical sort only)', () => {
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
      expect(result.q).toBe('test'); // Uses canonical 'q' parameter
      // Should ONLY send canonical sort param, NOT legacy sortBy/sortOrder
      expect(result.sort).toBe('name:ASC');
      expect(result.sortBy).toBeUndefined();
      expect(result.sortOrder).toBeUndefined();
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

  describe('nested filter groups', () => {
    it('should serialize deeply nested filter tree: (A AND B) OR C', () => {
      const filter: FilterTree = {
        or: [
          {
            and: [
              { field: 'name', op: 'contains', value: 'A' },
              { field: 'name', op: 'contains', value: 'B' },
            ],
          },
          { field: 'name', op: 'contains', value: 'C' },
        ],
      };
      const serialized = serializeFilterTree(filter);
      expect(serialized).not.toBeNull();
      expect(() => JSON.parse(serialized!)).not.toThrow();
      expect(JSON.parse(serialized!)).toEqual(filter);
    });

    it('should round-trip deeply nested filter through URL params', () => {
      const filter: FilterTree = {
        or: [
          {
            and: [
              { field: 'name', op: 'contains', value: 'A' },
              { field: 'name', op: 'contains', value: 'B' },
            ],
          },
          { field: 'name', op: 'contains', value: 'C' },
        ],
      };
      const params = buildListQueryParams({
        page: 1,
        pageSize: 10,
        search: '',
        sort: 'createdAt:DESC',
        filterTree: filter,
      });
      
      // Verify no double-encoding
      const queryString = params.toString();
      expect(queryString).not.toContain('%257B');
      expect(queryString).not.toContain('%257D');
      
      // Verify round-trip
      const parsed = parseListQuery(params);
      expect(parsed.filterTree).toEqual(filter);
    });

    it('should count conditions in deeply nested groups', () => {
      const filter: FilterTree = {
        or: [
          {
            and: [
              { field: 'name', op: 'contains', value: 'A' },
              { field: 'name', op: 'contains', value: 'B' },
            ],
          },
          { field: 'name', op: 'contains', value: 'C' },
          {
            and: [
              { field: 'status', op: 'is', value: 'active' },
              {
                or: [
                  { field: 'type', op: 'is', value: 'manual' },
                  { field: 'type', op: 'is', value: 'automated' },
                ],
              },
            ],
          },
        ],
      };
      expect(countFilterConditions(filter)).toBe(6);
    });

    it('should extract all conditions from deeply nested groups', () => {
      const filter: FilterTree = {
        or: [
          {
            and: [
              { field: 'name', op: 'contains', value: 'A' },
              { field: 'name', op: 'contains', value: 'B' },
            ],
          },
          { field: 'name', op: 'contains', value: 'C' },
        ],
      };
      const conditions = extractFilterConditions(filter);
      expect(conditions).toHaveLength(3);
      expect(conditions.map(c => c.value)).toEqual(['A', 'B', 'C']);
    });

    it('should normalize nested filter with invalid conditions', () => {
      const filter: FilterTree = {
        or: [
          {
            and: [
              { field: 'name', op: 'contains', value: 'valid' },
              { field: '', op: 'contains', value: 'invalid' }, // Invalid - empty field
            ],
          },
          { field: 'status', op: 'is', value: 'active' },
        ],
      };
      const result = normalizeFilter(filter);
      expect(result).not.toBeNull();
      // The invalid condition should be filtered out
      expect(countFilterConditions(result!)).toBe(2);
    });

    it('should handle triple-nested groups', () => {
      const filter: FilterTree = {
        and: [
          {
            or: [
              {
                and: [
                  { field: 'a', op: 'is', value: '1' },
                  { field: 'b', op: 'is', value: '2' },
                ],
              },
              { field: 'c', op: 'is', value: '3' },
            ],
          },
          { field: 'd', op: 'is', value: '4' },
        ],
      };
      
      // Serialize and parse
      const serialized = serializeFilterTree(filter);
      expect(serialized).not.toBeNull();
      
      const params = new URLSearchParams({ filter: serialized! });
      const parsed = parseListQuery(params);
      expect(parsed.filterTree).toEqual(filter);
      
      // Count conditions
      expect(countFilterConditions(filter)).toBe(4);
    });
  });
});
