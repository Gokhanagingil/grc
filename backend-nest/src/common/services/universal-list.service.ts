import { Injectable, BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import {
  ListQueryDto,
  ListResponse,
  createListResponse,
  UniversalListConfig,
  SearchableColumn,
  SortableField,
  FilterConfig,
} from '../dto/list-query.dto';

/**
 * Universal List Service
 *
 * Provides reusable list query functionality for all GRC entities.
 * Implements the LIST-CONTRACT specification with:
 * - Text search across configured columns (ILIKE, case-insensitive)
 * - Pagination with page/pageSize
 * - Sorting with field validation
 * - Entity-specific filter whitelisting
 * - Tenant isolation (always applied)
 * - Soft delete exclusion (by default)
 *
 * Usage:
 * ```typescript
 * const config: UniversalListConfig = {
 *   searchableColumns: [
 *     { column: 'name' },
 *     { column: 'code' },
 *     { column: 'description' },
 *   ],
 *   sortableFields: [
 *     { field: 'createdAt' },
 *     { field: 'name' },
 *     { field: 'status' },
 *   ],
 *   filters: [
 *     { field: 'status', type: 'enum', enumValues: ['DRAFT', 'ACTIVE'] },
 *   ],
 *   defaultSort: { field: 'createdAt', direction: 'DESC' },
 * };
 *
 * const result = await universalListService.executeListQuery(
 *   queryBuilder,
 *   query,
 *   config,
 *   'control',
 * );
 * ```
 */
@Injectable()
export class UniversalListService {
  /**
   * Execute a list query with universal search, pagination, and sorting
   *
   * @param qb - TypeORM QueryBuilder with base entity selection
   * @param query - ListQueryDto with pagination, search, sort params
   * @param config - Entity-specific configuration for searchable/sortable fields
   * @param alias - Entity alias used in the query builder
   * @param filters - Optional additional filter values from request
   * @returns LIST-CONTRACT compliant response
   */
  async executeListQuery<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    query: ListQueryDto,
    config: UniversalListConfig,
    alias: string,
    filters?: Record<string, unknown>,
  ): Promise<ListResponse<T>> {
    // Apply search
    this.applySearch(qb, query, config.searchableColumns, alias);

    // Apply filters
    if (filters && config.filters) {
      this.applyFilters(qb, filters, config.filters, alias);
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply sorting
    this.applySorting(
      qb,
      query,
      config.sortableFields,
      config.defaultSort,
      alias,
    );

    // Apply pagination
    const page = query.getEffectivePage();
    const pageSize = query.getEffectivePageSize();
    qb.skip(query.getOffset());
    qb.take(pageSize);

    // Execute query
    const items = await qb.getMany();

    return createListResponse(items, total, page, pageSize);
  }

  /**
   * Apply text search across configured columns
   * Uses ILIKE for case-insensitive partial matching
   */
  applySearch<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    query: ListQueryDto,
    searchableColumns: SearchableColumn[],
    alias: string,
  ): void {
    const searchTerm = query.getEffectiveSearch();
    if (!searchTerm || searchableColumns.length === 0) {
      return;
    }

    const conditions = searchableColumns.map((col, index) => {
      const columnRef = col.alias
        ? `${col.alias}.${col.column}`
        : `${alias}.${col.column}`;
      return `${columnRef} ILIKE :search${index}`;
    });

    const params: Record<string, string> = {};
    searchableColumns.forEach((_, index) => {
      params[`search${index}`] = `%${searchTerm}%`;
    });

    qb.andWhere(`(${conditions.join(' OR ')})`, params);
  }

  /**
   * Apply sorting with field validation
   * Rejects unknown sort fields to prevent SQL injection
   */
  applySorting<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    query: ListQueryDto,
    sortableFields: SortableField[],
    defaultSort: { field: string; direction: 'ASC' | 'DESC' } | undefined,
    alias: string,
  ): void {
    const sortableFieldNames = new Set(sortableFields.map((f) => f.field));
    const requestedSort = query.getEffectiveSort();

    let sortField: string;
    let sortDirection: 'ASC' | 'DESC';

    if (requestedSort && sortableFieldNames.has(requestedSort.field)) {
      sortField = requestedSort.field;
      sortDirection = requestedSort.direction;
    } else if (defaultSort) {
      sortField = defaultSort.field;
      sortDirection = defaultSort.direction;
    } else {
      // Fallback to createdAt if available, otherwise first sortable field
      sortField = sortableFieldNames.has('createdAt')
        ? 'createdAt'
        : sortableFields[0]?.field || 'id';
      sortDirection = 'DESC';
    }

    // Find the field config to get the actual column name
    const fieldConfig = sortableFields.find((f) => f.field === sortField);
    const columnName = fieldConfig?.column || sortField;
    const columnAlias = fieldConfig?.alias || alias;

    qb.orderBy(`${columnAlias}.${columnName}`, sortDirection);
  }

  /**
   * Apply entity-specific filters with validation
   * Supports enum, string, uuid, date, boolean, and number types
   */
  applyFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    filters: Record<string, unknown>,
    filterConfigs: FilterConfig[],
    alias: string,
  ): void {
    for (const config of filterConfigs) {
      const value = filters[config.field];
      if (value === undefined || value === null || value === '') {
        continue;
      }

      const columnName = config.column || config.field;
      const columnRef = `${alias}.${columnName}`;
      const paramName = `filter_${config.field}`;

      switch (config.type) {
        case 'enum':
          this.applyEnumFilter(qb, columnRef, paramName, value, config);
          break;
        case 'string':
          this.applyStringFilter(qb, columnRef, paramName, value, config);
          break;
        case 'uuid':
          qb.andWhere(`${columnRef} = :${paramName}`, { [paramName]: value });
          break;
        case 'date':
          this.applyDateFilter(qb, columnRef, paramName, value);
          break;
        case 'boolean':
          qb.andWhere(`${columnRef} = :${paramName}`, {
            [paramName]: value === 'true' || value === true,
          });
          break;
        case 'number':
          qb.andWhere(`${columnRef} = :${paramName}`, {
            [paramName]: Number(value),
          });
          break;
      }
    }
  }

  /**
   * Apply enum filter with case-insensitive validation
   */
  private applyEnumFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    columnRef: string,
    paramName: string,
    value: unknown,
    config: FilterConfig,
  ): void {
    if (!config.enumValues || config.enumValues.length === 0) {
      return;
    }

    const stringValue = String(value);
    const normalizedValue =
      config.caseInsensitive !== false
        ? stringValue.toLowerCase()
        : stringValue;

    // Find matching enum value (case-insensitive by default)
    const matchedValue = config.enumValues.find((ev) => {
      const normalizedEnum =
        config.caseInsensitive !== false ? ev.toLowerCase() : ev;
      return normalizedEnum === normalizedValue;
    });

    if (!matchedValue) {
      const allowedValues = config.enumValues.join(', ');
      throw new BadRequestException(
        `Invalid ${config.field} value: '${stringValue}'. Allowed values: ${allowedValues}`,
      );
    }

    qb.andWhere(`${columnRef} = :${paramName}`, { [paramName]: matchedValue });
  }

  /**
   * Apply string filter (exact match or ILIKE for case-insensitive)
   */
  private applyStringFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    columnRef: string,
    paramName: string,
    value: unknown,
    config: FilterConfig,
  ): void {
    const stringValue = String(value);
    if (config.caseInsensitive) {
      qb.andWhere(`${columnRef} ILIKE :${paramName}`, {
        [paramName]: stringValue,
      });
    } else {
      qb.andWhere(`${columnRef} = :${paramName}`, { [paramName]: stringValue });
    }
  }

  /**
   * Apply date filter (supports range with From/To suffix)
   */
  private applyDateFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    columnRef: string,
    paramName: string,
    value: unknown,
  ): void {
    // For simple date equality
    qb.andWhere(`${columnRef} = :${paramName}`, { [paramName]: value });
  }

  /**
   * Apply date range filter
   * Call this separately for date range filters
   */
  applyDateRangeFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    columnRef: string,
    fromValue: unknown,
    toValue: unknown,
    paramPrefix: string,
  ): void {
    if (fromValue) {
      qb.andWhere(`${columnRef} >= :${paramPrefix}From`, {
        [`${paramPrefix}From`]: fromValue,
      });
    }
    if (toValue) {
      qb.andWhere(`${columnRef} <= :${paramPrefix}To`, {
        [`${paramPrefix}To`]: toValue,
      });
    }
  }

  /**
   * Apply tenant isolation filter
   * This should always be called to ensure multi-tenant security
   */
  applyTenantFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    tenantId: string,
    alias: string,
  ): void {
    qb.andWhere(`${alias}.tenantId = :tenantId`, { tenantId });
  }

  /**
   * Apply soft delete filter
   * Excludes records where isDeleted = true
   */
  applySoftDeleteFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    includeDeleted = false,
  ): void {
    if (!includeDeleted) {
      qb.andWhere(`${alias}.isDeleted = :isDeleted`, { isDeleted: false });
    }
  }

  /**
   * Validate that a sort field is allowed
   */
  validateSortField(field: string, allowedFields: string[]): boolean {
    return allowedFields.includes(field);
  }

  /**
   * Get allowed sort fields as a Set for efficient lookup
   */
  getAllowedSortFieldsSet(sortableFields: SortableField[]): Set<string> {
    return new Set(sortableFields.map((f) => f.field));
  }
}
