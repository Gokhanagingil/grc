import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsIn,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Universal List Query DTO
 *
 * Provides standard pagination, sorting, and search parameters for all list endpoints.
 * This DTO implements the LIST-CONTRACT specification for consistent API behavior.
 *
 * Query Parameters:
 * - page: Page number (1-indexed, default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - limit: Alias for pageSize (for backward compatibility)
 * - search: Text search across configured columns (ILIKE, case-insensitive)
 * - sort: Sorting in "field:dir" format (e.g., "createdAt:DESC")
 * - sortBy: Legacy sort field (use sort instead)
 * - sortOrder: Legacy sort direction (use sort instead)
 */
export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  q?: string;

  static readonly MAX_SEARCH_LENGTH = 200;
  static readonly MIN_SEARCH_LENGTH = 2;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(ASC|DESC|asc|desc)$/, {
    message: 'sort must be in format "field:ASC" or "field:DESC"',
  })
  sort?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'DESC';

  /**
   * Get effective page size (pageSize or limit)
   * limit takes precedence if provided for backward compatibility
   */
  getEffectivePageSize(): number {
    return this.limit ?? this.pageSize ?? 20;
  }

  /**
   * Get effective page number
   */
  getEffectivePage(): number {
    return this.page ?? 1;
  }

  /**
   * Normalize search term: trim, collapse multiple spaces, enforce length limit
   */
  static normalizeSearchTerm(term: string | undefined): string | undefined {
    if (!term) return undefined;
    let normalized = term.trim().replace(/\s+/g, ' ');
    if (normalized.length > ListQueryDto.MAX_SEARCH_LENGTH) {
      normalized = normalized.substring(0, ListQueryDto.MAX_SEARCH_LENGTH);
    }
    return normalized || undefined;
  }

  /**
   * Get effective search term (search or legacy q param)
   * Applies normalization: trim, space collapse, length limit
   */
  getEffectiveSearch(): string | undefined {
    const raw = this.search || this.q;
    return ListQueryDto.normalizeSearchTerm(raw);
  }

  /**
   * Check if search term meets minimum length requirement
   * Returns true if no search term or if term meets minimum length
   */
  isSearchTermValid(
    minLength: number = ListQueryDto.MIN_SEARCH_LENGTH,
  ): boolean {
    const search = this.getEffectiveSearch();
    if (!search) return true;
    return search.length >= minLength;
  }

  /**
   * Parse sort parameter into field and direction
   * Supports both new "field:dir" format and legacy sortBy/sortOrder
   */
  getEffectiveSort(): { field: string; direction: 'ASC' | 'DESC' } | null {
    if (this.sort) {
      const [field, dir] = this.sort.split(':');
      if (field && dir) {
        return {
          field,
          direction: dir.toUpperCase() as 'ASC' | 'DESC',
        };
      }
    }

    if (this.sortBy) {
      return {
        field: this.sortBy,
        direction: (this.sortOrder?.toUpperCase() as 'ASC' | 'DESC') || 'DESC',
      };
    }

    return null;
  }

  /**
   * Calculate offset for pagination
   */
  getOffset(): number {
    const page = this.getEffectivePage();
    const pageSize = this.getEffectivePageSize();
    return (page - 1) * pageSize;
  }
}

/**
 * Universal List Response Interface
 *
 * Standard response format for all paginated list endpoints.
 * Implements LIST-CONTRACT specification.
 */
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Create a LIST-CONTRACT compliant response
 */
export function createListResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): ListResponse<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Search configuration for an entity
 * Defines which columns can be searched
 */
export interface SearchableColumn {
  column: string;
  alias?: string; // Table alias for joins
}

/**
 * Sortable field configuration
 * Defines which fields can be sorted and their column mappings
 */
export interface SortableField {
  field: string;
  column?: string; // Actual column name if different from field
  alias?: string; // Table alias for joins
}

/**
 * Filter configuration for an entity
 * Defines allowed filter fields and their types
 */
export interface FilterConfig {
  field: string;
  column?: string;
  type: 'string' | 'enum' | 'uuid' | 'date' | 'boolean' | 'number';
  enumValues?: string[];
  caseInsensitive?: boolean;
}

/**
 * Universal list configuration for an entity
 */
export interface UniversalListConfig {
  searchableColumns: SearchableColumn[];
  sortableFields: SortableField[];
  filters?: FilterConfig[];
  defaultSort?: { field: string; direction: 'ASC' | 'DESC' };
}

/**
 * Sort query parameters interface
 * Supports both new "field:dir" format and legacy sortBy/sortOrder
 */
export interface SortQueryParams {
  sort?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
}

/**
 * Parsed sort result
 */
export interface ParsedSort {
  field: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Parse sort query parameters with field allowlist for security
 *
 * This utility function:
 * 1. Accepts both "sort" (field:dir format) and legacy "sortBy/sortOrder" params
 * 2. Validates the sort field against an allowlist
 * 3. Falls back to default sort if field is invalid or not provided
 *
 * Priority: sortBy/sortOrder (explicit) > sort (legacy combined format)
 *
 * @param query - Query parameters containing sort, sortBy, sortOrder
 * @param allowedFields - Array of allowed field names for sorting
 * @param defaultSort - Default sort to use if no valid sort is provided
 * @returns Parsed sort with field and direction
 *
 * @example
 * // With sortBy/sortOrder (preferred)
 * parseSortQuery({ sortBy: 'createdAt', sortOrder: 'DESC' }, ['createdAt', 'name'], { field: 'createdAt', direction: 'DESC' })
 * // Returns: { field: 'createdAt', direction: 'DESC' }
 *
 * @example
 * // With sort param (combined format)
 * parseSortQuery({ sort: 'name:ASC' }, ['createdAt', 'name'], { field: 'createdAt', direction: 'DESC' })
 * // Returns: { field: 'name', direction: 'ASC' }
 *
 * @example
 * // With invalid field (falls back to default)
 * parseSortQuery({ sortBy: 'invalidField' }, ['createdAt', 'name'], { field: 'createdAt', direction: 'DESC' })
 * // Returns: { field: 'createdAt', direction: 'DESC' }
 */
export function parseSortQuery(
  query: SortQueryParams,
  allowedFields: string[],
  defaultSort: ParsedSort,
): ParsedSort {
  // Priority 1: sortBy/sortOrder (explicit params take precedence)
  if (query.sortBy) {
    const field = query.sortBy;
    const direction =
      (query.sortOrder?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';

    // Validate field against allowlist
    if (allowedFields.includes(field)) {
      return { field, direction };
    }
    // Invalid field - fall back to default
    return defaultSort;
  }

  // Priority 2: sort param (combined format "field:dir")
  if (query.sort) {
    const parts = query.sort.split(':');
    if (parts.length === 2) {
      const [field, dir] = parts;
      const direction = dir.toUpperCase() as 'ASC' | 'DESC';

      // Validate direction
      if (direction !== 'ASC' && direction !== 'DESC') {
        return defaultSort;
      }

      // Validate field against allowlist
      if (allowedFields.includes(field)) {
        return { field, direction };
      }
    }
    // Invalid format or field - fall back to default
    return defaultSort;
  }

  // No sort params provided - use default
  return defaultSort;
}

/**
 * Common sortable fields used across GRC entities
 * These are the standard fields that most entities support for sorting
 */
export const COMMON_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'title',
  'status',
] as const;

/**
 * Extended sortable fields for entities with additional common fields
 */
export const EXTENDED_SORTABLE_FIELDS = [
  ...COMMON_SORTABLE_FIELDS,
  'dueDate',
  'priority',
  'severity',
] as const;
