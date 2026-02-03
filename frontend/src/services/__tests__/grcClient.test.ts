/**
 * Unit tests for grcClient.ts helper functions
 *
 * Tests for:
 * - unwrapResponse() - unwrapping NestJS envelope responses
 * - unwrapArrayResponse() - safely unwrapping array responses with multiple formats
 * - ensureArray() - ensuring a value is an array with safe fallback
 */

import {
  unwrapResponse,
  unwrapArrayResponse,
  ensureArray,
} from '../grcClient';

describe('grcClient.ts helpers', () => {
  describe('unwrapResponse', () => {
    it('should unwrap NestJS envelope format { success: true, data: T }', () => {
      const response = {
        data: {
          success: true,
          data: { id: '123', name: 'Test' },
        },
      };
      const result = unwrapResponse<{ id: string; name: string }>(response);
      expect(result).toEqual({ id: '123', name: 'Test' });
    });

    it('should return data directly for flat response format', () => {
      const response = {
        data: { id: '456', name: 'Direct' },
      };
      const result = unwrapResponse<{ id: string; name: string }>(response);
      expect(result).toEqual({ id: '456', name: 'Direct' });
    });

    it('should handle array data in envelope', () => {
      const response = {
        data: {
          success: true,
          data: [{ id: '1' }, { id: '2' }],
        },
      };
      const result = unwrapResponse<Array<{ id: string }>>(response);
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    });

    it('should return flat array directly', () => {
      const response = {
        data: [{ id: '1' }, { id: '2' }],
      };
      const result = unwrapResponse<Array<{ id: string }>>(response);
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    });
  });

  describe('unwrapArrayResponse', () => {
    it('should unwrap NestJS envelope with array data', () => {
      const response = {
        data: {
          success: true,
          data: [{ id: '1' }, { id: '2' }],
        },
      };
      const result = unwrapArrayResponse<{ id: string }>(response);
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should unwrap flat array response', () => {
      const response = {
        data: [{ id: '1' }, { id: '2' }],
      };
      const result = unwrapArrayResponse<{ id: string }>(response);
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should extract items from paginated response { items: [...] }', () => {
      const response = {
        data: {
          success: true,
          data: {
            items: [{ id: '1' }, { id: '2' }],
            total: 2,
            page: 1,
            pageSize: 10,
          },
        },
      };
      const result = unwrapArrayResponse<{ id: string }>(response);
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for non-array envelope data (prevents w.map error)', () => {
      const response = {
        data: {
          success: true,
          data: { id: '123', name: 'Single object, not array' },
        },
      };
      const result = unwrapArrayResponse<{ id: string }>(response);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for null/undefined data', () => {
      const response = { data: null };
      const result = unwrapArrayResponse<{ id: string }>(response);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for risk object mistakenly returned instead of controls array', () => {
      // This simulates the bug where GET /grc/risks/:id/controls returned the risk object
      // instead of the controls array, causing "w.map is not a function"
      const response = {
        data: {
          id: 'risk-123',
          title: 'Risk Title',
          controls: [{ id: 'ctrl-1' }, { id: 'ctrl-2' }],
        },
      };
      const result = unwrapArrayResponse<{ id: string }>(response);
      // Should return empty array since the response is an object, not an array
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('ensureArray', () => {
    it('should return the array if input is already an array', () => {
      const input = [{ id: '1' }, { id: '2' }];
      const result = ensureArray<{ id: string }>(input);
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for null', () => {
      const result = ensureArray<{ id: string }>(null);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for undefined', () => {
      const result = ensureArray<{ id: string }>(undefined);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for object (prevents .map error)', () => {
      const result = ensureArray<{ id: string }>({ id: '123' });
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for string', () => {
      const result = ensureArray<string>('not an array');
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for number', () => {
      const result = ensureArray<number>(42);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
