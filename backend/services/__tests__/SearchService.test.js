/**
 * SearchService Unit Tests
 * 
 * Tests for DSL-based Search functionality including:
 * - Query building
 * - Condition evaluation
 * - Pagination
 * - Sorting
 */

const SearchService = require('../SearchService');

describe('SearchService', () => {
  describe('supportedTables', () => {
    it('should have defined supported tables', () => {
      expect(SearchService.supportedTables).toBeDefined();
      expect(Array.isArray(SearchService.supportedTables)).toBe(true);
      expect(SearchService.supportedTables.length).toBeGreaterThan(0);
    });

    it('should include core GRC tables', () => {
      expect(SearchService.supportedTables).toContain('risks');
      expect(SearchService.supportedTables).toContain('policies');
      expect(SearchService.supportedTables).toContain('compliance_requirements');
    });
  });

  describe('buildCondition', () => {
    it('should return 1=1 for empty filter', () => {
      const params = [];
      const result = SearchService.buildCondition({}, 'risks', params);
      expect(result.sql).toBe('1=1');
    });

    it('should build equals condition correctly', () => {
      const params = [];
      const filter = { field: 'status', operator: 'equals', value: 'open' };
      const result = SearchService.buildCondition(filter, 'risks', params);
      expect(result.sql).toContain('=');
      expect(params.length).toBe(1);
      expect(params[0]).toBe('open');
    });

    it('should build contains condition correctly', () => {
      const params = [];
      const filter = { field: 'title', operator: 'contains', value: 'test' };
      const result = SearchService.buildCondition(filter, 'risks', params);
      expect(result.sql).toContain('LIKE');
      expect(params[0]).toBe('%test%');
    });

    it('should build greater_than condition correctly', () => {
      const params = [];
      const filter = { field: 'risk_score', operator: 'greater_than', value: 50 };
      const result = SearchService.buildCondition(filter, 'risks', params);
      expect(result.sql).toContain('>');
      expect(params[0]).toBe(50);
    });

    it('should build IN condition correctly', () => {
      const params = [];
      const filter = { field: 'status', operator: 'in', value: ['open', 'closed'] };
      const result = SearchService.buildCondition(filter, 'risks', params);
      expect(result.sql).toContain('IN');
      expect(params.length).toBe(2);
    });

    it('should build AND conditions correctly', () => {
      const params = [];
      const filter = {
        and: [
          { field: 'status', operator: 'equals', value: 'open' },
          { field: 'severity', operator: 'equals', value: 'High' }
        ]
      };
      const result = SearchService.buildCondition(filter, 'risks', params);
      expect(result.sql).toContain('AND');
      expect(params.length).toBe(2);
    });

    it('should build OR conditions correctly', () => {
      const params = [];
      const filter = {
        or: [
          { field: 'status', operator: 'equals', value: 'open' },
          { field: 'status', operator: 'equals', value: 'closed' }
        ]
      };
      const result = SearchService.buildCondition(filter, 'risks', params);
      expect(result.sql).toContain('OR');
      expect(params.length).toBe(2);
    });

    it('should build NOT conditions correctly', () => {
      const params = [];
      const filter = {
        not: { field: 'status', operator: 'equals', value: 'closed' }
      };
      const result = SearchService.buildCondition(filter, 'risks', params);
      expect(result.sql).toContain('NOT');
    });

    it('should build is_null condition correctly', () => {
      const params = [];
      const filter = { field: 'due_date', operator: 'is_null' };
      const result = SearchService.buildCondition(filter, 'risks', params);
      expect(result.sql).toContain('IS NULL');
    });

    it('should build between condition correctly', () => {
      const params = [];
      const filter = { field: 'risk_score', operator: 'between', value: [10, 50] };
      const result = SearchService.buildCondition(filter, 'risks', params);
      expect(result.sql).toContain('BETWEEN');
      expect(params.length).toBe(2);
    });
  });

  describe('buildOrderBy', () => {
    it('should return default order for null sort', () => {
      const result = SearchService.buildOrderBy(null, 'risks');
      expect(result).toBe('created_at DESC');
    });

    it('should build single sort correctly', () => {
      const sort = { field: 'title', direction: 'ASC' };
      const result = SearchService.buildOrderBy(sort, 'risks');
      expect(result).toContain('ASC');
    });

    it('should build multiple sorts correctly', () => {
      const sort = [
        { field: 'status', direction: 'ASC' },
        { field: 'created_at', direction: 'DESC' }
      ];
      const result = SearchService.buildOrderBy(sort, 'risks');
      expect(result).toContain('ASC');
      expect(result).toContain('DESC');
    });

    it('should default to DESC for invalid direction', () => {
      const sort = { field: 'title', direction: 'INVALID' };
      const result = SearchService.buildOrderBy(sort, 'risks');
      expect(result).toContain('DESC');
    });
  });

  describe('getFieldMetadata', () => {
    it('should return metadata for risks table', () => {
      const metadata = SearchService.getFieldMetadata('risks');
      expect(metadata).toHaveProperty('title');
      expect(metadata).toHaveProperty('status');
      expect(metadata).toHaveProperty('severity');
    });

    it('should return metadata for policies table', () => {
      const metadata = SearchService.getFieldMetadata('policies');
      expect(metadata).toHaveProperty('title');
      expect(metadata).toHaveProperty('status');
      expect(metadata).toHaveProperty('version');
    });

    it('should return metadata for compliance_requirements table', () => {
      const metadata = SearchService.getFieldMetadata('compliance_requirements');
      expect(metadata).toHaveProperty('title');
      expect(metadata).toHaveProperty('regulation');
      expect(metadata).toHaveProperty('status');
    });

    it('should return empty object for unknown table', () => {
      const metadata = SearchService.getFieldMetadata('unknown_table');
      expect(metadata).toEqual({});
    });
  });

  describe('validateQuery', () => {
    it('should validate correct query', () => {
      const query = {
        filter: { field: 'status', operator: 'equals', value: 'open' },
        page: 1,
        limit: 10
      };
      const result = SearchService.validateQuery(query);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid page number', () => {
      const query = { page: -1 };
      const result = SearchService.validateQuery(query);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Page must be a positive number');
    });

    it('should reject invalid limit', () => {
      const query = { limit: 200 };
      const result = SearchService.validateQuery(query);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Limit must be a number between 1 and 100');
    });

    it('should reject filter with missing operator', () => {
      const query = {
        filter: { field: 'status', value: 'open' }
      };
      const result = SearchService.validateQuery(query);
      expect(result.valid).toBe(false);
    });

    it('should reject filter with invalid operator', () => {
      const query = {
        filter: { field: 'status', operator: 'invalid_op', value: 'open' }
      };
      const result = SearchService.validateQuery(query);
      expect(result.valid).toBe(false);
    });
  });

  describe('search', () => {
    it('should throw error for unsupported table', async () => {
      await expect(SearchService.search('unsupported_table', {})).rejects.toThrow('Unsupported table');
    });

    it('should return records and pagination for valid query', async () => {
      const result = await SearchService.search('risks', { page: 1, limit: 10 });
      expect(result).toHaveProperty('records');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.records)).toBe(true);
    });
  });
});
