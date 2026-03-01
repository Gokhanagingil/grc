/**
 * Unit tests for ITSM incident filter tree compiler (v1).
 */

import { compileIncidentFilterTreeToQuery } from '../incidentFilterCompiler';
import type { FilterTree } from '../../components/common/AdvancedFilter/types';

describe('incidentFilterCompiler', () => {
  describe('compileIncidentFilterTreeToQuery', () => {
    it('returns empty params and no unsupported for null tree', () => {
      const result = compileIncidentFilterTreeToQuery(null);
      expect(result.params).toEqual({});
      expect(result.unsupported).toEqual([]);
    });

    it('compiles priority is P1', () => {
      const tree: FilterTree = {
        and: [{ field: 'priority', op: 'is', value: 'p1' }],
      };
      const result = compileIncidentFilterTreeToQuery(tree);
      expect(result.params).toEqual({ priority: 'p1' });
      expect(result.unsupported).toEqual([]);
    });

    it('compiles customerCompanyId is X', () => {
      const uuid = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
      const tree: FilterTree = {
        and: [{ field: 'customerCompanyId', op: 'is', value: uuid }],
      };
      const result = compileIncidentFilterTreeToQuery(tree);
      expect(result.params).toEqual({ customerCompanyId: uuid });
      expect(result.unsupported).toEqual([]);
    });

    it('compiles createdAt after date', () => {
      const tree: FilterTree = {
        and: [{ field: 'createdAt', op: 'after', value: '2024-01-15T00:00:00.000Z' }],
      };
      const result = compileIncidentFilterTreeToQuery(tree);
      expect(result.params.createdAtAfter).toBeDefined();
      expect(result.params.createdAtAfter).toContain('2024');
      expect(result.unsupported).toEqual([]);
    });

    it('compiles category contains', () => {
      const tree: FilterTree = {
        and: [{ field: 'category', op: 'contains', value: 'hardware' }],
      };
      const result = compileIncidentFilterTreeToQuery(tree);
      expect(result.params).toEqual({ category: 'hardware' });
      expect(result.unsupported).toEqual([]);
    });

    it('compiles is empty customerCompanyId (reported but no param)', () => {
      const tree: FilterTree = {
        and: [{ field: 'customerCompanyId', op: 'is_empty' }],
      };
      const result = compileIncidentFilterTreeToQuery(tree);
      expect(result.params).toEqual({});
      expect(result.unsupported).toEqual([]);
    });

    it('reports unsupported field', () => {
      const tree: FilterTree = {
        and: [{ field: 'unknownField', op: 'is', value: 'x' }],
      };
      const result = compileIncidentFilterTreeToQuery(tree);
      expect(result.params).toEqual({});
      expect(result.unsupported).toContain('unknownField');
    });

    it('compiles state (and status mapped to state)', () => {
      const tree: FilterTree = {
        and: [{ field: 'state', op: 'is', value: 'open' }],
      };
      const result = compileIncidentFilterTreeToQuery(tree);
      expect(result.params).toEqual({ state: 'open' });
    });

    it('compiles multiple conditions', () => {
      const tree: FilterTree = {
        and: [
          { field: 'priority', op: 'is', value: 'p2' },
          { field: 'state', op: 'is', value: 'in_progress' },
        ],
      };
      const result = compileIncidentFilterTreeToQuery(tree);
      expect(result.params).toEqual({ priority: 'p2', state: 'in_progress' });
    });
  });
});
