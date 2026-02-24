import { BadRequestException } from '@nestjs/common';
import { UniversalListService } from './universal-list.service';
import {
  ListQueryDto,
  SearchableColumn,
  SortableField,
  FilterConfig,
} from '../dto/list-query.dto';
import { ColumnFilter } from '../dto/table-schema.dto';

describe('UniversalListService', () => {
  let service: UniversalListService;

  beforeEach(() => {
    service = new UniversalListService();
  });

  describe('applySearch', () => {
    it('should not apply search when search term is empty', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const query = new ListQueryDto();
      const searchableColumns: SearchableColumn[] = [{ column: 'name' }];

      service.applySearch(mockQb as any, query, searchableColumns, 'entity');

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('should apply search with ILIKE for single column', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const query = new ListQueryDto();
      query.search = 'test';
      const searchableColumns: SearchableColumn[] = [{ column: 'name' }];

      service.applySearch(mockQb as any, query, searchableColumns, 'entity');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(entity.name ILIKE :search0)',
        { search0: '%test%' },
      );
    });

    it('should apply search with OR for multiple columns', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const query = new ListQueryDto();
      query.search = 'test';
      const searchableColumns: SearchableColumn[] = [
        { column: 'name' },
        { column: 'description' },
      ];

      service.applySearch(mockQb as any, query, searchableColumns, 'entity');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(entity.name ILIKE :search0 OR entity.description ILIKE :search1)',
        { search0: '%test%', search1: '%test%' },
      );
    });

    it('should use alias when provided', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const query = new ListQueryDto();
      query.search = 'test';
      const searchableColumns: SearchableColumn[] = [
        { column: 'name', alias: 'owner' },
      ];

      service.applySearch(mockQb as any, query, searchableColumns, 'entity');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(owner.name ILIKE :search0)',
        { search0: '%test%' },
      );
    });
  });

  describe('applySorting', () => {
    it('should apply requested sort when field is allowed', () => {
      const mockQb = {
        orderBy: jest.fn(),
      };
      const query = new ListQueryDto();
      query.sort = 'name:ASC';
      const sortableFields: SortableField[] = [
        { field: 'name' },
        { field: 'createdAt' },
      ];

      service.applySorting(
        mockQb as any,
        query,
        sortableFields,
        undefined,
        'entity',
      );

      expect(mockQb.orderBy).toHaveBeenCalledWith('entity.name', 'ASC');
    });

    it('should use default sort when no sort is requested', () => {
      const mockQb = {
        orderBy: jest.fn(),
      };
      const query = new ListQueryDto();
      const sortableFields: SortableField[] = [{ field: 'name' }];
      const defaultSort = { field: 'createdAt', direction: 'DESC' as const };

      service.applySorting(
        mockQb as any,
        query,
        sortableFields,
        defaultSort,
        'entity',
      );

      expect(mockQb.orderBy).toHaveBeenCalledWith('entity.createdAt', 'DESC');
    });

    it('should fall back to createdAt when no default and no request', () => {
      const mockQb = {
        orderBy: jest.fn(),
      };
      const query = new ListQueryDto();
      const sortableFields: SortableField[] = [
        { field: 'name' },
        { field: 'createdAt' },
      ];

      service.applySorting(
        mockQb as any,
        query,
        sortableFields,
        undefined,
        'entity',
      );

      expect(mockQb.orderBy).toHaveBeenCalledWith('entity.createdAt', 'DESC');
    });

    it('should use first sortable field when createdAt is not available', () => {
      const mockQb = {
        orderBy: jest.fn(),
      };
      const query = new ListQueryDto();
      const sortableFields: SortableField[] = [{ field: 'name' }];

      service.applySorting(
        mockQb as any,
        query,
        sortableFields,
        undefined,
        'entity',
      );

      expect(mockQb.orderBy).toHaveBeenCalledWith('entity.name', 'DESC');
    });
  });

  describe('applyFilters', () => {
    it('should skip empty filter values', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const filters = { status: '', type: null, category: undefined };
      const filterConfigs: FilterConfig[] = [
        { field: 'status', type: 'enum', enumValues: ['ACTIVE'] },
        { field: 'type', type: 'string' },
        { field: 'category', type: 'string' },
      ];

      service.applyFilters(mockQb as any, filters, filterConfigs, 'entity');

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('should apply enum filter with case-insensitive matching', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const filters = { status: 'active' };
      const filterConfigs: FilterConfig[] = [
        {
          field: 'status',
          type: 'enum',
          enumValues: ['ACTIVE', 'INACTIVE'],
          caseInsensitive: true,
        },
      ];

      service.applyFilters(mockQb as any, filters, filterConfigs, 'entity');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.status = :filter_status',
        { filter_status: 'ACTIVE' },
      );
    });

    it('should throw BadRequestException for invalid enum value', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const filters = { status: 'invalid' };
      const filterConfigs: FilterConfig[] = [
        {
          field: 'status',
          type: 'enum',
          enumValues: ['ACTIVE', 'INACTIVE'],
        },
      ];

      expect(() => {
        service.applyFilters(mockQb as any, filters, filterConfigs, 'entity');
      }).toThrow(BadRequestException);
    });

    it('should apply uuid filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const filters = { ownerId: '550e8400-e29b-41d4-a716-446655440000' };
      const filterConfigs: FilterConfig[] = [
        { field: 'ownerId', type: 'uuid' },
      ];

      service.applyFilters(mockQb as any, filters, filterConfigs, 'entity');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.ownerId = :filter_ownerId',
        { filter_ownerId: '550e8400-e29b-41d4-a716-446655440000' },
      );
    });

    it('should apply boolean filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const filters = { isActive: 'true' };
      const filterConfigs: FilterConfig[] = [
        { field: 'isActive', type: 'boolean' },
      ];

      service.applyFilters(mockQb as any, filters, filterConfigs, 'entity');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.isActive = :filter_isActive',
        { filter_isActive: true },
      );
    });
  });

  describe('applyTenantFilter', () => {
    it('should apply tenant isolation filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };

      service.applyTenantFilter(mockQb as any, 'tenant-123', 'entity');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.tenantId = :tenantId',
        { tenantId: 'tenant-123' },
      );
    });
  });

  describe('applySoftDeleteFilter', () => {
    it('should exclude deleted records by default', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };

      service.applySoftDeleteFilter(mockQb as any, 'entity');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.isDeleted = :isDeleted',
        { isDeleted: false },
      );
    });

    it('should not apply filter when includeDeleted is true', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };

      service.applySoftDeleteFilter(mockQb as any, 'entity', true);

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('validateSortField', () => {
    it('should return true for allowed field', () => {
      const result = service.validateSortField('name', ['name', 'createdAt']);
      expect(result).toBe(true);
    });

    it('should return false for disallowed field', () => {
      const result = service.validateSortField('password', [
        'name',
        'createdAt',
      ]);
      expect(result).toBe(false);
    });
  });

  describe('getAllowedSortFieldsSet', () => {
    it('should return Set of field names', () => {
      const sortableFields: SortableField[] = [
        { field: 'name' },
        { field: 'createdAt' },
        { field: 'status' },
      ];

      const result = service.getAllowedSortFieldsSet(sortableFields);

      expect(result).toBeInstanceOf(Set);
      expect(result.has('name')).toBe(true);
      expect(result.has('createdAt')).toBe(true);
      expect(result.has('status')).toBe(true);
      expect(result.has('unknown')).toBe(false);
    });
  });

  describe('applyDateRangeFilter', () => {
    it('should apply from date filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };

      service.applyDateRangeFilter(
        mockQb as any,
        'entity.createdAt',
        '2024-01-01',
        null,
        'created',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.createdAt >= :createdFrom',
        { createdFrom: '2024-01-01' },
      );
    });

    it('should apply to date filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };

      service.applyDateRangeFilter(
        mockQb as any,
        'entity.createdAt',
        null,
        '2024-12-31',
        'created',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.createdAt <= :createdTo',
        { createdTo: '2024-12-31' },
      );
    });

    it('should apply both from and to date filters', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };

      service.applyDateRangeFilter(
        mockQb as any,
        'entity.createdAt',
        '2024-01-01',
        '2024-12-31',
        'created',
      );

      expect(mockQb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('applyColumnFilters', () => {
    it('should skip filters with no op', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        name: { op: '', value: 'test' },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-filterable field', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        nonExistentField: { op: 'eq', value: 'test' },
      };

      expect(() => {
        service.applyColumnFilters(
          mockQb as any,
          'controls',
          columnFilters,
          'entity',
        );
      }).toThrow(BadRequestException);
    });

    it('should apply string ilike filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        name: { op: 'ilike', value: 'test' },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.name ILIKE :cf_name_0',
        { cf_name_0: '%test%' },
      );
    });

    it('should apply string eq filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        name: { op: 'eq', value: 'exact' },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith('entity.name = :cf_name_0', {
        cf_name_0: 'exact',
      });
    });

    it('should apply string startsWith filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        name: { op: 'startsWith', value: 'prefix' },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.name ILIKE :cf_name_0',
        { cf_name_0: 'prefix%' },
      );
    });

    it('should apply string endsWith filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        name: { op: 'endsWith', value: 'suffix' },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.name ILIKE :cf_name_0',
        { cf_name_0: '%suffix' },
      );
    });

    it('should apply string isNull filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        name: { op: 'isNull', value: true },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith('entity.name IS NULL');
    });

    it('should apply string isNotNull filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        name: { op: 'isNotNull', value: true },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith('entity.name IS NOT NULL');
    });

    it('should apply enum eq filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        status: { op: 'eq', value: 'draft' },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.status = :cf_status_0',
        { cf_status_0: 'draft' },
      );
    });

    it('should apply enum in filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        status: { op: 'in', value: ['draft', 'implemented'] },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.status IN (:...cf_status_0)',
        { cf_status_0: ['draft', 'implemented'] },
      );
    });

    it('should apply date gte filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        createdAt: { op: 'gte', value: '2024-01-01' },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.createdAt >= :cf_createdAt_0',
        { cf_createdAt_0: '2024-01-01' },
      );
    });

    it('should apply date lte filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        createdAt: { op: 'lte', value: '2024-12-31' },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.createdAt <= :cf_createdAt_0',
        { cf_createdAt_0: '2024-12-31' },
      );
    });

    it('should apply date between filter', () => {
      const mockQb = {
        andWhere: jest.fn(),
      };
      const columnFilters: Record<string, ColumnFilter> = {
        createdAt: {
          op: 'between',
          value: '2024-01-01',
          valueTo: '2024-12-31',
        },
      };

      service.applyColumnFilters(
        mockQb as any,
        'controls',
        columnFilters,
        'entity',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.createdAt BETWEEN :cf_createdAt_0From AND :cf_createdAt_0To',
        { cf_createdAt_0From: '2024-01-01', cf_createdAt_0To: '2024-12-31' },
      );
    });
  });
});
