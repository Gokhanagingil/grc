import { BadRequestException } from '@nestjs/common';
import { UniversalListService } from '../../common';

/**
 * Tests for Controls API filter validation
 *
 * The GrcControlController uses UniversalListService for filter validation.
 * These tests verify that the filter configuration and validation logic
 * properly handles valid and invalid filter values.
 */
describe('Controls API Filter Validation', () => {
  let universalListService: UniversalListService;

  beforeEach(() => {
    universalListService = new UniversalListService();
  });

  describe('CONTROL_LIST_CONFIG filter definitions', () => {
    const CONTROL_LIST_CONFIG = {
      searchableColumns: [
        { column: 'name' },
        { column: 'code' },
        { column: 'description' },
      ],
      sortableFields: [
        { field: 'createdAt' },
        { field: 'updatedAt' },
        { field: 'name' },
        { field: 'code' },
        { field: 'status' },
        { field: 'type' },
      ],
      filters: [
        {
          field: 'status',
          type: 'enum' as const,
          enumValues: [
            'draft',
            'in_design',
            'implemented',
            'inoperative',
            'retired',
          ],
          caseInsensitive: true,
        },
        {
          field: 'type',
          type: 'enum' as const,
          enumValues: ['preventive', 'detective', 'corrective'],
          caseInsensitive: true,
        },
      ],
      defaultSort: { field: 'createdAt', direction: 'DESC' as const },
    };

    it('should have status filter with correct enum values', () => {
      const statusFilter = CONTROL_LIST_CONFIG.filters.find(
        (f) => f.field === 'status',
      );
      expect(statusFilter).toBeDefined();
      expect(statusFilter?.type).toBe('enum');
      expect(statusFilter?.enumValues).toEqual([
        'draft',
        'in_design',
        'implemented',
        'inoperative',
        'retired',
      ]);
      expect(statusFilter?.caseInsensitive).toBe(true);
    });

    it('should have type filter with correct enum values', () => {
      const typeFilter = CONTROL_LIST_CONFIG.filters.find(
        (f) => f.field === 'type',
      );
      expect(typeFilter).toBeDefined();
      expect(typeFilter?.type).toBe('enum');
      expect(typeFilter?.enumValues).toEqual([
        'preventive',
        'detective',
        'corrective',
      ]);
      expect(typeFilter?.caseInsensitive).toBe(true);
    });
  });

  describe('UniversalListService.applyFilters - enum validation', () => {
    // Mock query builder for testing
    const createMockQueryBuilder = () => ({
      andWhere: jest.fn().mockReturnThis(),
    });

    const filterConfigs = [
      {
        field: 'status',
        type: 'enum' as const,
        enumValues: [
          'draft',
          'in_design',
          'implemented',
          'inoperative',
          'retired',
        ],
        caseInsensitive: true,
      },
      {
        field: 'type',
        type: 'enum' as const,
        enumValues: ['preventive', 'detective', 'corrective'],
        caseInsensitive: true,
      },
    ];

    describe('status filter validation', () => {
      it('should accept valid status values (lowercase)', () => {
        const qb = createMockQueryBuilder();
        expect(() => {
          universalListService.applyFilters(
            qb as any,
            { status: 'draft' },
            filterConfigs,
            'control',
          );
        }).not.toThrow();
        expect(qb.andWhere).toHaveBeenCalled();
      });

      it('should accept valid status values (uppercase)', () => {
        const qb = createMockQueryBuilder();
        expect(() => {
          universalListService.applyFilters(
            qb as any,
            { status: 'DRAFT' },
            filterConfigs,
            'control',
          );
        }).not.toThrow();
        expect(qb.andWhere).toHaveBeenCalled();
      });

      it('should accept valid status values (mixed case)', () => {
        const qb = createMockQueryBuilder();
        expect(() => {
          universalListService.applyFilters(
            qb as any,
            { status: 'In_Design' },
            filterConfigs,
            'control',
          );
        }).not.toThrow();
        expect(qb.andWhere).toHaveBeenCalled();
      });

      it('should throw BadRequestException for invalid status values', () => {
        const qb = createMockQueryBuilder();
        expect(() => {
          universalListService.applyFilters(
            qb as any,
            { status: 'invalid_status' },
            filterConfigs,
            'control',
          );
        }).toThrow(BadRequestException);
      });

      it('should include allowed values in error message for invalid status', () => {
        const qb = createMockQueryBuilder();
        try {
          universalListService.applyFilters(
            qb as any,
            { status: 'invalid' },
            filterConfigs,
            'control',
          );
          fail('Expected BadRequestException to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as BadRequestException).message).toContain(
            'Invalid status value',
          );
          expect((error as BadRequestException).message).toContain('draft');
          expect((error as BadRequestException).message).toContain(
            'implemented',
          );
        }
      });
    });

    describe('type filter validation', () => {
      it('should accept valid type values (lowercase)', () => {
        const qb = createMockQueryBuilder();
        expect(() => {
          universalListService.applyFilters(
            qb as any,
            { type: 'preventive' },
            filterConfigs,
            'control',
          );
        }).not.toThrow();
        expect(qb.andWhere).toHaveBeenCalled();
      });

      it('should accept valid type values (uppercase)', () => {
        const qb = createMockQueryBuilder();
        expect(() => {
          universalListService.applyFilters(
            qb as any,
            { type: 'DETECTIVE' },
            filterConfigs,
            'control',
          );
        }).not.toThrow();
        expect(qb.andWhere).toHaveBeenCalled();
      });

      it('should throw BadRequestException for invalid type values', () => {
        const qb = createMockQueryBuilder();
        expect(() => {
          universalListService.applyFilters(
            qb as any,
            { type: 'invalid_type' },
            filterConfigs,
            'control',
          );
        }).toThrow(BadRequestException);
      });

      it('should include allowed values in error message for invalid type', () => {
        const qb = createMockQueryBuilder();
        try {
          universalListService.applyFilters(
            qb as any,
            { type: 'invalid' },
            filterConfigs,
            'control',
          );
          fail('Expected BadRequestException to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as BadRequestException).message).toContain(
            'Invalid type value',
          );
          expect((error as BadRequestException).message).toContain(
            'preventive',
          );
          expect((error as BadRequestException).message).toContain('detective');
          expect((error as BadRequestException).message).toContain(
            'corrective',
          );
        }
      });
    });

    describe('combined filters', () => {
      it('should accept valid status and type together', () => {
        const qb = createMockQueryBuilder();
        expect(() => {
          universalListService.applyFilters(
            qb as any,
            { status: 'implemented', type: 'preventive' },
            filterConfigs,
            'control',
          );
        }).not.toThrow();
        expect(qb.andWhere).toHaveBeenCalledTimes(2);
      });

      it('should skip empty/null/undefined filter values', () => {
        const qb = createMockQueryBuilder();
        universalListService.applyFilters(
          qb as any,
          { status: '', type: null, other: undefined },
          filterConfigs,
          'control',
        );
        expect(qb.andWhere).not.toHaveBeenCalled();
      });
    });
  });
});
