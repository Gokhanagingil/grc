import {
  normalizeFiltersData,
  normalizeRequirementsResponse,
  DEFAULT_FILTERS_DATA,
} from '../standards';

describe('Standards Normalizers', () => {
  describe('normalizeFiltersData', () => {
    it('returns default filters for undefined input', () => {
      const result = normalizeFiltersData(undefined);
      expect(result).toEqual(DEFAULT_FILTERS_DATA);
    });

    it('returns default filters for null input', () => {
      const result = normalizeFiltersData(null);
      expect(result).toEqual(DEFAULT_FILTERS_DATA);
    });

    it('returns default filters for empty object input', () => {
      const result = normalizeFiltersData({});
      expect(result).toEqual(DEFAULT_FILTERS_DATA);
    });

    it('returns default filters for non-object input (string)', () => {
      const result = normalizeFiltersData('invalid');
      expect(result).toEqual(DEFAULT_FILTERS_DATA);
    });

    it('returns default filters for non-object input (number)', () => {
      const result = normalizeFiltersData(123);
      expect(result).toEqual(DEFAULT_FILTERS_DATA);
    });

    it('returns default filters for non-object input (array)', () => {
      const result = normalizeFiltersData([]);
      expect(result).toEqual(DEFAULT_FILTERS_DATA);
    });

    it('normalizes filters with missing array fields', () => {
      const input = { families: ['iso27001'] };
      const result = normalizeFiltersData(input);
      expect(result.families).toEqual(['iso27001']);
      expect(result.versions).toEqual([]);
      expect(result.domains).toEqual([]);
      expect(result.categories).toEqual([]);
      expect(result.hierarchyLevels).toEqual([]);
    });

    it('normalizes filters with undefined array fields', () => {
      const input = {
        families: undefined,
        versions: undefined,
        domains: undefined,
        categories: undefined,
        hierarchyLevels: undefined,
      };
      const result = normalizeFiltersData(input);
      expect(result).toEqual(DEFAULT_FILTERS_DATA);
    });

    it('normalizes filters with null array fields', () => {
      const input = {
        families: null,
        versions: null,
        domains: null,
        categories: null,
        hierarchyLevels: null,
      };
      const result = normalizeFiltersData(input);
      expect(result).toEqual(DEFAULT_FILTERS_DATA);
    });

    it('normalizes filters with wrong type array fields (object instead of array)', () => {
      const input = {
        families: { key: 'value' },
        versions: { key: 'value' },
        domains: { key: 'value' },
        categories: { key: 'value' },
        hierarchyLevels: { key: 'value' },
      };
      const result = normalizeFiltersData(input);
      expect(result).toEqual(DEFAULT_FILTERS_DATA);
    });

    it('preserves valid array fields', () => {
      const input = {
        families: ['iso27001', 'soc2'],
        versions: ['2022', '2023'],
        domains: ['security', 'privacy'],
        categories: ['technical', 'administrative'],
        hierarchyLevels: ['high', 'medium', 'low'],
      };
      const result = normalizeFiltersData(input);
      expect(result).toEqual(input);
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeFiltersData(undefined)).not.toThrow();
      expect(() => normalizeFiltersData(null)).not.toThrow();
      expect(() => normalizeFiltersData({})).not.toThrow();
      expect(() => normalizeFiltersData('string')).not.toThrow();
      expect(() => normalizeFiltersData(123)).not.toThrow();
      expect(() => normalizeFiltersData([])).not.toThrow();
      expect(() => normalizeFiltersData(true)).not.toThrow();
    });
  });

  describe('normalizeRequirementsResponse', () => {
    it('returns empty items for undefined input', () => {
      const result = normalizeRequirementsResponse(undefined);
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('returns empty items for null input', () => {
      const result = normalizeRequirementsResponse(null);
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('returns empty items for empty object input', () => {
      const result = normalizeRequirementsResponse({});
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('returns empty items for non-array/non-object input (string)', () => {
      const result = normalizeRequirementsResponse('invalid');
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('returns empty items for non-array/non-object input (number)', () => {
      const result = normalizeRequirementsResponse(123);
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('handles raw array response', () => {
      const input = [
        { id: '1', title: 'Requirement 1' },
        { id: '2', title: 'Requirement 2' },
      ];
      const result = normalizeRequirementsResponse(input);
      expect(result.items).toEqual(input);
      expect(result.total).toBe(2);
    });

    it('handles envelope response with success and data', () => {
      const input = {
        success: true,
        data: [
          { id: '1', title: 'Requirement 1' },
          { id: '2', title: 'Requirement 2' },
        ],
        pagination: { total: 10 },
      };
      const result = normalizeRequirementsResponse(input);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('handles envelope response with success but non-array data', () => {
      const input = {
        success: true,
        data: { id: '1', title: 'Not an array' },
        pagination: { total: 1 },
      };
      const result = normalizeRequirementsResponse(input);
      expect(result.items).toEqual([]);
      // When data is non-array, items is empty so total defaults to items.length (0)
      expect(result.total).toBe(0);
    });

    it('handles envelope response with items array', () => {
      const input = {
        items: [
          { id: '1', title: 'Requirement 1' },
          { id: '2', title: 'Requirement 2' },
        ],
        total: 5,
      };
      const result = normalizeRequirementsResponse(input);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('handles envelope response with data array (no success flag)', () => {
      const input = {
        data: [
          { id: '1', title: 'Requirement 1' },
        ],
        total: 3,
      };
      const result = normalizeRequirementsResponse(input);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it('uses items length as total when total is missing', () => {
      const input = {
        items: [
          { id: '1', title: 'Requirement 1' },
          { id: '2', title: 'Requirement 2' },
          { id: '3', title: 'Requirement 3' },
        ],
      };
      const result = normalizeRequirementsResponse(input);
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('does not throw for any malformed input', () => {
      expect(() => normalizeRequirementsResponse(undefined)).not.toThrow();
      expect(() => normalizeRequirementsResponse(null)).not.toThrow();
      expect(() => normalizeRequirementsResponse({})).not.toThrow();
      expect(() => normalizeRequirementsResponse('string')).not.toThrow();
      expect(() => normalizeRequirementsResponse(123)).not.toThrow();
      expect(() => normalizeRequirementsResponse([])).not.toThrow();
      expect(() => normalizeRequirementsResponse(true)).not.toThrow();
    });
  });

  describe('Regression: StandardsLibrary crash scenarios', () => {
    it('handles API returning undefined for filters (t.map is not a function fix)', () => {
      const result = normalizeFiltersData(undefined);
      
      expect(result.families).toEqual([]);
      expect(result.versions).toEqual([]);
      expect(result.domains).toEqual([]);
      expect(result.categories).toEqual([]);
      expect(result.hierarchyLevels).toEqual([]);
      
      expect(() => result.families.map(f => f)).not.toThrow();
      expect(() => result.versions.map(v => v)).not.toThrow();
      expect(() => result.domains.map(d => d)).not.toThrow();
      expect(() => result.categories.map(c => c)).not.toThrow();
      expect(() => result.hierarchyLevels.map(h => h)).not.toThrow();
    });

    it('handles API returning object instead of array for filters', () => {
      const malformedFilters = { families: { id: '1', name: 'Not an array' } };
      const result = normalizeFiltersData(malformedFilters);
      
      expect(result.families).toEqual([]);
      expect(() => result.families.map(f => f)).not.toThrow();
    });

    it('handles API returning 401/500 error response shape', () => {
      const errorResponse = { error: 'Unauthorized', statusCode: 401 };
      const result = normalizeRequirementsResponse(errorResponse);
      
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(() => result.items.map(i => i)).not.toThrow();
    });

    it('page renders with empty state when normalization returns empty arrays', () => {
      const filtersResult = normalizeFiltersData(null);
      const requirementsResult = normalizeRequirementsResponse(null);
      
      expect(filtersResult.families.length).toBe(0);
      expect(requirementsResult.items.length).toBe(0);
      expect(requirementsResult.total).toBe(0);
    });
  });
});
