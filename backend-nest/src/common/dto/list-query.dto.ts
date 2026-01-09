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
  q?: string; // Legacy alias for search

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
   * Get effective search term (search or legacy q param)
   */
  getEffectiveSearch(): string | undefined {
    return this.search || this.q;
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
