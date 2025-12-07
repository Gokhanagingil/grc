import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Base Pagination Query DTO
 *
 * Provides standard pagination and sorting parameters for list endpoints.
 * All GRC list endpoints should extend or use this DTO.
 *
 * Supports two pagination styles:
 * 1. Page-based: page (1-indexed) + pageSize
 * 2. Offset-based: limit + offset
 *
 * If both styles are provided, limit/offset takes precedence.
 */
export class PaginationQueryDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'DESC';

  /**
   * Get effective limit (pageSize or limit)
   * limit takes precedence if provided
   */
  getEffectiveLimit(): number {
    return this.limit ?? this.pageSize ?? 20;
  }

  /**
   * Get effective offset
   * If offset is provided, use it; otherwise calculate from page
   */
  getEffectiveOffset(): number {
    if (this.offset !== undefined) {
      return this.offset;
    }
    const page = this.page ?? 1;
    const pageSize = this.pageSize ?? 20;
    return (page - 1) * pageSize;
  }

  /**
   * Get effective page number
   * If page is provided, use it; otherwise calculate from offset
   */
  getEffectivePage(): number {
    if (this.page !== undefined && this.offset === undefined) {
      return this.page;
    }
    const offset = this.offset ?? 0;
    const limit = this.getEffectiveLimit();
    return Math.floor(offset / limit) + 1;
  }
}

/**
 * Paginated Response Interface
 *
 * Standard response format for paginated list endpoints.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Create a paginated response from items and pagination params
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
