/**
 * Unit tests for normalizeListContract helper function
 *
 * Tests the LIST-CONTRACT normalization logic that handles various
 * response envelope formats from the API.
 */

import { normalizeListContract } from './smoke-soa';

describe('normalizeListContract', () => {
  describe('Format C: Raw list-contract { items: [], total, ... }', () => {
    it('should normalize a raw list-contract response', () => {
      const response = {
        items: [{ id: '1', name: 'Item 1' }],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([{ id: '1', name: 'Item 1' }]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should handle empty items array', () => {
      const response = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should compute totalPages if missing', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const response = {
        items: [{ id: '1' }, { id: '2' }],
        total: 25,
        page: 1,
        pageSize: 10,
      };

      const result = normalizeListContract(response);

      expect(result.totalPages).toBe(3); // ceil(25/10) = 3
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CONTRACT WARNING]'),
      );
      consoleSpy.mockRestore();
    });

    it('should default page to 1 if missing', () => {
      const response = {
        items: [{ id: '1' }],
        total: 1,
        pageSize: 10,
        totalPages: 1,
      };

      const result = normalizeListContract(response);

      expect(result.page).toBe(1);
    });

    it('should default pageSize to 10 if missing', () => {
      const response = {
        items: [{ id: '1' }],
        total: 1,
        page: 1,
        totalPages: 1,
      };

      const result = normalizeListContract(response);

      expect(result.pageSize).toBe(10);
    });

    it('should use items.length as total if total is missing', () => {
      const response = {
        items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      const result = normalizeListContract(response);

      expect(result.total).toBe(3);
    });
  });

  describe('Format A: Single envelope { data: { items: [], ... } }', () => {
    it('should normalize a single-envelope response', () => {
      const response = {
        data: {
          items: [{ id: '1', name: 'Item 1' }],
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([{ id: '1', name: 'Item 1' }]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should handle single-envelope with empty items', () => {
      const response = {
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0,
        },
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle single-envelope with success flag', () => {
      const response = {
        success: true,
        data: {
          items: [{ id: '1' }],
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([{ id: '1' }]);
      expect(result.total).toBe(1);
    });
  });

  describe('Format B: Double envelope { data: { data: { items: [], ... } } }', () => {
    it('should normalize a double-envelope response', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const response = {
        data: {
          data: {
            items: [{ id: '1', name: 'Item 1' }],
            total: 1,
            page: 1,
            pageSize: 10,
            totalPages: 1,
          },
        },
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([{ id: '1', name: 'Item 1' }]);
      expect(result.total).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Double envelope detected'),
      );
      consoleSpy.mockRestore();
    });

    it('should handle double-envelope with empty items', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const response = {
        data: {
          data: {
            items: [],
            total: 0,
            page: 1,
            pageSize: 10,
            totalPages: 0,
          },
        },
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      consoleSpy.mockRestore();
    });

    it('should handle double-envelope with success flags', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const response = {
        success: true,
        data: {
          success: true,
          data: {
            items: [{ id: '1' }],
            total: 1,
            page: 1,
            pageSize: 10,
            totalPages: 1,
          },
        },
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([{ id: '1' }]);
      expect(result.total).toBe(1);
      consoleSpy.mockRestore();
    });
  });

  describe('Error cases', () => {
    it('should throw for null response', () => {
      expect(() => normalizeListContract(null)).toThrow(
        'Response is not an object',
      );
    });

    it('should throw for undefined response', () => {
      expect(() => normalizeListContract(undefined)).toThrow(
        'Response is not an object',
      );
    });

    it('should throw for non-object response', () => {
      expect(() => normalizeListContract('string')).toThrow(
        'Response is not an object',
      );
      expect(() => normalizeListContract(123)).toThrow(
        'Response is not an object',
      );
      expect(() => normalizeListContract(true)).toThrow(
        'Response is not an object',
      );
    });

    it('should throw for object without items array', () => {
      const response = {
        total: 10,
        page: 1,
        pageSize: 10,
      };

      expect(() => normalizeListContract(response)).toThrow(
        'Cannot normalize response to LIST-CONTRACT',
      );
    });

    it('should throw for object with items as non-array', () => {
      const response = {
        items: 'not an array',
        total: 10,
      };

      expect(() => normalizeListContract(response)).toThrow(
        'Cannot normalize response to LIST-CONTRACT',
      );
    });

    it('should throw for object with items as null', () => {
      const response = {
        items: null,
        total: 10,
      };

      expect(() => normalizeListContract(response)).toThrow(
        'Cannot normalize response to LIST-CONTRACT',
      );
    });

    it('should throw for empty object', () => {
      expect(() => normalizeListContract({})).toThrow(
        'Cannot normalize response to LIST-CONTRACT',
      );
    });

    it('should throw for data envelope without items', () => {
      const response = {
        data: {
          total: 10,
          page: 1,
        },
      };

      expect(() => normalizeListContract(response)).toThrow(
        'Cannot normalize response to LIST-CONTRACT',
      );
    });

    it('should throw for double envelope without items', () => {
      const response = {
        data: {
          data: {
            total: 10,
            page: 1,
          },
        },
      };

      expect(() => normalizeListContract(response)).toThrow(
        'Cannot normalize response to LIST-CONTRACT',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle items with various data types', () => {
      const response = {
        items: [
          { id: '1', name: 'String item' },
          { id: 2, count: 100 },
          { nested: { deep: { value: true } } },
        ],
        total: 3,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      const result = normalizeListContract(response);

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should handle large total with small items array (pagination)', () => {
      const response = {
        items: [{ id: '1' }, { id: '2' }],
        total: 1000,
        page: 1,
        pageSize: 2,
        totalPages: 500,
      };

      const result = normalizeListContract(response);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(1000);
      expect(result.totalPages).toBe(500);
    });

    it('should handle zero pageSize gracefully when computing totalPages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const response = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 0,
      };

      const result = normalizeListContract(response);

      expect(result.pageSize).toBe(0);
      // totalPages would be Infinity with pageSize 0, but we compute ceil(0/0) = NaN
      // The function should still work
      expect(result.items).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('should prefer raw format over envelope when both patterns exist', () => {
      // This is an edge case where the response has both items at root and data.items
      // The function should prefer the raw format (items at root)
      const response = {
        items: [{ id: 'root' }],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        data: {
          items: [{ id: 'nested' }],
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([{ id: 'root' }]);
    });

    it('should handle response with extra fields', () => {
      const response = {
        items: [{ id: '1' }],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        extraField: 'should be ignored',
        meta: { timestamp: '2024-01-01' },
      };

      const result = normalizeListContract(response);

      expect(result.items).toEqual([{ id: '1' }]);
      expect(result.total).toBe(1);
    });
  });
});
